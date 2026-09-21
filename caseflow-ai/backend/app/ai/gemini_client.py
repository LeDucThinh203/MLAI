from typing import Optional, Any
from app.core.config import settings
from app.core.logging import logger

class GeminiClient:
    """Wrapper around google-genai client."""
    _instance: Optional["GeminiClient"] = None
    _client: Any = None

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.text_model = settings.GEMINI_TEXT_MODEL
        self.vlm_model = settings.GEMINI_VLM_MODEL
        self._init_client()

    def _init_client(self):
        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
                logger.info(f"Initialized Google GenAI Client with VLM model: {self.vlm_model}")
            except Exception as e:
                logger.warning(f"Failed to initialize google-genai client: {e}")
                self._client = None
        else:
            logger.info("GEMINI_API_KEY is not set. Gemini client operating in mock/fallback mode.")
            self._client = None

    @property
    def client(self) -> Any:
        return self._client

    @property
    def is_configured(self) -> bool:
        return self._client is not None

gemini_client = GeminiClient()
