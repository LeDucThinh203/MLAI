from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class AgentChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=12000)
    conversationId: Optional[str] = Field(default=None, max_length=100)


class AgentConversationCreate(StrictModel):
    title: Optional[str] = Field(default=None, max_length=255)


class AgentActionRequest(StrictModel):
    reason: Optional[str] = Field(default=None, max_length=1000)
    # For secure confirmation forms only; never persisted or sent to the model.
    secureFields: Optional[Dict[str, str]] = None

    @field_validator('secureFields')
    @classmethod
    def validate_secure_fields(cls, value):
        if value is not None and (set(value) != {'password'} or len(value['password']) > 256):
            raise ValueError('Only a bounded password field is accepted by secure confirmation forms.')
        return value


class PlannerToolCall(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    arguments: Dict[str, Any] = Field(default_factory=dict)


class PlannerResponse(StrictModel):
    responseType: str
    message: str = ''
    toolCalls: list[PlannerToolCall] = Field(default_factory=list)

    @classmethod
    def validate_shape(cls, data: dict) -> bool:
        return (
            data.get('responseType') in {'ANSWER', 'TOOL_CALL'}
            and isinstance(data.get('message', ''), str)
            and isinstance(data.get('toolCalls', []), list)
            and (data.get('responseType') != 'ANSWER' or not data.get('toolCalls'))
            and (data.get('responseType') != 'TOOL_CALL' or bool(data.get('toolCalls')))
            and len(data.get('toolCalls', [])) <= 4
        )
