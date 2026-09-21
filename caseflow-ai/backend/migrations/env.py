import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Append current directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.db.base import Base

# Import all models to register with Base.metadata
from app.models.department import Department  # noqa: F401
from app.models.case import Case  # noqa: F401
from app.models.case_message import CaseMessage  # noqa: F401
from app.models.evidence import Evidence  # noqa: F401
from app.models.evidence_extraction import EvidenceExtraction  # noqa: F401
from app.models.evidence_comparison import EvidenceComparison  # noqa: F401
from app.models.case_decision import CaseDecision  # noqa: F401
from app.models.escalation import Escalation  # noqa: F401
from app.models.human_review import HumanReview  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.policy import Policy  # noqa: F401
from app.models.policy_rule import PolicyRule  # noqa: F401
from app.models.verification_run import VerificationRun  # noqa: F401
from app.models.verification_result import VerificationResult  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.get_database_url()
    context.configure(
        url=str(url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    from app.core.database import engine

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
