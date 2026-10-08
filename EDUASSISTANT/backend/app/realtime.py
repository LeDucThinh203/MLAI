"""Authenticated WebSocket rooms used for live case-discussion updates."""
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class CaseCommentHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, case_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[case_id].add(websocket)

    def disconnect(self, case_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(case_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(case_id, None)

    async def broadcast(self, case_id: str, event: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for connection in tuple(self._rooms.get(case_id, ())):
            try:
                await connection.send_json(event)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(case_id, connection)


comment_hub = CaseCommentHub()


class CaseEventHub:
    """Live queue for reviewers and administrators watching case changes."""
    def __init__(self) -> None:
        self._connections: dict[WebSocket, dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, identity: dict[str, str]) -> None:
        await websocket.accept()
        self._connections[websocket] = identity

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.pop(websocket, None)

    async def broadcast(self, event: dict[str, Any], roles: set[str] | None = None, user_ids: set[str] | None = None) -> None:
        stale: list[WebSocket] = []
        for connection, identity in tuple(self._connections.items()):
            if roles and identity.get('role') not in roles:
                continue
            if user_ids and identity.get('id') not in user_ids:
                continue
            try:
                await connection.send_json(event)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


case_event_hub = CaseEventHub()
