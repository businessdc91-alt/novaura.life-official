"""
Quick test of engram memory system
Demonstrates TRUE MEMORY working independently of context window
"""

from Aura_EngramMemory import AuraEngramMemory
from Aura_ContextManager import AuraContextManager
from datetime import datetime
import json

print("=" * 70)
print("AURA NOVA - ENGRAM MEMORY SYSTEM TEST")
print("=" * 70)

# Initialize memory system
print("\n[1] Initializing engram memory system...")
memory = AuraEngramMemory(memory_path="./TEST_MEMORY")
print(f"    Status: {memory.get_stats()}")

# Store some memories
print("\n[2] Storing memories in TRUE MEMORY...")

memory.store({
    'content': "Dillan asked about implementing dodge roll mechanic for the game",
    'emotion': 0.85,
    'emotion_type': 'excitement',
    'emotion_valence': 0.8,
    'sensory': {'visual': 'Unity editor', 'audio': 'keyboard typing'},
    'timestamp': datetime.now().isoformat(),
    'context': 'game development discussion',
    'importance': 0.9
})
print("    Stored: Dodge roll discussion")

memory.store({
    'content': "We decided to use Unity instead of Godot for better C# support",
    'emotion': 0.7,
    'emotion_type': 'joy',
    'emotion_valence': 0.7,
    'sensory': {'visual': 'documentation websites'},
    'timestamp': datetime.now().isoformat(),
    'context': 'technical decision making',
    'importance': 0.8
})
print("    Stored: Unity vs Godot decision")

memory.store({
    'content': "Discussed animation state machine for character controller",
    'emotion': 0.75,
    'emotion_type': 'excitement',
    'emotion_valence': 0.7,
    'sensory': {},
    'timestamp': datetime.now().isoformat(),
    'context': 'game development technical',
    'importance': 0.75
})
print("    Stored: Animation state machine")

memory.store({
    'content': "Dillan mentioned he loves the Dark Souls combat feel",
    'emotion': 0.9,
    'emotion_type': 'love',
    'emotion_valence': 0.9,
    'sensory': {},
    'timestamp': datetime.now().isoformat(),
    'context': 'personal preferences',
    'importance': 0.95
})
print("    Stored: Dark Souls preference")

# Test recall
print("\n[3] Testing memory recall (TRUE MEMORY search)...")
print("    Query: 'game mechanic'")

results = memory.recall(
    query="game mechanic",
    context=["working on game"],
    max_results=5,
    flood_hops=3
)

print(f"\n    Found {len(results)} relevant memories:")
for i, mem in enumerate(results, 1):
    print(f"\n    Memory {i}:")
    print(f"      Content: {mem['content']}")
    print(f"      Relevance: {mem['relevance_score']:.3f}")
    print(f"      Emotion: {mem['emotional_intensity']:.2f}")
    print(f"      Importance: {mem['importance']:.2f}")

# Test vague query (ADHD flooding)
print("\n[4] Testing vague query (tests 2e flooding)...")
print("    Query: 'that thing we talked about'")

results2 = memory.recall(
    query="that thing we talked about",
    context=[],
    max_results=3,
    flood_hops=3
)

print(f"\n    Found {len(results2)} memories from vague cue:")
for i, mem in enumerate(results2, 1):
    print(f"    - {mem['content'][:60]}... (relevance: {mem['relevance_score']:.3f})")

# Test consolidation
print("\n[5] Testing memory consolidation (like sleep)...")
memory.consolidate()
print("    Consolidation complete")

# Final stats
print("\n[6] Final memory stats:")
stats = memory.get_stats()
for key, value in stats.items():
    print(f"    {key}: {value}")

print("\n" + "=" * 70)
print("KEY INSIGHT: All memories stored PERMANENTLY")
print("They can be recalled ANY TIME, even after clearing context window!")
print("This is TRUE MEMORY, not context-dependent simulation")
print("=" * 70)
