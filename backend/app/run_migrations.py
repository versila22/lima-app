from alembic.config import Config
from alembic import command
import os

def run_migrations():
    """Applies Alembic migrations programmatically."""
    # Alembic needs the path to alembic.ini
    # We assume this script is run from the project root
    alembic_ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    
    alembic_cfg = Config(alembic_ini_path)
    
    # We tell Alembic to use the project root as the script location
    alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    
    command.upgrade(alembic_cfg, "head")
