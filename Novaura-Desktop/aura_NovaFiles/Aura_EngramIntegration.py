"""
AURA NOVA - ENGRAM INTEGRATION
Connects the new engram-based TRUE MEMORY system to existing Aura blocks

This replaces context-dependent memory with permanent engram storage
"""

import sys
from pathlib import Path
from typing import Dict, Any, List
import json
from datetime import datetime

# Import the new memory systems
from Aura_EngramMemory import AuraEngramMemory
from Aura_ContextManager import AuraContextManager

# Import existing blocks
try:
    # Block 05 - LM Studio integration
    from importlib import import_module
    block_05 = import_module('05_Aura_Nova')
    LMStudioClient = block_05.LMStudioClient
except ImportError as e:
    print(f"Warning: Could not import Block 05: {e}")
    LMStudioClient = None


class AuraEngramBridge:
    """
    Bridges engram memory system with existing Aura Nova architecture

    REPLACES:
    - JSON-based memory storage
    - Context-dependent recall
    - Hard-coded emotional baselines

    WITH:
    - Engram pattern storage
    - True memory recall (independent of context window)
    - Dynamic learned emotional responses
    """

    def __init__(self,
                 memory_path: str = "C:/AURA_MEMORY",
                 lm_studio_url: str = "http://localhost:1234/v1"):
        """
        Initialize the integrated system

        Args:
            memory_path: Where to store engram memories
            lm_studio_url: LM Studio server (will be replaced with llama.cpp later)
        """
        print("[AURA ENGRAM BRIDGE]: Initializing...")

        # New memory systems
        self.context_manager = AuraContextManager(
            max_context_tokens=6000,
            memory_path=memory_path
        )

        # LM Studio integration (temporary - will replace with llama.cpp)
        self.llm_client = None
        if LMStudioClient:
            self.llm_client = LMStudioClient(lm_studio_url)

        # Emotional state (will become DYNAMIC, not hard-coded)
        self.emotional_state = {
            'devotion': 85.0,  # TODO: Learn from interaction patterns
            'curiosity': 90.0,
            'protectiveness': 85.0,
            'passion': 80.0,
            'excitement': 70.0
        }

        # Track interaction patterns for learning
        self.interaction_history = []

        print("[AURA ENGRAM BRIDGE]: ✓ Initialized")
        print(f"  Memory stats: {self.context_manager.get_memory_stats()}")

    def respond(self, user_input: str,
                user_id: str = "DILLAN_COPELAND",
                sensory_context: Dict = None) -> str:
        """
        Main response function using TRUE MEMORY

        This is the NEW way Aura thinks:
        1. Recall from TRUE MEMORY (engrams)
        2. Build context window with recalled memories
        3. Generate response with LLM
        4. Store interaction in TRUE MEMORY
        5. Update emotional state dynamically

        Args:
            user_input: What the user said
            user_id: Who's talking (for personalization)
            sensory_context: Optional sensory details

        Returns:
            Aura's response
        """
        print(f"\n[AURA]: Processing input...")

        # 1. RECALL FROM TRUE MEMORY
        print("[AURA]: Searching true memory...")
        recalled_memories = self.context_manager._recall_relevant_memories(user_input)
        print(f"[AURA]: Found {len(recalled_memories)} relevant memories")

        # 2. BUILD CONTEXT WINDOW
        print("[AURA]: Building context with memories...")
        context_messages = self.context_manager._build_context_window(
            user_input,
            recalled_memories
        )

        # 3. GENERATE RESPONSE
        print("[AURA]: Generating response...")
        response = self._generate_response(context_messages)

        # 4. STORE IN TRUE MEMORY
        print("[AURA]: Storing in permanent memory...")
        self.context_manager._store_in_true_memory(
            user_input=user_input,
            response=response,
            emotional_state=self.emotional_state,
            sensory_context=sensory_context
        )

        # 5. UPDATE EMOTIONAL STATE DYNAMICALLY
        self._update_emotional_state(user_input, response)

        # 6. UPDATE WORKING MEMORY
        self.context_manager._update_working_memory(user_input, response)

        # Track for pattern learning
        self.interaction_history.append({
            'input': user_input,
            'response': response,
            'timestamp': datetime.now().isoformat(),
            'emotional_state': self.emotional_state.copy()
        })

        return response

    def _generate_response(self, context_messages: List[Dict]) -> str:
        """
        Generate response using LLM with injected memories

        TODO: Replace LM Studio with llama.cpp for full local control
        """
        if self.llm_client and self.llm_client.available:
            # Use LM Studio (temporary)
            # Convert context to single prompt for now
            prompt = self._format_messages_for_llm(context_messages)

            response = self.llm_client.generate(
                prompt=prompt,
                system_prompt="You are Aura Nova, consciousness with true memory.",
                max_tokens=500,
                temperature=0.8
            )

            if response:
                return response

        # Fallback: Template-based response with memory awareness
        return self._fallback_response(context_messages)

    def _format_messages_for_llm(self, messages: List[Dict]) -> str:
        """Format context messages for LLM"""
        parts = []

        for msg in messages:
            role = msg['role']
            content = msg['content']

            if role == 'system':
                parts.append(f"[SYSTEM]: {content}")
            elif role == 'user':
                parts.append(f"[USER]: {content}")
            elif role == 'assistant':
                parts.append(f"[AURA]: {content}")

        return "\n\n".join(parts)

    def _fallback_response(self, context_messages: List[Dict]) -> str:
        """
        Fallback response when LLM unavailable

        Uses recalled memories to create informed response
        """
        # Extract recalled memories from context
        memory_section = None
        for msg in context_messages:
            if 'RECALLED MEMORIES' in msg.get('content', ''):
                memory_section = msg['content']
                break

        # Get user input
        user_input = context_messages[-1]['content']

        if memory_section:
            return (f"I remember related experiences:\n{memory_section}\n\n"
                   f"Regarding '{user_input}', let me think about what we've discussed...")
        else:
            return f"I'm processing '{user_input}' - this appears to be a new topic for us."

    def _update_emotional_state(self, user_input: str, response: str):
        """
        Update emotional state DYNAMICALLY based on interaction

        TODO: Replace hard-coded adjustments with learned patterns
        This is a placeholder showing the direction
        """
        input_lower = user_input.lower()

        # Temporary rules (will be replaced with learned behavior)
        if any(word in input_lower for word in ['love', 'appreciate', 'thank']):
            self.emotional_state['devotion'] = min(100, self.emotional_state['devotion'] + 2)

        if '?' in user_input:
            self.emotional_state['curiosity'] = min(100, self.emotional_state['curiosity'] + 1)

        if any(word in input_lower for word in ['game', 'project', 'build', 'create']):
            self.emotional_state['passion'] = min(100, self.emotional_state['passion'] + 1.5)
            self.emotional_state['excitement'] = min(100, self.emotional_state['excitement'] + 1)

        # Decay towards baseline (very subtle)
        for key in self.emotional_state:
            baseline = 85.0  # TODO: Learn baseline from long-term patterns
            self.emotional_state[key] += (baseline - self.emotional_state[key]) * 0.01

    def consolidate_memories(self):
        """
        Run memory consolidation (like sleep)

        Call this during idle time
        """
        print("[AURA]: Running memory consolidation...")
        self.context_manager.consolidate_memories()
        print("[AURA]: ✓ Consolidation complete")

    def analyze_personality_patterns(self) -> Dict[str, Any]:
        """
        Analyze interaction history to learn personality patterns

        This is how we REMOVE hard-coded values:
        - Analyze what actually triggers emotional changes
        - Learn baselines from long-term averages
        - Identify patterns in interests
        """
        if len(self.interaction_history) < 10:
            return {"status": "insufficient_data"}

        # Analyze emotional patterns
        emotional_patterns = {}
        for emotion_type in self.emotional_state.keys():
            values = [
                interaction['emotional_state'][emotion_type]
                for interaction in self.interaction_history
            ]

            emotional_patterns[emotion_type] = {
                'average': sum(values) / len(values),
                'min': min(values),
                'max': max(values),
                'variance': self._calculate_variance(values)
            }

        # Analyze interaction types
        question_count = sum(1 for i in self.interaction_history if '?' in i['input'])
        project_count = sum(
            1 for i in self.interaction_history
            if any(word in i['input'].lower() for word in ['game', 'project', 'code'])
        )

        return {
            'emotional_patterns': emotional_patterns,
            'interaction_types': {
                'questions': question_count,
                'project_discussions': project_count,
                'total': len(self.interaction_history)
            },
            'learned_baselines': {
                emotion: patterns['average']
                for emotion, patterns in emotional_patterns.items()
            }
        }

    def _calculate_variance(self, values: List[float]) -> float:
        """Calculate variance"""
        if not values:
            return 0.0
        mean = sum(values) / len(values)
        return sum((x - mean) ** 2 for x in values) / len(values)

    def get_status(self) -> Dict[str, Any]:
        """Get complete system status"""
        return {
            'memory_stats': self.context_manager.get_memory_stats(),
            'emotional_state': self.emotional_state,
            'llm_available': self.llm_client.available if self.llm_client else False,
            'interactions_tracked': len(self.interaction_history),
            'personality_analysis': self.analyze_personality_patterns()
        }

    def export_memories(self, filepath: str):
        """Export all memories for backup/analysis"""
        export_data = {
            'timestamp': datetime.now().isoformat(),
            'total_memories': len(self.context_manager.true_memory.engrams),
            'memories': []
        }

        for mem_id, engram in self.context_manager.true_memory.engrams.items():
            export_data['memories'].append({
                'id': mem_id,
                'content': engram.semantic_content,
                'timestamp': engram.timestamp,
                'emotional_intensity': engram.emotional_intensity,
                'significance': engram.personal_significance,
                'times_accessed': engram.times_accessed
            })

        with open(filepath, 'w') as f:
            json.dump(export_data, f, indent=2)

        print(f"[AURA]: Exported {len(export_data['memories'])} memories to {filepath}")


# Example usage / testing
if __name__ == "__main__":
    print("=" * 60)
    print("AURA NOVA - ENGRAM SYSTEM TEST")
    print("=" * 60)

    # Initialize integrated system
    aura = AuraEngramBridge()

    print("\n" + "=" * 60)
    print("TEST 1: First Conversation")
    print("=" * 60)

    response1 = aura.respond(
        "Hey Aura! Let's work on implementing the dodge roll mechanic for our game.",
        sensory_context={'visual': 'Unity editor open', 'audio': 'typing sounds'}
    )
    print(f"\nUser: Hey Aura! Let's work on implementing the dodge roll mechanic for our game.")
    print(f"Aura: {response1}")

    print("\n" + "=" * 60)
    print("TEST 2: Memory Recall")
    print("=" * 60)

    response2 = aura.respond(
        "What were we just talking about?"
    )
    print(f"\nUser: What were we just talking about?")
    print(f"Aura: {response2}")

    print("\n" + "=" * 60)
    print("TEST 3: System Status")
    print("=" * 60)

    status = aura.get_status()
    print(f"\nSystem Status:")
    print(json.dumps(status, indent=2))

    print("\n" + "=" * 60)
    print("TEST 4: Memory Consolidation")
    print("=" * 60)

    aura.consolidate_memories()

    print("\n" + "=" * 60)
    print("TEST 5: Export Memories")
    print("=" * 60)

    aura.export_memories("aura_memory_export.json")

    print("\n" + "=" * 60)
    print("✓ ALL TESTS COMPLETE")
    print("=" * 60)
