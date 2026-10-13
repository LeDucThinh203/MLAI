"""User-scoped persistence helpers for the AI Agent."""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from app.config import JWT_SECRET
from app.db.database import get_all, get_db_connection, get_one, run_query


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def _decode(value: Any, fallback: Any = None) -> Any:
    if not value:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def new_id(prefix: str) -> str:
    return f'{prefix}_{secrets.token_urlsafe(18)}'


def create_conversation(user_id: str, title: str = 'Cuộc trò chuyện mới') -> dict:
    now = _now()
    row = {'id': new_id('conv'), 'user_id': user_id, 'title': title[:255], 'created_at': now, 'updated_at': now}
    run_query('INSERT INTO agent_conversations (id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)',
              tuple(row.values()))
    return row


def get_conversation(conversation_id: str, user_id: str) -> dict | None:
    row = get_one('SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?', (conversation_id, user_id))
    return dict(row) if row else None


def list_conversations(user_id: str, limit: int = 50) -> list[dict]:
    return get_all('SELECT id,user_id,title,created_at,updated_at FROM agent_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
                   (user_id, max(1, min(100, limit))))


def delete_conversation(conversation_id: str, user_id: str) -> bool:
    return bool(run_query('DELETE FROM agent_conversations WHERE id = ? AND user_id = ?', (conversation_id, user_id))['changes'])


def add_message(conversation_id: str, user_id: str, role: str, content: str, metadata: dict | None = None) -> dict:
    row = {'id': new_id('msg'), 'conversation_id': conversation_id, 'user_id': user_id,
           'role': role, 'content': content, 'metadata': _json(metadata or {}), 'created_at': _now()}
    run_query('INSERT INTO agent_messages (id,conversation_id,user_id,role,content,metadata,created_at) VALUES (?,?,?,?,?,?,?)',
              (row['id'], row['conversation_id'], row['user_id'], row['role'], row['content'], row['metadata'], row['created_at']))
    run_query('UPDATE agent_conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
              (row['created_at'], conversation_id, user_id))
    row['metadata'] = metadata or {}
    return row


def list_messages(conversation_id: str, user_id: str, limit: int = 100) -> list[dict]:
    rows = get_all('''SELECT m.id,m.conversation_id,m.user_id,m.role,m.content,m.metadata,m.created_at
        FROM agent_messages m INNER JOIN agent_conversations c ON c.id=m.conversation_id
        WHERE m.conversation_id=? AND m.user_id=? AND c.user_id=?
        ORDER BY m.created_at DESC LIMIT ?''', (conversation_id, user_id, user_id, max(1, min(200, limit))))
    rows.reverse()
    for row in rows:
        row['metadata'] = _decode(row.get('metadata'), {})
    return rows


def arguments_hash(tool_name: str, arguments: dict) -> str:
    payload = _json({'tool': tool_name, 'arguments': arguments}).encode('utf-8')
    return hmac.new(JWT_SECRET.encode('utf-8'), payload, hashlib.sha256).hexdigest()


def create_pending_action(user_id: str, conversation_id: str, tool_name: str, arguments: dict,
                          preview: dict, role: str, expires_at: str) -> dict:
    now, action_id = _now(), new_id('act')
    digest = arguments_hash(tool_name, arguments)
    run_query('''INSERT INTO agent_pending_actions
        (id,user_id,conversation_id,tool_name,arguments,arguments_hash,preview,role_at_request,status,expires_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
        (action_id, user_id, conversation_id, tool_name, _json(arguments), digest, _json(preview), role,
         'PENDING', expires_at, now, now))
    return {'id': action_id, 'user_id': user_id, 'conversation_id': conversation_id, 'tool_name': tool_name,
            'arguments': arguments, 'arguments_hash': digest, 'preview': preview, 'role_at_request': role,
            'status': 'PENDING', 'expires_at': expires_at, 'created_at': now}


def get_pending_action(action_id: str, user_id: str) -> dict | None:
    row = get_one('SELECT * FROM agent_pending_actions WHERE id=? AND user_id=?', (action_id, user_id))
    if not row:
        return None
    row = dict(row)
    row['arguments'] = _decode(row.get('arguments'), {})
    row['preview'] = _decode(row.get('preview'), {})
    return row


def claim_pending_action(action_id: str, user_id: str) -> dict | None:
    """Atomically claim one action; concurrent/double confirmation can execute once only."""
    now = _now()
    result = run_query('''UPDATE agent_pending_actions SET status='EXECUTING',updated_at=?
        WHERE id=? AND user_id=? AND status='PENDING' AND expires_at > ?''',
        (now, action_id, user_id, now))
    return get_pending_action(action_id, user_id) if result['changes'] else None


def set_action_status(action_id: str, user_id: str, status: str) -> None:
    action = get_one('SELECT conversation_id FROM agent_pending_actions WHERE id=? AND user_id=?', (action_id, user_id))
    run_query('UPDATE agent_pending_actions SET status=?,updated_at=? WHERE id=? AND user_id=? AND status IN (\'PENDING\',\'EXECUTING\')',
              (status, _now(), action_id, user_id))
    if action:
        update_pending_message_status(action['conversation_id'], action_id, user_id, status)


def update_pending_message_status(conversation_id: str, action_id: str, user_id: str, status: str) -> None:
    rows = get_all('''SELECT id,metadata FROM agent_messages
        WHERE conversation_id=? AND user_id=? AND role='ASSISTANT' ''', (conversation_id, user_id))
    for row in rows:
        metadata = _decode(row.get('metadata'), {})
        pending = metadata.get('pendingAction') if isinstance(metadata, dict) else None
        if isinstance(pending, dict) and pending.get('actionId') == action_id:
            pending['status'] = status
            run_query('UPDATE agent_messages SET metadata=? WHERE id=? AND user_id=?',
                      (_json(metadata), row['id'], user_id))


def cancel_action(action_id: str, user_id: str) -> bool:
    now = _now()
    changed = bool(run_query('''UPDATE agent_pending_actions SET status='CANCELLED',updated_at=?
        WHERE id=? AND user_id=? AND status='PENDING' AND expires_at > ?''',
        (now, action_id, user_id, now))['changes'])
    action = get_one('SELECT conversation_id FROM agent_pending_actions WHERE id=? AND user_id=?', (action_id, user_id))
    if changed and action:
        update_pending_message_status(action['conversation_id'], action_id, user_id, 'CANCELLED')
    return changed


def save_document(document: dict, chunks: list[dict]) -> None:
    """Replace one allowlisted source in the RAG index."""
    with get_db_connection() as connection, connection.cursor() as cursor:
        cursor.execute('DELETE FROM rag_documents WHERE id=%s', (document['id'],))
        cursor.execute('''INSERT INTO rag_documents
            (id,source_key,source_path,title,source_type,priority,version,content_hash,updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
            (document['id'], document['source_key'], document['source_path'], document['title'], document['source_type'],
             document['priority'], document['version'], document['content_hash'], document['updated_at']))
        for chunk in chunks:
            cursor.execute('''INSERT INTO rag_chunks
                (id,document_id,source_key,source_path,title,heading,source_type,priority,version,chunk_index,content,
                 embedding,embedding_provider,embedding_model,embedding_dimension,created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                (chunk['id'], chunk['document_id'], chunk['source_key'], chunk['source_path'], chunk['title'], chunk['heading'],
                 chunk['source_type'], chunk['priority'], chunk['version'], chunk['chunk_index'], chunk['content'],
                 _json(chunk['embedding']) if chunk.get('embedding') is not None else None,
                 chunk.get('embedding_provider'), chunk.get('embedding_model'), chunk.get('embedding_dimension'), _now()))


def list_rag_chunks() -> list[dict]:
    return get_all('SELECT * FROM rag_chunks ORDER BY source_key,chunk_index')


def rag_status() -> dict:
    documents = get_one('SELECT COUNT(*) AS count FROM rag_documents') or {'count': 0}
    chunks = get_one('SELECT COUNT(*) AS count FROM rag_chunks') or {'count': 0}
    enriched = get_one('SELECT COUNT(*) AS count FROM rag_chunks WHERE embedding IS NOT NULL') or {'count': 0}
    models = get_all('SELECT embedding_provider,embedding_model,COUNT(*) AS count FROM rag_chunks WHERE embedding IS NOT NULL GROUP BY embedding_provider,embedding_model')
    return {'documents': int(documents['count']), 'chunks': int(chunks['count']),
            'embeddedChunks': int(enriched['count']), 'embeddingModels': models}
