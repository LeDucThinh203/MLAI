import json
from typing import Optional
from app.ai.base import BaseVisionProvider
from app.schemas.evidence_extraction import EvidenceExtractionResult
from app.ai.gemini_client import gemini_client
from app.ai.prompts.fact_extraction import (
    FACT_EXTRACTION_SYSTEM_PROMPT,
    RECEIPT_EXTRACTION_PROMPT,
    SCREENSHOT_ANALYSIS_PROMPT,
    DOCUMENT_ANALYSIS_PROMPT,
)
from app.core.logging import logger

class GeminiVLMProvider(BaseVisionProvider):
    """
    Multimodal VLM provider extracting strictly validated structured facts
    using Google GenAI Gemini VLM.
    """

    @property
    def model_name(self) -> str:
        return gemini_client.vlm_model

    async def _call_vlm(self, file_path: str, mime_type: str, prompt: str, original_filename: Optional[str] = None) -> EvidenceExtractionResult:
        if not gemini_client.is_configured:
            logger.warning("Gemini not configured; evidence requires human review.")
            return EvidenceExtractionResult(
                document_type="UNKNOWN",
                uncertain_fields=["amount", "student_identifier", "transaction_id", "payment_status"],
                visual_quality="UNREADABLE",
                notes="VLM extraction unavailable: Gemini API key not configured."
            )

        try:
            from google.genai import types
            
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
            
            full_prompt = f"{FACT_EXTRACTION_SYSTEM_PROMPT}\n\nTask: {prompt}\nRespond with JSON matching EvidenceExtractionResult schema."
            
            response = gemini_client.client.models.generate_content(
                model=gemini_client.vlm_model,
                contents=[part, full_prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=EvidenceExtractionResult,
                    temperature=0.1,  # Low temperature for strict factual extraction
                )
            )

            raw_text = response.text
            data = json.loads(raw_text)
            return EvidenceExtractionResult(**data)

        except Exception as e:
            logger.error(f"Error during Gemini VLM extraction: {e}")
            return EvidenceExtractionResult(
                document_type="UNKNOWN",
                uncertain_fields=["amount", "student_identifier", "transaction_id", "payment_status"],
                visual_quality="UNREADABLE",
                notes="VLM extraction unavailable; human review required."
            )

    async def analyze_image(self, file_path: str, mime_type: str, prompt_override: Optional[str] = None, original_filename: Optional[str] = None) -> EvidenceExtractionResult:
        prompt = prompt_override or "Extract all student information, dates, status, and IDs visible in this image."
        return await self._call_vlm(file_path, mime_type, prompt, original_filename=original_filename)

    async def analyze_document(self, file_path: str, mime_type: str, original_filename: Optional[str] = None) -> EvidenceExtractionResult:
        return await self._call_vlm(file_path, mime_type, DOCUMENT_ANALYSIS_PROMPT, original_filename=original_filename)

    async def analyze_screenshot(self, file_path: str, mime_type: str, original_filename: Optional[str] = None) -> EvidenceExtractionResult:
        return await self._call_vlm(file_path, mime_type, SCREENSHOT_ANALYSIS_PROMPT, original_filename=original_filename)

    async def extract_receipt(self, file_path: str, mime_type: str, original_filename: Optional[str] = None) -> EvidenceExtractionResult:
        return await self._call_vlm(file_path, mime_type, RECEIPT_EXTRACTION_PROMPT, original_filename=original_filename)

    async def extract_structured_evidence(self, file_path: str, mime_type: str, evidence_type: str, original_filename: Optional[str] = None) -> EvidenceExtractionResult:
        if evidence_type.upper() in ["RECEIPT", "BANK_TRANSFER", "TUITION_PAYMENT"]:
            return await self.extract_receipt(file_path, mime_type, original_filename=original_filename)
        elif evidence_type.upper() in ["SCREENSHOT", "SIS_SCREENSHOT", "EMAIL_SCREENSHOT"]:
            return await self.analyze_screenshot(file_path, mime_type, original_filename=original_filename)
        elif evidence_type.upper() in ["DOCUMENT", "PDF_CONFIRMATION", "PETITION"]:
            return await self.analyze_document(file_path, mime_type, original_filename=original_filename)
        else:
            return await self.analyze_image(file_path, mime_type, original_filename=original_filename)
