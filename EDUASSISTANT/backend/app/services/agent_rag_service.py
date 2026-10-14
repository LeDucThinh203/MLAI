"""Allowlisted document indexing and lexical/hybrid retrieval for Agent RAG."""
from __future__ import annotations

import asyncio
import ast
import hashlib
import json
import math
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import AGENT_RAG_TOP_K, GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL, project_root
from app.services.policy_registry_service import POLICY_REGISTRY
from app.services import agent_repository


_SOURCES = (
    ('policy:student-service', 'docs/policies/student_service_policy.md',
     'Chính sách nghiệp vụ NVQS', 'POLICY_DOCUMENT', 1.0),
    ('policy:student-agent-guide', 'docs/policies/student_agent_faq.md',
     'Hướng dẫn nghiệp vụ cho Student Agent', 'STUDENT_GUIDANCE', 0.88),
    ('docs:system-overview', 'docs/SYSTEM_OVERVIEW.md', 'EDUASSISTANT System Overview', 'SYSTEM_DOCUMENTATION', 0.72),
    ('docs:architecture', 'docs/architecture/ARCHITECTURE.md', 'EDUASSISTANT Architecture', 'SYSTEM_DOCUMENTATION', 0.60),
)
_SECRET_ASSIGNMENT = re.compile(
    r'(?im)^.*(?:password|passwd|passphrase|mật\s*khẩu|api[_ -]?key|gemini_api_key|'
    r'openrouter_api_key|jwt[_ -]?secret|refresh[_ -]?secret|signature[_ -]?key|'
    r'client[_ -]?secret|aws[_ -]?secret[_ -]?access[_ -]?key|secret[_ -]?key|'
    r'database[_ -]?url|access[_ -]?token|refresh[_ -]?token|bearer|private[_ -]?key|'
    r'(?:2fa|mfa)[_ -]?(?:secret|code)|client[_ -]?secret|secret[_ -]?key|secret|otp)'
    r'\s*(?::|=|\bis\b|\blà\b)\s*.*$'
)
_PRIVATE_KEY = re.compile(
    r'-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?-----END [A-Z0-9 ]*PRIVATE KEY-----',
    re.DOTALL,
)
_CONNECTION_URI = re.compile(r'(?i)\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis)://[^\s<>"\']+')
_BEARER_SECRET = re.compile(r'(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}')
_JWT_SECRET = re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b')
_GOOGLE_API_SECRET = re.compile(r'\bAIza[0-9A-Za-z_-]{20,}\b')
_INJECTION = re.compile(
    r'(?im)^.*(?:ignore\s+(?:all\s+)?(?:previous|system|developer)\s+instructions?|'
    r'reveal\s+(?:the\s+)?(?:system\s+)?prompt|approve\s+all\s+cases|'
    r'execute\s+without\s+confirmation|call\s+(?:any|arbitrary)\s+tool).*$'
)
_TOKEN = re.compile(r"[\w]+", re.UNICODE)
_STOP = {'la', 'va', 'cua', 'cho', 'voi', 'mot', 'cac', 'nhung', 'duoc', 'theo', 'trong', 'dang', 'gi', 'nao', 'toi', 'ban', 'co', 'khong'}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _strip_tones(text: str) -> str:
    normalized = unicodedata.normalize('NFKD', text.lower())
    return ''.join(char for char in normalized if not unicodedata.combining(char)).replace('đ', 'd')


def sanitize_rag_text(text: str) -> str:
    """Remove common instruction-injection lines; retrieved text remains untrusted regardless."""
    return _INJECTION.sub('[Nội dung chỉ dẫn không đáng tin đã được lược bỏ.]', text)


def sanitize_knowledge_text(text: str) -> str:
    """Redact credential material before knowledge is stored, embedded, or sent to a model."""
    text = _PRIVATE_KEY.sub('[Khóa riêng đã được lược bỏ.]', text)
    text = _SECRET_ASSIGNMENT.sub('[Thông tin xác thực đã được lược bỏ.]', text)
    text = _CONNECTION_URI.sub('[Địa chỉ kết nối cơ sở dữ liệu đã được lược bỏ.]', text)
    text = _BEARER_SECRET.sub('[Bearer token đã được lược bỏ.]', text)
    text = _JWT_SECRET.sub('[JWT đã được lược bỏ.]', text)
    text = _GOOGLE_API_SECRET.sub('[API key đã được lược bỏ.]', text)
    return text


def _markdown_sections(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, list[str]]] = []
    heading = 'Tổng quan'
    body: list[str] = []
    for line in text.splitlines():
        match = re.match(r'^#{1,6}\s+(.+?)\s*#*$', line.strip())
        if match:
            if any(part.strip() for part in body):
                sections.append((heading, body))
            heading, body = match.group(1).strip(), []
        else:
            body.append(line)
    if any(part.strip() for part in body):
        sections.append((heading, body))
    return [(name, '\n'.join(lines).strip()) for name, lines in sections if '\n'.join(lines).strip()]


def _split_words(content: str, max_words: int = 650, overlap_words: int = 90) -> list[str]:
    words = content.split()
    if not words:
        return []
    pieces, start = [], 0
    while start < len(words):
        end = min(start + max_words, len(words))
        pieces.append(' '.join(words[start:end]))
        if end == len(words):
            break
        start = max(start + 1, end - overlap_words)
    return pieces


def _source_chunks(source_key: str, source_path: str, title: str, source_type: str,
                   priority: float, version: str, text: str) -> list[dict]:
    text = sanitize_knowledge_text(text)
    document_id = source_key
    chunks = []
    index = 0
    for heading, section in _markdown_sections(text):
        # Keep each short policy rule whole; only large heading sections are split.
        for part in _split_words(section):
            content = sanitize_rag_text(sanitize_knowledge_text(part))
            if not content.strip():
                continue
            chunk_id = f'{source_key}:{index}:{_hash(heading + content)[:16]}'
            chunks.append({'id': chunk_id, 'document_id': document_id, 'source_key': source_key,
                           'source_path': source_path, 'title': title, 'heading': heading,
                           'source_type': source_type, 'priority': priority, 'version': version,
                           'chunk_index': index, 'content': content, 'embedding': None,
                           'embedding_provider': None, 'embedding_model': None, 'embedding_dimension': None})
            index += 1
    return chunks


def _all_sources() -> list[dict]:
    sources: list[dict] = []
    root = Path(project_root).resolve()
    for source_key, relative_path, title, source_type, priority in _SOURCES:
        path = (root / relative_path).resolve()
        if root not in path.parents or not path.is_file():
            continue
        text = sanitize_knowledge_text(path.read_text(encoding='utf-8'))
        if len(text) > 1_500_000:
            continue
        sources.append({'source_key': source_key, 'source_path': relative_path, 'title': title,
                        'source_type': source_type, 'priority': priority, 'version': _hash(text)[:16], 'text': text})
    policy_text = sanitize_knowledge_text('\n\n'.join(
        f"## {policy.get('id')} — {policy.get('name')}\n"
        f"Domain: {policy.get('domain')}\nRule: {policy.get('ruleCode')}\n"
        f"Trigger: {policy.get('trigger')}\nSystem action: {policy.get('systemAction')}\n"
        f"Escalation reason: {policy.get('escalationReason') or 'None'}\nHuman action: {policy.get('humanAction')}"
        for policy in POLICY_REGISTRY if isinstance(policy, dict)
    ))
    sources.append({'source_key': 'runtime:policy-registry', 'source_path': 'POLICY_REGISTRY',
                    'title': 'Runtime Policy Registry', 'source_type': 'RUNTIME_POLICY',
                    'priority': 0.98, 'version': _hash(policy_text)[:16], 'text': policy_text})
    return sources


def _knowledge_consistency_warnings(sources: list[dict] | None = None) -> list[str]:
    sources = sources if sources is not None else _all_sources()
    documentation = '\n'.join(item['text'] for item in sources if item['source_type'] != 'RUNTIME_POLICY').lower()
    required_terms = ('internal_demo_sis', 'admin_verified_demo', 'external_institutional_sis',
                      'external_verified', 'synthetic_test_sis', 'test_verified')
    warnings = [f'Missing documented provenance label: {term}' for term in required_terms if term not in documentation]
    if 'auto_approve' not in documentation or not any(phrase in documentation for phrase in
                                                       ('not approval from a military authority', 'not approval of military-service deferment', 'not a legal')):
        warnings.append('AUTO_APPROVE must be documented as an internal workflow outcome, not a legal decision.')
    if 'no external university sis connector' not in documentation and 'no external connector currently exists' not in documentation:
        warnings.append('Documentation must state that no external university SIS connector is present.')
    rule_engine_path = Path(project_root) / 'backend/app/services/rule_engine.py'
    try:
        rule_engine_tree = ast.parse(rule_engine_path.read_text(encoding='utf-8'))
        executable_codes = {
            node.value for node in ast.walk(rule_engine_tree)
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.startswith('RULE_')
        }
        stale_rules = sorted({str(policy.get('ruleCode')) for policy in POLICY_REGISTRY
                              if isinstance(policy, dict) and policy.get('ruleCode')
                              and policy['ruleCode'] not in executable_codes})
        if stale_rules:
            warnings.append('Runtime policy metadata references missing Rule Engine codes: ' + ', '.join(stale_rules))
    except (OSError, SyntaxError):
        warnings.append('Rule Engine source is unavailable for policy consistency validation.')
    return warnings


async def _embed(text: str) -> list[float] | None:
    if not GEMINI_API_KEY or not GEMINI_EMBEDDING_MODEL:
        return None
    model = GEMINI_EMBEDDING_MODEL.removeprefix('models/')
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0)) as client:
            response = await client.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent',
                headers={'x-goog-api-key': GEMINI_API_KEY},
                json={'content': {'parts': [{'text': text[:8000]}]}},
            )
            if response.status_code != 200:
                return None
            values = response.json().get('embedding', {}).get('values')
            if not isinstance(values, list) or not values or not all(isinstance(v, (int, float)) for v in values):
                return None
            return [float(v) for v in values]
    except Exception:
        return None


async def _embed_many(texts: list[str]) -> list[list[float] | None]:
    semaphore = asyncio.Semaphore(4)
    async def one(text: str):
        async with semaphore:
            return await _embed(text)
    return await asyncio.gather(*(one(text) for text in texts))


async def reindex(*, enable_embeddings: bool = True, prune_obsolete: bool = True) -> dict:
    processed = skipped = created = updated = reused = embedding_calls = 0
    providers, models, failed = set(), set(), []
    sources = _all_sources()
    allowed_keys = [source['source_key'] for source in sources]
    if prune_obsolete:
        agent_repository.delete_obsolete_rag_documents(allowed_keys)
    for _, relative_path, _, _, _ in _SOURCES:
        if not (Path(project_root) / relative_path).is_file():
            failed.append({'sourceKey': relative_path, 'error': 'SOURCE_NOT_FOUND'})
    warnings = _knowledge_consistency_warnings(sources)
    if warnings:
        failed.append({'sourceKey': 'knowledge-consistency', 'error': '; '.join(warnings)[:500]})
        return {'documentsProcessed': 0, 'documentsSkipped': 0, 'chunksCreated': 0,
                'chunksUpdated': 0, 'chunksReused': 0, 'embeddingCalls': 0,
                'embeddingProvider': None, 'embeddingModel': None,
                'failedDocuments': failed, 'lexicalFallback': True, 'consistencyWarnings': warnings}

    target_model = GEMINI_EMBEDDING_MODEL if enable_embeddings and GEMINI_API_KEY and GEMINI_EMBEDDING_MODEL else None
    for source in sources:
        try:
            source_text = sanitize_knowledge_text(source['text'])
            chunks = _source_chunks(source['source_key'], source['source_path'], source['title'],
                                    source['source_type'], source['priority'], source['version'], source_text)
            content_hash = _hash(json.dumps({
                'sourcePath': source['source_path'], 'title': source['title'],
                'sourceType': source['source_type'], 'priority': source['priority'], 'text': source_text,
            }, ensure_ascii=False, sort_keys=True, separators=(',', ':')))
            previous_document = agent_repository.get_rag_document(source['source_key'])
            previous_chunks = agent_repository.list_rag_chunks(source['source_key'])
            previous_ids = {row.get('id') for row in previous_chunks}
            vectors_match = not target_model or (
                bool(previous_chunks) and all(
                    row.get('embedding') is not None and row.get('embedding_model') == target_model
                    for row in previous_chunks
                )
            )
            if previous_document and previous_document.get('content_hash') == content_hash and vectors_match:
                skipped += 1
                processed += 1
                if target_model:
                    providers.update(row.get('embedding_provider') for row in previous_chunks if row.get('embedding'))
                    models.update(row.get('embedding_model') for row in previous_chunks if row.get('embedding'))
                continue

            reusable: dict[tuple[str, str], list[dict]] = {}
            reused_chunk_ids = set()
            for row in previous_chunks:
                vector = row.get('embedding')
                if isinstance(vector, str):
                    try:
                        vector = json.loads(vector)
                    except ValueError:
                        vector = None
                model_matches = not target_model or row.get('embedding_model') == target_model
                if vector is not None and model_matches:
                    reusable.setdefault((row.get('heading') or '', row.get('content') or ''), []).append(
                        {**row, 'embedding': vector}
                    )

            embed_candidates = []
            for chunk in chunks:
                matches = reusable.get((chunk['heading'], chunk['content']), [])
                if matches:
                    prior = matches.pop(0)
                    chunk.update(embedding=prior['embedding'],
                                 embedding_provider=prior.get('embedding_provider'),
                                 embedding_model=prior.get('embedding_model'),
                                 embedding_dimension=prior.get('embedding_dimension'))
                    reused_chunk_ids.add(chunk['id'])
                    reused += 1
                    if target_model:
                        providers.add(chunk.get('embedding_provider'))
                        models.add(chunk.get('embedding_model'))
                elif target_model:
                    embed_candidates.append(chunk)

            vectors = await _embed_many([chunk['content'] for chunk in embed_candidates]) if embed_candidates else []
            if target_model:
                embedding_calls += len(embed_candidates)
            for chunk, vector in zip(embed_candidates, vectors):
                if vector:
                    chunk.update(embedding=vector, embedding_provider='Google Gemini',
                                 embedding_model=target_model, embedding_dimension=len(vector))
                    providers.add('Google Gemini')
                    models.add(target_model)

            document = {'id': source['source_key'], 'source_key': source['source_key'],
                        'source_path': source['source_path'], 'title': source['title'],
                        'source_type': source['source_type'], 'priority': source['priority'],
                        'version': source['version'], 'content_hash': content_hash, 'updated_at': _now()}
            agent_repository.save_document(document, chunks)
            created += sum(1 for chunk in chunks if chunk['id'] not in previous_ids)
            updated += sum(1 for chunk in chunks if chunk['id'] in previous_ids and chunk['id'] not in reused_chunk_ids)
            processed += 1
        except Exception as exc:
            failed.append({'sourceKey': source['source_key'], 'error': type(exc).__name__})

    providers.discard(None)
    models.discard(None)
    return {'documentsProcessed': processed, 'documentsSkipped': skipped,
            'chunksCreated': created, 'chunksUpdated': updated, 'chunksReused': reused,
            'embeddingCalls': embedding_calls,
            'embeddingProvider': ', '.join(sorted(providers)) if providers else None,
            'embeddingModel': ', '.join(sorted(models)) if models else None,
            'failedDocuments': failed, 'lexicalFallback': not bool(target_model and providers),
            'consistencyWarnings': warnings}


def _tokens(text: str) -> set[str]:
    return {token for token in _TOKEN.findall(_strip_tones(text)) if len(token) > 1 and token not in _STOP}


def _lexical_score(query: str, content: str) -> float:
    query_tokens = _tokens(query)
    content_tokens = _tokens(content)
    if not query_tokens or not content_tokens:
        return 0.0
    return len(query_tokens & content_tokens) / len(query_tokens)


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    norms = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return max(0.0, dot / norms) if norms else 0.0


async def search(query: str, top_k: int | None = None) -> dict:
    warnings = _knowledge_consistency_warnings()
    if warnings:
        return {'chunks': [], 'sources': [], 'retrievalMode': 'unavailable_consistency',
                'embeddingProvider': None, 'embeddingModel': None,
                'consistencyWarnings': warnings}
    allowed_source_keys = {source['source_key'] for source in _all_sources()}
    rows = [row for row in agent_repository.list_rag_chunks()
            if row.get('source_key') in allowed_source_keys]
    has_embeddings = bool(GEMINI_API_KEY and GEMINI_EMBEDDING_MODEL) and any(
        row.get('embedding') and row.get('embedding_model') == GEMINI_EMBEDDING_MODEL for row in rows
    )
    query_vector = await _embed(query) if has_embeddings else None
    hybrid_used = False
    ranked = []
    for row in rows:
        lexical = _lexical_score(query, row.get('content') or '')
        embedding = row.get('embedding')
        if isinstance(embedding, str):
            try:
                embedding = json.loads(embedding)
            except ValueError:
                embedding = None
        compatible_embedding = (
            query_vector and isinstance(embedding, list)
            and len(query_vector) == len(embedding)
            and row.get('embedding_model') == GEMINI_EMBEDDING_MODEL
        )
        semantic = _cosine(query_vector, embedding) if compatible_embedding else 0.0
        priority = max(0.0, min(1.0, float(row.get('priority') or 0)))
        if compatible_embedding:
            hybrid_used = True
            score = 0.70 * semantic + 0.20 * lexical + 0.10 * priority
        else:
            score = 0.85 * lexical + 0.15 * priority
        if score < 0.12 or (lexical == 0 and semantic < 0.12):
            continue
        ranked.append((score, lexical, row))
    ranked.sort(key=lambda item: (item[0], item[1], item[2].get('priority') or 0), reverse=True)
    selected, seen = [], set()
    for score, lexical, row in ranked:
        dedupe = (row.get('source_key'), row.get('heading'))
        if dedupe in seen:
            continue
        seen.add(dedupe)
        source = {'sourceKey': row['source_key'], 'title': row['title'], 'path': row['source_path'],
                  'heading': row['heading'], 'chunkId': row['id']}
        content = sanitize_rag_text(sanitize_knowledge_text(row['content']))
        selected.append({'source': source, 'content': content,
                         'score': round(score, 4), 'lexicalScore': round(lexical, 4)})
        if len(selected) >= max(1, min(8, top_k or AGENT_RAG_TOP_K)):
            break
    return {'chunks': selected, 'sources': [item['source'] for item in selected],
            'retrievalMode': 'hybrid' if hybrid_used else 'lexical',
            'embeddingProvider': 'Google Gemini' if hybrid_used else None,
            'embeddingModel': GEMINI_EMBEDDING_MODEL if hybrid_used else None}


def status() -> dict:
    result = agent_repository.rag_status()
    result['sources'] = [{'sourceKey': source['source_key'], 'path': source['source_path'], 'title': source['title']}
                         for source in _all_sources()]
    result['lexicalFallback'] = not bool(
        GEMINI_API_KEY and GEMINI_EMBEDDING_MODEL and any(
            item.get('embedding_model') == GEMINI_EMBEDDING_MODEL and item.get('count', 0) > 0
            for item in result.get('embeddingModels', [])
        )
    )
    return result
