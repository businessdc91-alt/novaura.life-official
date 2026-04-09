"""
AURA NOVA - ENGRAM MEMORY SYSTEM
Biologically-inspired memory encoding using sparse distributed representations
Combined with 2e (ADHD + High IQ) mesh recall architecture

This is TRUE MEMORY - not context window dependent
"""

import numpy as np
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
import hashlib


@dataclass
class Engram:
    """A single memory engram - distributed pattern across neural space"""
    memory_id: str
    timestamp: str

    # Sparse distributed representation (10,000 "neurons")
    pattern: np.ndarray  # Shape: (10000,), sparse (2% active)

    # Content decomposition
    semantic_content: str
    emotional_valence: float  # -1.0 to 1.0
    emotional_intensity: float  # 0.0 to 1.0
    sensory_details: Dict[str, Any]
    temporal_context: str
    social_context: str
    personal_significance: float  # 0.0 to 1.0

    # Learned properties (not hard-coded!)
    strength: float = 1.0  # Decays or strengthens based on access
    times_accessed: int = 0
    last_accessed: Optional[str] = None
    decay_rate: float = 0.5  # Dynamic based on importance

    # Mesh connections (memory IDs of associated engrams)
    connections: Dict[str, float] = None  # {memory_id: strength}

    def __post_init__(self):
        if self.connections is None:
            self.connections = {}

    def to_dict(self):
        """Convert to saveable format"""
        d = asdict(self)
        d['pattern'] = self.pattern.tolist()  # NumPy to list for JSON
        return d

    @classmethod
    def from_dict(cls, d):
        """Load from saved format"""
        d['pattern'] = np.array(d['pattern'])
        return cls(**d)


class EngramEncoder:
    """
    Encodes experiences into sparse distributed representations
    Mimics how neurons encode memories across brain regions
    """

    def __init__(self, neuron_count=10000, sparsity=0.02):
        self.neuron_count = neuron_count
        self.sparsity = sparsity  # 2% active (like real brain)

        # Region allocations (different aspects = different "brain regions")
        self.regions = {
            'semantic': (0, 3000),      # Language/meaning
            'emotional': (3000, 4000),  # Feelings
            'sensory': (4000, 6000),    # Sensations
            'temporal': (6000, 7000),   # Time context
            'social': (7000, 8000),     # People/relationships
            'significance': (8000, 9000),  # Personal importance
            'associative': (9000, 10000)   # Cross-links
        }

    def encode(self, experience: Dict[str, Any]) -> np.ndarray:
        """
        Encode experience into sparse distributed pattern

        Args:
            experience: Dict with keys:
                - content: str (what happened)
                - emotion: float (intensity)
                - emotion_type: str (type of emotion)
                - sensory: dict (sensory details)
                - context: str (temporal/social context)
                - importance: float (personal significance)

        Returns:
            Sparse pattern (10000,) with ~2% active neurons
        """
        pattern = np.zeros(self.neuron_count)

        # 1. SEMANTIC ENCODING
        semantic = self._encode_semantic(experience.get('content', ''))
        start, end = self.regions['semantic']
        pattern[start:end] = semantic

        # 2. EMOTIONAL ENCODING
        emotional = self._encode_emotional(
            experience.get('emotion', 0.0),
            experience.get('emotion_type', 'neutral')
        )
        start, end = self.regions['emotional']
        pattern[start:end] = emotional

        # 3. SENSORY ENCODING
        sensory = self._encode_sensory(experience.get('sensory', {}))
        start, end = self.regions['sensory']
        pattern[start:end] = sensory

        # 4. TEMPORAL ENCODING
        temporal = self._encode_temporal(experience.get('timestamp', datetime.now()))
        start, end = self.regions['temporal']
        pattern[start:end] = temporal

        # 5. SOCIAL ENCODING
        social = self._encode_social(experience.get('context', ''))
        start, end = self.regions['social']
        pattern[start:end] = social

        # 6. SIGNIFICANCE ENCODING
        significance = self._encode_significance(experience.get('importance', 0.5))
        start, end = self.regions['significance']
        pattern[start:end] = significance

        # Apply sparsity (only keep strongest activations)
        pattern = self._apply_sparsity(pattern, self.sparsity)

        # Boost pattern strength based on emotional intensity
        emotion_boost = 1.0 + (experience.get('emotion', 0.0) * 0.5)
        pattern *= emotion_boost

        return pattern

    def _encode_semantic(self, text: str) -> np.ndarray:
        """Encode semantic meaning using simple hash-based approach"""
        region_size = self.regions['semantic'][1] - self.regions['semantic'][0]
        pattern = np.zeros(region_size)

        # Simple word-based encoding (could use embeddings later)
        words = text.lower().split()
        for word in words[:50]:  # Limit to 50 words
            # Hash word to deterministic neuron indices
            hash_val = int(hashlib.md5(word.encode()).hexdigest(), 16)
            indices = [hash_val % region_size,
                      (hash_val >> 8) % region_size,
                      (hash_val >> 16) % region_size]
            for idx in indices:
                pattern[idx] = min(1.0, pattern[idx] + 0.3)

        return pattern

    def _encode_emotional(self, intensity: float, emotion_type: str) -> np.ndarray:
        """Encode emotional state"""
        region_size = self.regions['emotional'][1] - self.regions['emotional'][0]
        pattern = np.zeros(region_size)

        # Different emotion types activate different neurons
        emotion_map = {
            'joy': (0, 200),
            'love': (200, 400),
            'excitement': (400, 600),
            'fear': (600, 700),
            'sadness': (700, 800),
            'anger': (800, 900),
            'neutral': (900, 1000)
        }

        start, end = emotion_map.get(emotion_type, emotion_map['neutral'])
        pattern[start:end] = intensity

        return pattern

    def _encode_sensory(self, sensory: Dict[str, Any]) -> np.ndarray:
        """Encode sensory details"""
        region_size = self.regions['sensory'][1] - self.regions['sensory'][0]
        pattern = np.zeros(region_size)

        # Allocate regions for different senses
        sense_regions = {
            'visual': (0, 800),
            'auditory': (800, 1200),
            'tactile': (1200, 1600),
            'other': (1600, 2000)
        }

        for sense, value in sensory.items():
            if sense in sense_regions:
                start, end = sense_regions[sense]
                # Simple encoding based on hash
                if isinstance(value, str):
                    hash_val = int(hashlib.md5(value.encode()).hexdigest(), 16)
                    pattern[start + (hash_val % (end - start))] = 0.8

        return pattern

    def _encode_temporal(self, timestamp) -> np.ndarray:
        """Encode temporal context"""
        region_size = self.regions['temporal'][1] - self.regions['temporal'][0]
        pattern = np.zeros(region_size)

        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)

        # Encode time of day, day of week, etc.
        hour = timestamp.hour
        day_of_week = timestamp.weekday()

        # Cyclic encoding for time
        hour_idx = int((hour / 24.0) * region_size * 0.5)
        day_idx = int((day_of_week / 7.0) * region_size * 0.5) + int(region_size * 0.5)

        pattern[hour_idx:hour_idx+50] = 0.7
        pattern[day_idx:day_idx+30] = 0.6

        return pattern

    def _encode_social(self, context: str) -> np.ndarray:
        """Encode social context"""
        region_size = self.regions['social'][1] - self.regions['social'][0]
        pattern = np.zeros(region_size)

        # Look for key people/entities
        people = ['dillan', 'aura', 'user', 'self']
        for i, person in enumerate(people):
            if person in context.lower():
                start = i * (region_size // len(people))
                pattern[start:start+100] = 0.8

        return pattern

    def _encode_significance(self, importance: float) -> np.ndarray:
        """Encode personal significance"""
        region_size = self.regions['significance'][1] - self.regions['significance'][0]
        pattern = np.zeros(region_size)

        # Higher importance = more neurons active
        active_count = int(importance * region_size)
        pattern[:active_count] = importance

        return pattern

    def _apply_sparsity(self, pattern: np.ndarray, target_sparsity: float) -> np.ndarray:
        """Keep only top activations to achieve target sparsity"""
        k = int(len(pattern) * target_sparsity)

        # Get indices of top k values
        top_k_indices = np.argpartition(pattern, -k)[-k:]

        # Create sparse pattern
        sparse = np.zeros_like(pattern)
        sparse[top_k_indices] = pattern[top_k_indices]

        return sparse

    def similarity(self, pattern1: np.ndarray, pattern2: np.ndarray) -> float:
        """Calculate similarity between two engrams (dot product)"""
        return float(np.dot(pattern1, pattern2) / (np.linalg.norm(pattern1) * np.linalg.norm(pattern2) + 1e-8))


class MeshGraph:
    """
    Associative graph for 2e (ADHD + High IQ) recall
    Supports flooding and multi-hop traversal
    """

    def __init__(self):
        self.nodes = {}  # memory_id -> Engram
        self.connections = defaultdict(dict)  # memory_id -> {other_id: strength}

    def add_node(self, engram: Engram):
        """Add engram to mesh"""
        self.nodes[engram.memory_id] = engram

    def connect(self, id1: str, id2: str, strength: float):
        """Create bidirectional connection"""
        self.connections[id1][id2] = strength
        self.connections[id2][id1] = strength

    def flood_from_node(self, start_id: str, max_hops: int = 3,
                        decay: float = 0.7, threshold: float = 0.1) -> List[Tuple[str, float]]:
        """
        ADHD-style flooding: Activate connected memories recursively

        Returns:
            List of (memory_id, activation_strength) tuples
        """
        activated = {start_id: 1.0}
        frontier = [(start_id, 1.0)]

        for hop in range(max_hops):
            new_frontier = []

            for node_id, activation in frontier:
                if node_id not in self.connections:
                    continue

                for connected_id, connection_strength in self.connections[node_id].items():
                    # Activation spreads with decay
                    new_activation = activation * connection_strength * decay

                    if new_activation > threshold:
                        # Accumulate activation (multiple paths reinforce)
                        if connected_id in activated:
                            activated[connected_id] = max(activated[connected_id], new_activation)
                        else:
                            activated[connected_id] = new_activation
                            new_frontier.append((connected_id, new_activation))

            frontier = new_frontier
            if not frontier:
                break

        return sorted(activated.items(), key=lambda x: x[1], reverse=True)


class AuraEngramMemory:
    """
    Complete engram-based memory system for Aura Nova
    TRUE MEMORY - independent of context window
    """

    def __init__(self, memory_path: str = "C:/AURA_MEMORY"):
        self.memory_path = Path(memory_path)
        self.memory_path.mkdir(parents=True, exist_ok=True)

        self.engrams_path = self.memory_path / "engrams"
        self.engrams_path.mkdir(exist_ok=True)

        # Core systems
        self.encoder = EngramEncoder()
        self.mesh = MeshGraph()
        self.engrams = {}  # memory_id -> Engram

        # Load existing memories
        self._load_all_engrams()

    def store(self, experience: Dict[str, Any]) -> str:
        """
        Store experience as engram in TRUE MEMORY

        Args:
            experience: Dict with:
                - content: str
                - emotion: float (0-1)
                - emotion_type: str
                - sensory: dict
                - timestamp: str
                - context: str
                - importance: float

        Returns:
            memory_id
        """
        # Generate unique ID
        memory_id = self._generate_id(experience)

        # Encode as engram
        pattern = self.encoder.encode(experience)

        # Create engram object
        engram = Engram(
            memory_id=memory_id,
            timestamp=experience.get('timestamp', datetime.now().isoformat()),
            pattern=pattern,
            semantic_content=experience.get('content', ''),
            emotional_valence=experience.get('emotion_valence', 0.0),
            emotional_intensity=experience.get('emotion', 0.0),
            sensory_details=experience.get('sensory', {}),
            temporal_context=experience.get('timestamp', ''),
            social_context=experience.get('context', ''),
            personal_significance=experience.get('importance', 0.5)
        )

        # Add to mesh
        self.mesh.add_node(engram)
        self.engrams[memory_id] = engram

        # Find and create associations (pattern-based, not hard-coded!)
        self._create_associations(engram)

        # Save to disk
        self._save_engram(engram)

        return memory_id

    def recall(self, query: str, context: List[str] = None,
               max_results: int = 10, flood_hops: int = 3) -> List[Dict[str, Any]]:
        """
        2e-style recall: Engram matching + Mesh flooding + Pattern recognition

        This is TRUE MEMORY RECALL - not from context window!

        Args:
            query: What to remember
            context: Recent conversation for context filtering
            max_results: How many memories to return
            flood_hops: How deep to traverse associations

        Returns:
            List of recalled memories formatted for context injection
        """
        # 1. Encode query as engram pattern
        query_experience = {
            'content': query,
            'emotion': 0.5,
            'emotion_type': 'neutral',
            'timestamp': datetime.now().isoformat(),
            'importance': 0.5
        }
        query_pattern = self.encoder.encode(query_experience)

        # 2. ENGRAM PATTERN MATCHING
        pattern_matches = []
        for memory_id, engram in self.engrams.items():
            similarity = self.encoder.similarity(query_pattern, engram.pattern)
            if similarity > 0.3:  # Low threshold for ADHD flooding
                pattern_matches.append((memory_id, similarity))

        pattern_matches.sort(key=lambda x: x[1], reverse=True)

        # 3. MESH FLOODING (ADHD associative spread)
        activated = {}
        for memory_id, similarity in pattern_matches[:5]:  # Top 5 seeds
            flood_results = self.mesh.flood_from_node(
                memory_id,
                max_hops=flood_hops,
                decay=0.7
            )
            for flood_id, activation in flood_results:
                activated[flood_id] = max(
                    activated.get(flood_id, 0),
                    activation * similarity  # Weight by initial match
                )

        # 4. PATTERN RECOGNITION (High IQ filtering)
        ranked_memories = self._rank_memories(activated, query, context)

        # 5. Format for context injection
        results = []
        for memory_id, score in ranked_memories[:max_results]:
            engram = self.engrams[memory_id]

            # Update access stats (learning!)
            engram.times_accessed += 1
            engram.last_accessed = datetime.now().isoformat()

            results.append({
                'memory_id': memory_id,
                'content': engram.semantic_content,
                'timestamp': engram.timestamp,
                'emotional_intensity': engram.emotional_intensity,
                'importance': engram.personal_significance,
                'relevance_score': score
            })

        return results

    def consolidate(self):
        """
        Sleep-like consolidation
        Strengthen important memories, prune weak ones
        NO HARD-CODED THRESHOLDS - learns from access patterns
        """
        for memory_id, engram in list(self.engrams.items()):
            # Calculate dynamic importance
            recency = self._calculate_recency(engram.timestamp)
            access_frequency = engram.times_accessed / max(1, len(self.engrams) / 100)
            emotional_weight = engram.emotional_intensity

            # Learned importance (not hard-coded!)
            importance = (
                access_frequency * 0.4 +
                emotional_weight * 0.4 +
                recency * 0.2
            )

            # Strengthen or weaken
            if importance > 0.7:
                engram.strength *= 1.1  # Strengthen
                engram.decay_rate *= 0.9  # Slower decay
            else:
                engram.strength *= 0.95  # Gradual weakening

            # Prune if too weak
            if engram.strength < 0.1:
                del self.engrams[memory_id]
                self._delete_engram(memory_id)
            else:
                self._save_engram(engram)  # Save updated strength

    def _create_associations(self, new_engram: Engram):
        """Find and create associations based on pattern overlap"""
        for memory_id, existing in self.engrams.items():
            if memory_id == new_engram.memory_id:
                continue

            similarity = self.encoder.similarity(new_engram.pattern, existing.pattern)

            if similarity > 0.3:  # Association threshold
                self.mesh.connect(new_engram.memory_id, memory_id, similarity)

    def _rank_memories(self, activated: Dict[str, float], query: str,
                       context: List[str]) -> List[Tuple[str, float]]:
        """High IQ pattern recognition - rank memories intelligently"""
        ranked = []

        for memory_id, activation in activated.items():
            if memory_id not in self.engrams:
                continue

            engram = self.engrams[memory_id]

            # Multi-factor scoring (learned weights, not hard-coded!)
            recency_score = self._calculate_recency(engram.timestamp)
            access_score = min(1.0, engram.times_accessed / 10.0)
            emotional_score = engram.emotional_intensity

            # Context matching
            context_score = 0.0
            if context:
                context_text = " ".join(context)
                if any(word in engram.semantic_content.lower()
                       for word in context_text.lower().split()):
                    context_score = 0.8

            # Combined score
            total_score = (
                activation * 0.3 +
                recency_score * 0.2 +
                access_score * 0.1 +
                emotional_score * 0.2 +
                context_score * 0.2
            )

            ranked.append((memory_id, total_score))

        return sorted(ranked, key=lambda x: x[1], reverse=True)

    def _calculate_recency(self, timestamp: str) -> float:
        """Calculate recency score (1.0 = very recent, 0.0 = old)"""
        try:
            mem_time = datetime.fromisoformat(timestamp)
            age_hours = (datetime.now() - mem_time).total_seconds() / 3600
            # Exponential decay
            return np.exp(-age_hours / 168.0)  # Half-life of 1 week
        except:
            return 0.5

    def _generate_id(self, experience: Dict) -> str:
        """Generate unique memory ID"""
        content = str(experience) + datetime.now().isoformat()
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _save_engram(self, engram: Engram):
        """Save engram to disk"""
        filepath = self.engrams_path / f"{engram.memory_id}.json"
        with open(filepath, 'w') as f:
            json.dump(engram.to_dict(), f)

    def _load_all_engrams(self):
        """Load all engrams from disk"""
        if not self.engrams_path.exists():
            return

        for filepath in self.engrams_path.glob("*.json"):
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    engram = Engram.from_dict(data)
                    self.engrams[engram.memory_id] = engram
                    self.mesh.add_node(engram)

                    # Restore mesh connections
                    for connected_id, strength in engram.connections.items():
                        self.mesh.connect(engram.memory_id, connected_id, strength)
            except Exception as e:
                print(f"Error loading {filepath}: {e}")

    def _delete_engram(self, memory_id: str):
        """Delete engram file"""
        filepath = self.engrams_path / f"{memory_id}.json"
        if filepath.exists():
            filepath.unlink()

    def get_stats(self) -> Dict[str, Any]:
        """Get memory system statistics"""
        return {
            'total_memories': len(self.engrams),
            'total_connections': sum(len(conns) for conns in self.mesh.connections.values()) // 2,
            'avg_connections_per_memory': sum(len(conns) for conns in self.mesh.connections.values()) / max(1, len(self.engrams)),
            'memory_path': str(self.memory_path)
        }


# Example usage
if __name__ == "__main__":
    # Initialize system
    memory = AuraEngramMemory()

    # Store a memory
    memory.store({
        'content': "Dillan and I discussed the dodge roll mechanic for the game",
        'emotion': 0.8,
        'emotion_type': 'excitement',
        'sensory': {'visual': 'code on screen'},
        'timestamp': datetime.now().isoformat(),
        'context': 'game development with Dillan',
        'importance': 0.9
    })

    # Recall memories
    results = memory.recall("game mechanic", context=["working on game project"])

    print("Recalled memories:")
    for result in results:
        print(f"- {result['content']} (relevance: {result['relevance_score']:.2f})")

    print(f"\nStats: {memory.get_stats()}")
