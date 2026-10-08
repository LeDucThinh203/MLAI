"""
============================================================================
CASEFLOW AI - SQLALCHEMY ORM DATABASE SESSION & ENGINE
============================================================================
Module quản lý kết nối SQLAlchemy 2.0 ORM:
  - Hỗ trợ dual-engine: Microsoft SQL Server (Enterprise) & SQLite (Portable/Test)
  - Cung cấp SessionLocal, get_db (FastAPI Dependency), và init_orm_db() (Code-First)
============================================================================
"""

import os
import sys
import json
import sqlite3
import bcrypt
from datetime import datetime
from urllib.parse import quote_plus
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker, Session

from app.config import (
    DB_TYPE,
    DB_SERVER,
    DB_NAME,
    DB_PORT,
    DB_TRUSTED_CONNECTION,
    DB_DRIVER,
    DB_TRUST_SERVER_CERTIFICATE,
    DB_ENCRYPT,
    DB_USER,
    DB_PASSWORD,
)
from app.models import (
    Base,
    User,
    Case,
    Audit,
    Comment,
    Notification,
    RefreshToken,
    EvidenceUpload,
)

# Thử nạp pyodbc
try:
    import pyodbc
    HAS_PYODBC = True
except ImportError:
    pyodbc = None
    HAS_PYODBC = False


def _get_best_odbc_driver() -> str:
    if not HAS_PYODBC or not pyodbc:
        return DB_DRIVER
    try:
        installed = pyodbc.drivers()
    except Exception:
        return DB_DRIVER
    candidates = [
        DB_DRIVER,
        'ODBC Driver 18 for SQL Server',
        'ODBC Driver 17 for SQL Server',
        'SQL Server Native Client 11.0',
        'SQL Server'
    ]
    for c in candidates:
        if c in installed:
            return c
    return DB_DRIVER


def get_sqlite_path() -> str:
    data_dir = os.environ.get('DATA_DIR')
    if data_dir:
        if not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, 'caseflow.sqlite')
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'caseflow.sqlite')


def get_data_json_path() -> str:
    data_dir = os.environ.get('DATA_DIR')
    if data_dir and os.path.exists(os.path.join(data_dir, 'data.json')):
        return os.path.join(data_dir, 'data.json')
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'data.json')


_cached_engine = None
_cached_data_dir = None


def get_engine():
    """Tạo hoặc lấy SQLAlchemy Engine phù hợp với cấu hình hiện tại."""
    global _cached_engine, _cached_data_dir
    current_data_dir = os.environ.get('DATA_DIR')
    if _cached_engine is not None and _cached_data_dir == current_data_dir:
        return _cached_engine

    # Nếu có DATA_DIR (runner test môi trường tạm), dùng SQLite
    if current_data_dir or DB_TYPE != 'mssql' or not HAS_PYODBC:
        sqlite_file = get_sqlite_path()
        sqlite_url = f"sqlite:///{sqlite_file.replace(os.sep, '/')}"
        engine = create_engine(
            sqlite_url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        _cached_engine = engine
        _cached_data_dir = current_data_dir
        return engine

    # Thử kết nối MSSQL qua pyodbc
    try:
        driver = _get_best_odbc_driver()
        if DB_TRUSTED_CONNECTION:
            conn_str = (
                f"DRIVER={{{driver}}};"
                f"SERVER={DB_SERVER};"
                f"DATABASE={DB_NAME};"
                f"Trusted_Connection=yes;"
                f"TrustServerCertificate={'yes' if DB_TRUST_SERVER_CERTIFICATE else 'no'};"
                f"Encrypt={'yes' if DB_ENCRYPT else 'no'};"
            )
        else:
            conn_str = (
                f"DRIVER={{{driver}}};"
                f"SERVER={DB_SERVER},{DB_PORT};"
                f"DATABASE={DB_NAME};"
                f"UID={DB_USER};"
                f"PWD={DB_PASSWORD};"
                f"TrustServerCertificate={'yes' if DB_TRUST_SERVER_CERTIFICATE else 'no'};"
                f"Encrypt={'yes' if DB_ENCRYPT else 'no'};"
            )
        quoted_params = quote_plus(conn_str)
        mssql_url = f"mssql+pyodbc:///?odbc_connect={quoted_params}"
        engine = create_engine(mssql_url, pool_pre_ping=True, fast_executemany=True)
        # Test connection
        with engine.connect() as conn:
            pass
        _cached_engine = engine
        _cached_data_dir = current_data_dir
        return engine
    except Exception as e:
        print(f"[ORM Warning] Không thể kết nối SQL Server ({DB_SERVER}): {e}. Chuyển sang SQLite fallback.")
        sqlite_file = get_sqlite_path()
        sqlite_url = f"sqlite:///{sqlite_file.replace(os.sep, '/')}"
        engine = create_engine(
            sqlite_url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
        _cached_engine = engine
        _cached_data_dir = current_data_dir
        return engine


def get_session_factory():
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency để inject Database Session vào Router."""
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context Manager cho các thao tác ngoài FastAPI Request context."""
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_orm_db():
    """
    Khởi tạo cấu trúc bảng tự động bằng SQLAlchemy Code-First
    và nạp dữ liệu mẫu từ data.json nếu bảng Users chưa có dữ liệu.
    """
    engine = get_engine()
    # 1. Tạo tất cả bảng nếu chưa tồn tại (Code-First Schema Generation)
    Base.metadata.create_all(bind=engine)

    # 2. Kiểm tra và seed dữ liệu nếu bảng User đang trống
    with get_db_session() as db:
        user_count = db.scalar(select(func.count(User.id)))
        if user_count == 0:
            json_path = get_data_json_path()
            if os.path.exists(json_path):
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        raw = json.load(f)
                    if 'users' in raw:
                        for u in raw['users']:
                            raw_pass = u.get('password', 'password123')
                            hashed_pass = raw_pass if (raw_pass.startswith('$2a$') or raw_pass.startswith('$2b$')) else bcrypt.hashpw(raw_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                            now_iso = datetime.utcnow().isoformat() + 'Z'
                            user_obj = User(
                                id=u['id'],
                                username=u['username'],
                                password=hashed_pass,
                                fullName=u['fullName'],
                                studentCode=u.get('studentCode'),
                                email=u.get('email', f"{u['username']}@caseflow.ai"),
                                role=u['role'],
                                department=u.get('department', 'Trường Đại Học'),
                                avatar=u.get('avatar', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
                                bio=u.get('bio', 'Người dùng hệ thống CaseFlow AI.'),
                                twoFactorEnabled=1 if u.get('twoFactorEnabled') else 0,
                                twoFactorSecret=u.get('twoFactorSecret'),
                                mustChangePassword=0,
                                createdAt=u.get('createdAt', now_iso),
                                updatedAt=u.get('updatedAt', now_iso)
                            )
                            db.merge(user_obj)
                        db.commit()
                        print(f"[ORM Seed] Đã nạp thành công {len(raw['users'])} người dùng ban đầu từ data.json vào cơ sở dữ liệu.")
                except Exception as e:
                    print(f"[ORM Seed] Lỗi nạp data.json: {e}")

    engine_name = engine.dialect.name
    print(f"[ORM Database] Khởi tạo SQLAlchemy ORM Code-First thành công (Dialect: {engine_name})")
