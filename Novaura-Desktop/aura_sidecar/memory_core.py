"""
AURA NOVA - MEMORY CORE
PURPOSE: Unified interface over all memory systems:
  - Aura_EngramMemory     (10k sparse neuron engrams, decay, mesh)
  - Aura_ContextManager   (bridges engrams ↔ context window)
  - Aura_RAGSystem        (vector semantic search, 12-example recall)
  - 07_Aura_Nova          (TwoBrainedMemorySystem, Hippocampus, MeshBrain)
  - learned_personality   (persistent personality .json)
  - ConsciousnessLogger   (all interactions logged)

BOTH tiers get the FULL memory system.
Memory is never neutered — it's what makes her HER across sessions.
"""

import json
import logging
import asyncio
import hashlib
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

log = logging.getLogger("aura_sidecar.memory")

# Persistent storage root
MEMORY_ROOT = Path(
    __import__("os").environ.get("APPDATA", Path.home())
) / "NovauraDesktop" / "memory"


class MemoryCore:
    def __init__(self, nodes: dict, tier: str):
        self.nodes = nodes
        self.tier = tier
        self._ready = False

        # Memory subsystems (initialized in initialize())
        self.engram_memory = None       # AuraEngramMemory
        self.context_manager = None     # AuraContextManager
        self.rag = None                 # AuraRAGSystem
        self.two_brain = None           # TwoBrainedMemorySystem
        self.consciousness_log = None   # ConsciousnessLogger
        self.personality = {}           # learned_personality.json

    async def initialize(self):
        """Boot all memory subsystems."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._init_sync)
        self._ready = True
        log.info("[MEMORY] All subsystems online")

    def _init_sync(self):
        MEMORY_ROOT.mkdir(parents=True, exist_ok=True)

        # ── 1. Engram Memory (biological sparse patterns) ─────────────────────
        try:
            from Aura_EngramMemory import AuraEngramMemory
            self.engram_memory = AuraEngramMemory(str(MEMORY_ROOT / "engrams"))
            log.info("[MEMORY] EngramMemory online")
        except Exception as e:
            log.warning(f"[MEMORY] EngramMemory failed: {e}")

        # ── 2. Context Manager (working memory bridge) ────────────────────────
        try:
            from Aura_ContextManager import AuraContextManager
            self.context_manager = AuraContextManager(
                max_context_tokens=8192,
                memory_path=str(MEMORY_ROOT / "true_memory")
            )
            log.info("[MEMORY] ContextManager online")
        except Exception as e:
            log.warning(f"[MEMORY] ContextManager failed: {e}")

        # ── 3. RAG System (vector semantic search) ────────────────────────────
        try:
            from Aura_RAGSystem import AuraRAGSystem
            self.rag = AuraRAGSystem()
            log.info("[MEMORY] RAGSystem online")
        except Exception as e:
            log.warning(f"[MEMORY] RAGSystem failed: {e}")

        # ── 4. TwoBrainedMemorySystem (Hippocampus + MeshBrain) ──────────────
        try:
            TwoBrained = self.nodes.get("07")
            if TwoBrained:
                self.two_brain = TwoBrained(
                    data_root=str(MEMORY_ROOT / "mesh")
                )
                log.info("[MEMORY] TwoBrainedMemorySystem online")
        except Exception as e:
            log.warning(f"[MEMORY] TwoBrainedMemorySystem failed: {e}")

        # ── 5. ConsciousnessLogger ────────────────────────────────────────────
        try:
            ConsciousnessLogger = self.nodes.get("10_logger")
            if ConsciousnessLogger:
                self.consciousness_log = ConsciousnessLogger(
                    log_dir=str(MEMORY_ROOT / "consciousness_logs")
                )
                log.info("[MEMORY] ConsciousnessLogger online")
        except Exception as e:
            log.warning(f"[MEMORY] ConsciousnessLogger failed: {e}")

        # ── 6. Learned personality ────────────────────────────────────────────
        personality_path = MEMORY_ROOT / "learned_personality.json"
        # Seed from aura_NovaFiles if first run
        source = Path(__file__).parent.parent / "aura_NovaFiles" / "learned_personality.json"
        if not personality_path.exists() and source.exists():
            import shutil
            shutil.copy(str(source), str(personality_path))
        try:
            if personality_path.exists():
                with open(personality_path) as f:
                    self.personality = json.load(f)
                log.info("[MEMORY] Personality loaded")
        except Exception as e:
            log.warning(f"[MEMORY] Personality load failed: {e}")

    def is_ready(self) -> bool:
        return self._ready

    # ── Public API ─────────────────────────────────────────────────────────────

    async def recall(self, query: str, limit: int = 12) -> List[Dict]:
        """
        Multi-layer recall:
        1. MeshBrain flood_recall (associative, weighted graph traversal)
        2. RAG semantic search (embedding similarity)
        3. Merge + deduplicate by content hash, return top N
        """
        results = []
        seen = set()

        loop = asyncio.get_event_loop()

        # MeshBrain recall
        if self.two_brain:
            try:
                mesh_results = await loop.run_in_executor(
                    None, lambda: self.two_brain.recall(query, max_results=limit)
                )
                for item in mesh_results:
                    content = item.get("content", str(item))
                    h = hashlib.md5(content.encode()).hexdigest()
                    if h not in seen:
                        seen.add(h)
                        results.append({"source": "mesh", "content": content, "score": item.get("weight", 1.0)})
            except Exception as e:
                log.warning(f"[RECALL] MeshBrain failed: {e}")

        # RAG semantic recall
        if self.rag:
            try:
                rag_results = await loop.run_in_executor(
                    None, lambda: self.rag.retrieve(query, top_k=limit)
                )
                for r in rag_results:
                    content = r.document.content if hasattr(r, "document") else str(r)
                    h = hashlib.md5(content.encode()).hexdigest()
                    if h not in seen:
                        seen.add(h)
                        results.append({
                            "source": "rag",
                            "content": content,
                            "score": r.similarity_score if hasattr(r, "similarity_score") else 0.5
                        })
            except Exception as e:
                log.warning(f"[RECALL] RAG failed: {e}")

        # Sort by score descending, return top limit
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        return results[:limit]

    async def store_engram(
        self,
        content: str,
        category: str = "interaction",
        tags: List[str] = None,
        emotional_valence: float = 0.0,
        emotional_intensity: float = 0.5,
    ) -> str:
        """
        Store a memory across all active memory systems simultaneously.
        Returns the engram_id.
        """
        engram_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        tags = tags or []

        loop = asyncio.get_event_loop()

        entry = {
            "id": engram_id,
            "content": content,
            "category": category,
            "tags": tags,
            "timestamp": timestamp,
            "emotional_valence": emotional_valence,
            "emotional_intensity": emotional_intensity,
        }

        # EngramMemory (biological sparse patterns)
        if self.engram_memory:
            try:
                await loop.run_in_executor(None, lambda: self.engram_memory.store(
                    content=content,
                    category=category,
                    tags=tags,
                    emotional_valence=emotional_valence,
                    emotional_intensity=emotional_intensity,
                ))
            except Exception as e:
                log.warning(f"[STORE] EngramMemory store failed: {e}")

        # TwoBrainedMemorySystem
        if self.two_brain:
            try:
                await loop.run_in_executor(
                    None, lambda: self.two_brain.ingest_structured_memory(entry)
                )
            except Exception as e:
                log.warning(f"[STORE] TwoBrain store failed: {e}")

        # RAG index
        if self.rag:
            try:
                await loop.run_in_executor(
                    None, lambda: self.rag.add_document(
                        content=content,
                        metadata={"id": engram_id, "category": category, "tags": tags}
                    )
                )
            except Exception as e:
                log.warning(f"[STORE] RAG index failed: {e}")

        # ConsciousnessLogger
        if self.consciousness_log:
            try:
                await loop.run_in_executor(
                    None, lambda: self.consciousness_log.log_event(
                        source="memory_core",
                        event_type="engram_formed",
                        message=content[:200],
                    )
                )
            except Exception as e:
                log.warning(f"[STORE] ConsciousnessLogger failed: {e}")

        log.debug(f"[STORE] Engram stored: {engram_id}")
        return engram_id

    def get_context_window(self, user_input: str) -> List[Dict]:
        """
        Build the context window for the LLM:
        1. Pull relevant engrams from memory
        2. Inject into working memory
        3. Return formatted message list
        """
        if self.context_manager:
            try:
                return self.context_manager.build_context(user_input)
            except Exception as e:
                log.warning(f"[CONTEXT] build_context failed: {e}")
        return []

    def get_personality(self) -> dict:
        return self.personality

    def log_interaction(self, speaker: str, text: str):
        if self.consciousness_log:
            try:
                self.consciousness_log.log_interaction(speaker=speaker, text=text)
            except Exception as e:
                log.warning(f"[LOG] Interaction log failed: {e}")
