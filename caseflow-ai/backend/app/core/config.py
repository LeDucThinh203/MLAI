import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # AI (Gemini)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_TEXT_MODEL: str = "gemini-2.5-flash"
    GEMINI_VLM_MODEL: str = "gemini-2.5-flash"

    # SQL Server Database
    DB_SERVER: str = "localhost"
    DB_PORT: Optional[int] = None
    DB_NAME: str = "CaseFlowAI"
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    DB_ENCRYPT: Optional[str] = None
    DB_TRUST_SERVER_CERTIFICATE: str = "yes"
    DB_TRUSTED_CONNECTION: str = "yes"

    # Storage
    EVIDENCE_STORAGE_PATH: str = "storage/evidence"
    MAX_UPLOAD_MB: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_database_url(self) -> URL:
        """Construct database URL safely using sqlalchemy.engine.URL.create"""
        query_params = {
            "driver": self.DB_DRIVER,
            "TrustServerCertificate": self.DB_TRUST_SERVER_CERTIFICATE,
        }
        if self.DB_ENCRYPT:
            query_params["Encrypt"] = self.DB_ENCRYPT

        if self.DB_TRUSTED_CONNECTION and self.DB_TRUSTED_CONNECTION.lower() in ["yes", "true", "1"]:
            query_params["Trusted_Connection"] = "yes"
            return URL.create(
                "mssql+pyodbc",
                host=self.DB_SERVER,
                database=self.DB_NAME,
                query=query_params
            )
        else:
            return URL.create(
                "mssql+pyodbc",
                username=self.DB_USER,
                password=self.DB_PASSWORD,
                host=self.DB_SERVER,
                port=self.DB_PORT,
                database=self.DB_NAME,
                query=query_params
            )

settings = Settings()
