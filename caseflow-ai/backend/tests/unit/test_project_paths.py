import pytest

from app.core.paths import TEST_DATA_DIR, get_test_data_file
from app.services.verification_service import VerificationService


def test_verification_fixtures_are_resolved_from_project_root():
    fixtures = VerificationService._load_test_cases(TEST_DATA_DIR)
    assert fixtures
    assert get_test_data_file("verify_cases.json").is_file()


def test_test_data_path_rejects_directory_traversal():
    with pytest.raises(ValueError):
        get_test_data_file("../secret.json")
