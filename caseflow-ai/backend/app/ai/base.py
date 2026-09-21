from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from app.schemas.evidence_extraction import EvidenceExtractionResult

class BaseVisionProvider(ABC):
    """Abstract interface for Visual-Language Model (VLM) providers."""

    @abstractmethod
    async def analyze_image(self, file_path: str, mime_type: str, prompt_override: Optional[str] = None) -> EvidenceExtractionResult:
        """Extract structured data from standard image evidence."""
        pass

    @abstractmethod
    async def analyze_document(self, file_path: str, mime_type: str) -> EvidenceExtractionResult:
        """Extract structured information from PDF or formal documents."""
        pass

    @abstractmethod
    async def analyze_screenshot(self, file_path: str, mime_type: str) -> EvidenceExtractionResult:
        """Extract structured facts from SIS or system screenshots."""
        pass

    @abstractmethod
    async def extract_receipt(self, file_path: str, mime_type: str) -> EvidenceExtractionResult:
        """Specialized extraction for tuition/fee payment receipts."""
        pass

    @abstractmethod
    async def extract_structured_evidence(self, file_path: str, mime_type: str, evidence_type: str) -> EvidenceExtractionResult:
        """Route to appropriate extraction logic based on evidence type."""
        pass


class BaseTextProvider(ABC):
    """Abstract interface for Text LLM providers."""

    @abstractmethod
    async def understand_case(self, title: str, description: str, student_id: str) -> Dict[str, Any]:
        """Summarize and tag key entities from student case description."""
        pass

    @abstractmethod
    async def identify_missing_information(self, case_type: str, extracted_facts: Dict[str, Any]) -> List[str]:
        """Identify missing mandatory fields for a specific case category."""
        pass

    @abstractmethod
    async def generate_escalation_question(self, escalation_type: str, context: Dict[str, Any]) -> str:
        """Formulate a precise, actionable question directed to the responsible human officer."""
        pass

    @abstractmethod
    async def generate_decision_explanation(self, decision_type: str, rule_code: str, details: Dict[str, Any]) -> str:
        """Explain the rationale behind a decision in transparent, accountable language."""
        pass
