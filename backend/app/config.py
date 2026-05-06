"""Application configuration via environment variables."""

from functools import lru_cache
from typing import List, Union

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_JWT_SECRET = "insecure_dev_secret_change_me"
DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://localhost:5173,http://localhost:8080"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://lima:password@localhost:5432/lima_db"

    # JWT
    JWT_SECRET: str = DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Refresh token secret — intentionally same as JWT_SECRET in development.
    # Set to a distinct value in staging/production for independent rotation.
    REFRESH_JWT_SECRET: str = DEFAULT_JWT_SECRET

    # App
    APP_ENV: str = "development"
    DEBUG: bool = False
    FRONTEND_URL: str = "https://improv-cabaret-planner.lovable.app"

    # CORS
    # Production must set CORS_ORIGINS explicitly via environment variables.
    CORS_ORIGINS: Union[str, List[str]] = DEFAULT_CORS_ORIGINS

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@lima.asso.fr"
    SMTP_TLS: bool = True

    # Server
    PORT: int = 8000

    # Storage (Cloudflare R2 / S3)
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    S3_BUCKET_NAME: str | None = None
    S3_PUBLIC_URL: str | None = None

    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        if self.APP_ENV != "development":
            if self.JWT_SECRET == DEFAULT_JWT_SECRET:
                raise ValueError(
                    "JWT_SECRET uses the insecure default value. "
                    "Set JWT_SECRET in the environment before starting in non-development mode."
                )
            if self.REFRESH_JWT_SECRET == DEFAULT_JWT_SECRET:
                raise ValueError(
                    "REFRESH_JWT_SECRET uses the insecure default value. "
                    "Set REFRESH_JWT_SECRET in the environment before starting in non-development mode."
                )
        return self

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def async_database_url(self) -> str:
        """Normalized async database URL for the application."""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"): # Railway can use this format
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        
        # asyncpg doesn't support sslmode in the query string
        if "?sslmode=" in url:
            url = url.split("?sslmode=")[0]
        return url

    @property
    def sync_database_url(self) -> str:
        """Synchronous URL for Alembic migrations."""
        # This property must be completely separate from the main DATABASE_URL
        # to avoid driver conflicts.
        
        # Start with the async URL, as it's the source of truth from Railway
        db_url = str(self.DATABASE_URL)
        
        # Replace the async driver with the sync driver
        if "postgresql+asyncpg://" in db_url:
            db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        elif "postgresql://" in db_url:
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://")

        # Ensure sslmode=require is present for the synchronous connection
        if 'sslmode' not in db_url:
            if '?' in db_url:
                return f"{db_url}&sslmode=require"
            return f"{db_url}?sslmode=require"
        return db_url


@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
