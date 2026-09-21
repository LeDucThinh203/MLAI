import json
from typing import Optional
from app.ai.vision.gemini_vlm_provider import GeminiVLMProvider
from app.schemas.evidence_extraction import EvidenceExtractionResult
from app.models.evidence_extraction import EvidenceExtraction

class EvidenceAnalysisService:
    def __init__(self, vlm_provider: Optional[GeminiVLMProvider] = None):
        self.vlm_provider = vlm_provider or GeminiVLMProvider()

    async def analyze_evidence_file(
        self,
        evidence_id: str,
        file_path: str,
        mime_type: str,
        evidence_type: str,
        original_filename: Optional[str] = None
    ) -> EvidenceExtraction:
        extraction_result: EvidenceExtractionResult = await self.vlm_provider.extract_structured_evidence(
            file_path, mime_type, evidence_type, original_filename=original_filename
        )

        has_uncertainty = len(extraction_result.uncertain_fields) > 0 or extraction_result.visual_quality in ["BLURRY", "UNREADABLE"]

        return EvidenceExtraction(
            evidence_id=evidence_id,
            provider="GEMINI_VLM",
            model_name=getattr(self.vlm_provider, "model_name", "gemini-2.5-flash"),
            document_type=extraction_result.document_type or evidence_type,
            structured_data_json=extraction_result.model_dump_json(),
            extraction_summary=f"Extracted {extraction_result.document_type or 'document'} with quality {extraction_result.visual_quality}",
            has_uncertain_fields=has_uncertainty,
            uncertain_fields_json=json.dumps(extraction_result.uncertain_fields) if extraction_result.uncertain_fields else None,
        )
