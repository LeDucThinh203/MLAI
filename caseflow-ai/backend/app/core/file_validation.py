import hashlib
import os
import uuid
from pathlib import Path
from typing import Tuple
from app.core.config import settings
from app.core.exceptions import FileValidationException

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

def validate_and_process_upload(
    original_filename: str,
    content_type: str,
    file_bytes: bytes,
    storage_dir: str = settings.EVIDENCE_STORAGE_PATH
) -> Tuple[str, str, str, int]:
    """
    Validates upload and returns:
    (stored_filename, absolute_storage_path, sha256_hash, file_size)
    """
    # 1. Check size
    file_size = len(file_bytes)
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if file_size > max_bytes:
        raise FileValidationException(
            f"File size {file_size / (1024 * 1024):.2f}MB exceeds limit of {settings.MAX_UPLOAD_MB}MB"
        )
    if file_size == 0:
        raise FileValidationException("Uploaded file is empty")

    # 2. Check path traversal and extension
    clean_filename = os.path.basename(original_filename)
    if ".." in original_filename or "/" in clean_filename or "\\" in clean_filename:
        raise FileValidationException("Path traversal sequence detected in filename")

    ext = Path(clean_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileValidationException(
            f"File extension '{ext}' is not permitted. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 3. Check MIME type
    if content_type.lower() not in ALLOWED_MIME_TYPES:
        raise FileValidationException(
            f"Content-Type '{content_type}' is not supported. Allowed: {', '.join(ALLOWED_MIME_TYPES)}"
        )

    # 4. Calculate SHA-256
    sha256_hash = hashlib.sha256(file_bytes).hexdigest()

    # 5. Generate secure stored filename (uuid + extension) to avoid collision and traversal
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    
    # Ensure storage directory exists
    os.makedirs(storage_dir, exist_ok=True)
    destination_path = os.path.join(storage_dir, stored_filename)

    # Write file content to disk
    with open(destination_path, "wb") as f:
        f.write(file_bytes)

    return stored_filename, os.path.abspath(destination_path), sha256_hash, file_size
