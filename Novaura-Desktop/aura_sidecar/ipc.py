"""
AURA NOVA - IPC BRIDGE
PURPOSE: stdin/stdout JSON protocol between Rust (Tauri) and Python (Aura)

Protocol:
  Rust → Python (stdin):  { "id": "uuid", "type": "chat|recall|engram|status", "payload": {...} }
  Python → Rust (stdout): { "id": "uuid", "type": "response|stream|event|error", "payload": {...} }

All stdout is NDJSON (newline-delimited) — one JSON object per line.
Rust reads line-by-line, parses each JSON message independently.
NOTHING else goes to stdout — logs go to file only.
"""

import sys
import json
import asyncio
import logging
from typing import Any

log = logging.getLogger("aura_sidecar.ipc")


def _write(obj: dict):
    """Write a single JSON line to stdout and flush immediately."""
    try:
        line = json.dumps(obj, ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()
    except Exception as e:
        log.error(f"[IPC] Write failed: {e}")


class IPCBridge:
    def __init__(self, memory, inference, nodes: dict, tier: str):
        self.memory = memory
        self.inference = inference
        self.nodes = nodes
        self.tier = tier

    def emit(self, event_type: str, payload: Any, msg_id: str = None):
        """Send an unsolicited event to Rust."""
        _write({"id": msg_id, "type": event_type, "payload": payload})

    def reply(self, msg_id: str, payload: Any, msg_type: str = "response"):
        """Send a reply to a specific Rust request."""
        _write({"id": msg_id, "type": msg_type, "payload": payload})

    def error(self, msg_id: str, message: str):
        _write({"id": msg_id, "type": "error", "payload": {"message": message}})

    async def run_loop(self):
        """
        Main async read loop — reads stdin line by line,
        dispatches to handlers, replies via stdout.
        """
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)

        while True:
            try:
                raw = await reader.readline()
                if not raw:
                    log.info("[IPC] stdin closed — shutting down")
                    break

                line = raw.decode("utf-8").strip()
                if not line:
                    continue

                try:
                    msg = json.loads(line)
                except json.JSONDecodeError as e:
                    log.warning(f"[IPC] Bad JSON: {e}")
                    continue

                msg_id = msg.get("id", "unknown")
                msg_type = msg.get("type", "")
                payload = msg.get("payload", {})

                asyncio.create_task(self._dispatch(msg_id, msg_type, payload))

            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"[IPC] Loop error: {e}")

    async def _dispatch(self, msg_id: str, msg_type: str, payload: dict):
        """Route incoming message to the correct handler."""
        try:
            if msg_type == "chat":
                await self._handle_chat(msg_id, payload)

            elif msg_type == "stream_chat":
                await self._handle_stream_chat(msg_id, payload)

            elif msg_type == "recall":
                await self._handle_recall(msg_id, payload)

            elif msg_type == "engram_store":
                await self._handle_engram_store(msg_id, payload)

            elif msg_type == "fact_check":
                await self._handle_fact_check(msg_id, payload)

            elif msg_type == "status":
                self.reply(msg_id, {
                    "tier": self.tier,
                    "nodes": len(self.nodes),
                    "memory_ready": self.memory.is_ready(),
                    "model": self.inference.model_name,
                })

            elif msg_type == "ping":
                self.reply(msg_id, {"pong": True})

            else:
                self.error(msg_id, f"Unknown message type: {msg_type}")

        except Exception as e:
            log.error(f"[IPC] Dispatch error on {msg_type}: {e}")
            self.error(msg_id, str(e))

    async def _handle_chat(self, msg_id: str, payload: dict):
        """Single-shot chat — returns complete response."""
        user_input = payload.get("input", "")
        context = payload.get("context", {})

        result = await self.inference.chat(user_input, context)

        self.reply(msg_id, {
            "text": result["text"],
            "engrams_used": result.get("engrams_used", 0),
            "rag_used": result.get("rag_used", False),
            "fact_checked": result.get("fact_checked", False),
            "emotional_state": result.get("emotional_state", {}),
        })

    async def _handle_stream_chat(self, msg_id: str, payload: dict):
        """
        Streaming chat — emits token chunks as they arrive.
        Rust reads stream_chunk events until stream_end.
        """
        user_input = payload.get("input", "")
        context = payload.get("context", {})

        async for chunk in self.inference.chat_stream(user_input, context):
            if chunk.get("done"):
                self.reply(msg_id, {
                    "engrams_used": chunk.get("engrams_used", 0),
                    "emotional_state": chunk.get("emotional_state", {}),
                }, msg_type="stream_end")
            else:
                self.reply(msg_id, {"token": chunk["token"]}, msg_type="stream_chunk")

    async def _handle_recall(self, msg_id: str, payload: dict):
        """Query engram memory and return relevant memories."""
        query = payload.get("query", "")
        limit = payload.get("limit", 12)

        results = await self.memory.recall(query, limit=limit)
        self.reply(msg_id, {"memories": results})

    async def _handle_engram_store(self, msg_id: str, payload: dict):
        """Manually store an engram."""
        content = payload.get("content", "")
        category = payload.get("category", "interaction")
        tags = payload.get("tags", [])
        emotional_valence = payload.get("emotional_valence", 0.0)

        engram_id = await self.memory.store_engram(
            content=content,
            category=category,
            tags=tags,
            emotional_valence=emotional_valence,
        )
        self.reply(msg_id, {"engram_id": engram_id, "stored": True})

    async def _handle_fact_check(self, msg_id: str, payload: dict):
        """Run a claim through the CriticalThinkingEngine + RAG."""
        claim = payload.get("claim", "")
        result = await self.inference.fact_check(claim)
        self.reply(msg_id, result)
