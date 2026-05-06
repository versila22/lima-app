from alembic.config import Config
from alembic import command
import os
from app.config import settings

def run_migrations():
    """Applies Alembic migrations programmatically."""
    alembic_ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    
    alembic_cfg = Config(alembic_ini_path)
    
    # Use the synchronous URL for migrations
    alembic_cfg.set_main_option("sqlalchemy.url", settings.sync_database_url)
    
    alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    
    command.upgrade(alembic_cfg, "head")
