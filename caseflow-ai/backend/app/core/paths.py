"""Stable filesystem paths used by the backend.

Keeping path resolution here makes commands work regardless of the current
working directory used to start Uvicorn, Alembic, or pytest.
"""
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
TEST_DATA_DIR = PROJECT_DIR / "test-data" / "sprint1"
EVIDENCE_DIR = BACKEND_DIR / "storage" / "evidence"


def get_test_data_file(name: str) -> Path:
    """Return a known verification fixture and reject path traversal."""
    path = (TEST_DATA_DIR / name).resolve()
    if TEST_DATA_DIR.resolve() not in path.parents:
        raise ValueError("Test data path must stay inside the fixture directory.")
    return path
