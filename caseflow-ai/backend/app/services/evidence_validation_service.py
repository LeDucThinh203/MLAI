from typing import Tuple
from app.core.file_validation import validate_and_process_upload

class EvidenceValidationService:
    def validate_and_save(
        self,
        original_filename: str,
        content_type: str,
        file_bytes: bytes
    ) -> Tuple[str, str, str, int]:
        """Validates file format, size, checksum, and persists to evidence storage."""
        return validate_and_process_upload(original_filename, content_type, file_bytes)
