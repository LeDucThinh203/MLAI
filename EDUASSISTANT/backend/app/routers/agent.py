from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_roles
from app.core.responses import api_response
from app.schemas.agent import AgentActionRequest, AgentChatRequest, AgentConversationCreate
from app.services import agent_rag_service, agent_service


router = APIRouter(tags=['AI Agent'])


def _error(exc: agent_service.AgentError):
    return api_response(exc.status_code, False, str(exc), None, exc.error)


@router.post('/api/agent/chat')
async def chat(request: AgentChatRequest, user: dict = Depends(get_current_user)):
    try:
        result = await agent_service.chat(user, request.message, request.conversationId)
        return api_response(200, True, 'Agent đã xử lý yêu cầu.', result)
    except agent_service.AgentError as exc:
        return _error(exc)


@router.get('/api/agent/conversations')
async def list_conversations(user: dict = Depends(get_current_user)):
    return api_response(200, True, 'Đã tải danh sách hội thoại.',
                        {'conversations': agent_service.list_conversations(user)})


@router.post('/api/agent/conversations')
async def create_conversation(request: AgentConversationCreate, user: dict = Depends(get_current_user)):
    conversation = await agent_service.create_conversation(user, request.title)
    return api_response(201, True, 'Đã tạo hội thoại.', {'conversation': conversation})


@router.get('/api/agent/conversations/{conversation_id}')
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    try:
        return api_response(200, True, 'Đã tải hội thoại.',
                            {'conversation': agent_service.conversation_detail(conversation_id, user)})
    except agent_service.AgentError as exc:
        return _error(exc)


@router.delete('/api/agent/conversations/{conversation_id}')
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    try:
        agent_service.delete_conversation(conversation_id, user)
        return api_response(200, True, 'Đã xóa hội thoại.', {'conversationId': conversation_id})
    except agent_service.AgentError as exc:
        return _error(exc)


@router.post('/api/agent/actions/{action_id}/confirm')
async def confirm_action(action_id: str, request: AgentActionRequest, user: dict = Depends(get_current_user)):
    try:
        result = await agent_service.confirm_action(action_id, user, request.secureFields)
        return api_response(200, True, 'Thao tác đã được xác nhận.', result)
    except agent_service.AgentError as exc:
        return _error(exc)


@router.post('/api/agent/actions/{action_id}/cancel')
async def cancel_action(action_id: str, user: dict = Depends(get_current_user)):
    try:
        await agent_service.cancel_action(action_id, user)
        return api_response(200, True, 'Đã hủy thao tác chờ xác nhận.', {'actionId': action_id, 'status': 'CANCELLED'})
    except agent_service.AgentError as exc:
        return _error(exc)


@router.get('/api/admin/agent/rag/status')
async def get_rag_status(user: dict = Depends(require_roles('ADMIN'))):
    try:
        return api_response(200, True, 'Đã tải trạng thái RAG.', {'rag': agent_rag_service.status()})
    except Exception as exc:
        return api_response(503, False, 'Chưa thể đọc trạng thái RAG.',
                            {'reason': type(exc).__name__}, 'RAG_UNAVAILABLE')


@router.post('/api/admin/agent/rag/reindex')
async def reindex_rag(user: dict = Depends(require_roles('ADMIN'))):
    try:
        result = await agent_rag_service.reindex(enable_embeddings=True)
        return api_response(200 if not result['failedDocuments'] else 207,
                            not bool(result['failedDocuments']),
                            'Đã lập chỉ mục RAG.' if not result['failedDocuments'] else 'Lập chỉ mục RAG hoàn tất nhưng có nguồn thất bại.',
                            result, 'RAG_PARTIAL_FAILURE' if result['failedDocuments'] else None)
    except Exception as exc:
        return api_response(503, False, 'Không thể lập chỉ mục RAG.',
                            {'reason': type(exc).__name__}, 'RAG_REINDEX_FAILED')
