from typing import Optional
from app.ai.vision.gemini_vlm_provider import GeminiVLMProvider
from app.schemas.evidence_extraction import EvidenceExtractionResult

class DocumentAnalyzer:
    def __init__(self, provider: Optional[GeminiVLMProvider] = None):
        self.provider = provider or GeminiVLMProvider()

    async def analyze(self, file_path: str, mime_type: str) -> EvidenceExtractionResult:
        return await self.provider.analyze_document(file_path, mime_type)
