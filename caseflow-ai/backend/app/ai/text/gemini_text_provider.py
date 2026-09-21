import json
from typing import Dict, Any, List
from app.ai.base import BaseTextProvider
from app.ai.gemini_client import gemini_client
from app.core.logging import logger

class GeminiTextProvider(BaseTextProvider):
    """
    Text LLM provider for assisting with contextual synthesis, missing info detection,
    and drafting accountable escalation questions for human review.
    Does NOT create policy rules or make autonomous authority determinations.
    """

    async def understand_case(self, title: str, description: str, student_id: str) -> Dict[str, Any]:
        if not gemini_client.is_configured:
            return {
                "summary": f"Case submitted for student {student_id}: {title}",
                "key_entities": {"student_id": student_id, "title": title}
            }
        try:
            prompt = f"Summarize this student case and extract key entities:\nStudent ID: {student_id}\nTitle: {title}\nDescription: {description}\nReturn JSON with keys 'summary' and 'key_entities'."
            response = gemini_client.client.models.generate_content(
                model=gemini_client.text_model,
                contents=prompt
            )
            return {"summary": response.text, "raw_response": response.text}
        except Exception as e:
            logger.error(f"Error in understand_case: {e}")
            return {"summary": description, "error": str(e)}

    async def identify_missing_information(self, case_type: str, extracted_facts: Dict[str, Any]) -> List[str]:
        # Deterministic checklist fallback
        missing: List[str] = []
        if case_type == "TUITION_STATUS":
            if not extracted_facts.get("transaction_id"):
                missing.append("transaction_id")
            if not extracted_facts.get("amount"):
                missing.append("amount")
        return missing

    async def generate_escalation_question(self, escalation_type: str, context: Dict[str, Any]) -> str:
        """
        Generate precise, non-generic Vietnamese escalation question for the responsible human officer.
        """
        if escalation_type == "DATA_CONFLICT":
            tx_id = context.get("transaction_id", "Không rõ")
            receipt_amount = context.get("receipt_amount", "Chưa xác định")
            system_amount = context.get("system_amount", "Chưa xác định")
            return f"Giao dịch {tx_id} thể hiện {receipt_amount} trên biên lai nhưng hệ thống ghi nhận {system_amount}. Anh/chị xác nhận số tiền hợp lệ là bao nhiêu?"
        
        elif escalation_type == "FACT_UNKNOWN":
            fields = ", ".join(context.get("uncertain_fields", ["thông tin"]))
            return f"Chứng từ tải lên bị mờ hoặc thiếu thông tin rõ ràng tại các mục: {fields}. Anh/chị cần sinh viên nộp lại minh chứng bổ sung nào?"

        elif escalation_type == "AUTHORITY_REQUIRED":
            rule = context.get("rule_name", "Quy định thẩm quyền")
            return f"Hồ sơ sinh viên yêu cầu quyết định đặc cách vượt quyền tự động của AI ({rule}). Cán bộ có thẩm quyền vui lòng đưa ra phê duyệt hoặc từ chối chính thức."

        return f"Hồ sơ gặp trường hợp {escalation_type}. Cán bộ phụ trách vui lòng kiểm tra và xử lý."

    async def generate_decision_explanation(self, decision_type: str, rule_code: str, details: Dict[str, Any]) -> str:
        """
        Transparent explanation for why automation decided or stopped.
        """
        reason = details.get("reason", "Quy tắc chính sách được áp dụng.")
        return f"Hệ thống đưa ra quyết định [{decision_type}] dựa trên quy tắc [{rule_code}]. Lý do: {reason}."
