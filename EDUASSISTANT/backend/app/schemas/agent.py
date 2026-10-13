from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class AgentChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=12000)
    conversationId: Optional[str] = Field(default=None, max_length=100)
    evidenceFileName: Optional[str] = Field(default=None, max_length=255)


class AgentConversationCreate(StrictModel):
    title: Optional[str] = Field(default=None, max_length=255)


class AgentActionRequest(StrictModel):
    reason: Optional[str] = Field(default=None, max_length=1000)


class PlannerToolCall(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    arguments: Dict[str, Any]


class PlannerResponse(StrictModel):
    responseType: Literal['ANSWER', 'TOOL_CALL']
    message: str = Field(min_length=1, max_length=4000)
    toolCalls: list[PlannerToolCall] = Field(max_length=4)

    @model_validator(mode='after')
    def validate_response_shape(self):
        if self.responseType == 'ANSWER' and self.toolCalls:
            raise ValueError('ANSWER responses cannot include tool calls.')
        if self.responseType == 'TOOL_CALL' and not self.toolCalls:
            raise ValueError('TOOL_CALL responses require at least one tool call.')
        return self

    @classmethod
    def validate_shape(cls, data: dict) -> bool:
        try:
            cls.model_validate(data)
        except (TypeError, ValueError):
            return False
        return True
