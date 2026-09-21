from typing import Optional, Any, Dict

class CaseFlowException(Exception):
    """Base exception for CaseFlow application."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

class EntityNotFoundException(CaseFlowException):
    """Raised when a requested entity cannot be found."""
    pass

class FileValidationException(CaseFlowException):
    """Raised when file validation fails (size, MIME, checksum, path traversal)."""
    pass

class PolicyEngineException(CaseFlowException):
    """Raised during deterministic policy evaluation."""
    pass

class AIProviderException(CaseFlowException):
    """Raised when Gemini or VLM provider encounters an error."""
    pass

class ConflictDetectedException(CaseFlowException):
    """Raised when contradictory evidence is encountered."""
    pass

class WorkflowHaltedException(CaseFlowException):
    """Raised when workflow is stopped or needs human intervention."""
    pass
