from typing import Dict, Any, Optional
from app.ai.text.gemini_text_provider import GeminiTextProvider

class ExplanationService:
    """Provides human-readable justifications and explanations for all decisions and escalations."""

    def __init__(self, text_provider: Optional[GeminiTextProvider] = None):
        self.text_provider = text_provider or GeminiTextProvider()

    async def explain_decision(self, decision_type: str, rule_code: str, details: Dict[str, Any]) -> str:
        return await self.text_provider.generate_decision_explanation(decision_type, rule_code, details)

    async def explain_escalation(self, escalation_type: str, context: Dict[str, Any]) -> str:
        return await self.text_provider.generate_escalation_question(escalation_type, context)
