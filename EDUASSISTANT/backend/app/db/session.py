"""SQLAlchemy session helpers for the PostgreSQL deployment.

The application data access layer uses psycopg directly.  These helpers are
kept for Alembic and the ORM models, so importing ``app.db`` never reintroduces
the old SQLite/SQL Server fallback.
"""
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import DATABASE_URL, DIRECT_DATABASE_URL


_engine = None


def get_engine():
    """Return the bounded ORM engine used by migration and legacy helpers."""
    global _engine
    connection_url = DIRECT_DATABASE_URL or DATABASE_URL
    if not connection_url:
        raise RuntimeError("DATABASE_URL is required for PostgreSQL.")
    if _engine is None:
        sqlalchemy_url = connection_url.replace("postgresql://", "postgresql+psycopg://", 1)
        _engine = create_engine(
            sqlalchemy_url,
            pool_pre_ping=True,
            pool_size=1,
            max_overflow=0,
        )
    return _engine


def get_session_factory():
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_orm_db():
    """Create ORM-managed tables when explicitly invoked by Alembic tooling."""
    from app.models import Base
    Base.metadata.create_all(bind=get_engine())
