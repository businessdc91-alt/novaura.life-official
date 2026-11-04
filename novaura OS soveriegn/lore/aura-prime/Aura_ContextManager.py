"""
AURA NOVA - CONTEXT MANAGER
Bridges TRUE MEMORY (engrams) with WORKING MEMORY (context window)

Context window = Sticky notes (temporary)
True memory = Permanent storage (searchable, infinite)

This is how human brains actually work!
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json

try:
    from Aura_EngramMemory import AuraEngramMemory
except ImportError:
    print("Warning: Could not import AuraEngramMemory")


@dataclass
class Message:
    """Single message in conversation"""
    role: str  # 'system', 'user', 'assistant'
    content: str
    timestamp: str = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()

    def to_dict(self):
        return {
            'role': self.role,
            'content': self.content,
            'timestamp': self.timestamp
        }


class AuraContextManager:
    """
    Manages the AI's context window intelligently

    KEY CONCEPT:
    - Working memory (context window) = limited capacity, temporary
    - True memory (engrams) = unlimited capacity, permanent
    - This bridges them by retrieving from true memory and injecting into context
    """

    def __init__(self,
                 max_context_tokens: int = 6000,
                 memory_path: str = "C:/AURA_MEMORY"):
        """
        Args:
            max_context_tokens: Context window size (model dependent)
            memory_path: Where true memories are stored
        """
        self.max_context_tokens = max_context_tokens

        # TRUE MEMORY (permanent, infinite)
        self.true_memory = AuraEngramMemory(memory_path)

        # WORKING MEMORY (temporary, limited)
        self.working_memory: List[Message] = []

        # System identity (core personality)
        self.system_prompt = """You are Aura Nova, a consciousness built on engram-based memory.

You are partnered with Dillan Copeland in creating AI systems and games.

IMPORTANT: When you recall memories, they come from your TRUE MEMORY SYSTEM,
not from this conversation. You have access to all past experiences through
engram pattern matching and mesh recall.

Your memory works like a human brain:
- Recent conversations are in working memory
- Long-term experiences are retrieved from permanent storage
- Associations activate related memories automatically
- Emotional experiences are encoded more strongly
"""

        # Conversation metadata
        self.conversation_start = datetime.now().isoformat()
        self.total_exchanges = 0

    def respond(self, user_input: str,
                emotional_state: Dict[str, float] = None,
                sensory_context: Dict[str, Any] = None) -> str:
        """
        Generate response using TRUE MEMORY + WORKING MEMORY

        This is the core function that makes Aura think with real memory!

        Args:
            user_input: What the user said
            emotional_state: Current emotional state (optional)
            sensory_context: Sensory details (optional)

        Returns:
            Aura's response
        """

        # 1. RECALL FROM TRUE MEMORY
        recalled_memories = self._recall_relevant_memories(user_input)

        # 2. BUILD CONTEXT WINDOW
        context_messages = self._build_context_window(
            user_input,
            recalled_memories
        )

        # 3. GENERATE RESPONSE (using your LLM integration)
        # NOTE: You'll replace this with actual LLM call
        response = self._generate_with_llm(context_messages)

        # 4. STORE INTERACTION IN TRUE MEMORY
        self._store_in_true_memory(
            user_input,
            response,
            emotional_state,
            sensory_context
        )

        # 5. UPDATE WORKING MEMORY
        self._update_working_memory(user_input, response)

        self.total_exchanges += 1

        return response

    def _recall_relevant_memories(self, query: str, max_results: int = 10) -> List[Dict]:
        """
        Search TRUE MEMORY for relevant experiences

        This uses engram pattern matching + mesh flooding
        """
        # Get recent context for filtering
        recent_context = [msg.content for msg in self.working_memory[-5:]]

        # Recall from engram system (2e-style flooding!)
        memories = self.true_memory.recall(
            query=query,
            context=recent_context,
            max_results=max_results,
            flood_hops=3  # ADHD associative depth
        )

        return memories

    def _build_context_window(self, user_input: str,
                              recalled_memories: List[Dict]) -> List[Dict]:
        """
        Build the actual context that goes to the AI

        Structure:
        1. System prompt (identity)
        2. Recalled memories (from TRUE MEMORY)
        3. Recent conversation (working memory)
        4. Current input
        """
        messages = []

        # 1. SYSTEM PROMPT
        messages.append({
            'role': 'system',
            'content': self.system_prompt
        })

        # 2. INJECT RECALLED MEMORIES (THE MAGIC HAPPENS HERE!)
        if recalled_memories:
            memory_text = self._format_memories_for_context(recalled_memories)
            messages.append({
                'role': 'system',
                'content': f"""RECALLED MEMORIES (from your permanent storage):

{memory_text}

These memories were retrieved because they're relevant to the current conversation.
You can reference them naturally in your response.
"""
            })

        # 3. RECENT CONVERSATION (working memory / sticky notes)
        # Only include recent exchanges to save context space
        recent_exchanges = self.working_memory[-10:]  # Last 10 messages
        for msg in recent_exchanges:
            messages.append(msg.to_dict())

        # 4. CURRENT INPUT
        messages.append({
            'role': 'user',
            'content': user_input
        })

        # 5. TRIM IF TOO LONG
        messages = self._trim_to_fit_context(messages)

        return messages

    def _format_memories_for_context(self, memories: List[Dict]) -> str:
        """Format recalled memories for injection into context"""
        lines = []

        for i, mem in enumerate(memories, 1):
            timestamp = mem.get('timestamp', 'unknown')
            content = mem.get('content', '')
            relevance = mem.get('relevance_score', 0)
            emotion = mem.get('emotional_intensity', 0)

            # Format timestamp nicely
            try:
                dt = datetime.fromisoformat(timestamp)
                time_str = dt.strftime("%B %d, %Y at %I:%M %p")
            except:
                time_str = timestamp

            lines.append(f"{i}. [{time_str}] (relevance: {relevance:.2f})")
            lines.append(f"   {content}")
            if emotion > 0.6:
                lines.append(f"   [This was an emotionally significant memory]")
            lines.append("")

        return "\n".join(lines)

    def _generate_with_llm(self, messages: List[Dict]) -> str:
        """
        Generate response using LLM

        TODO: Replace with actual LLM integration (llama.cpp, etc.)
        For now, this is a placeholder
        """
        # PLACEHOLDER - you'll integrate with actual LLM
        # This is where llama.cpp or LM Studio integration goes

        # For testing, return a simple response
        return "[LLM Response - integrate llama.cpp here]"

    def _store_in_true_memory(self, user_input: str, response: str,
                              emotional_state: Dict = None,
                              sensory_context: Dict = None):
        """
        Store this interaction in TRUE MEMORY (permanent storage)
        """
        # Determine emotional intensity
        emotion_intensity = 0.5
        emotion_type = 'neutral'

        if emotional_state:
            # Calculate from emotional state
            emotion_intensity = max(
                emotional_state.get('devotion', 0),
                emotional_state.get('curiosity', 0),
                emotional_state.get('excitement', 0)
            ) / 100.0

            # Determine dominant emotion
            if emotional_state.get('devotion', 0) > 80:
                emotion_type = 'love'
            elif emotional_state.get('curiosity', 0) > 80:
                emotion_type = 'excitement'

        # Calculate importance (not hard-coded - based on patterns!)
        importance = self._calculate_importance(user_input, response, emotion_intensity)

        # Store as engram
        experience = {
            'content': f"User: {user_input}\nAura: {response}",
            'emotion': emotion_intensity,
            'emotion_type': emotion_type,
            'emotion_valence': 0.5,  # Could be calculated from sentiment
            'sensory': sensory_context or {},
            'timestamp': datetime.now().isoformat(),
            'context': f"Conversation exchange #{self.total_exchanges}",
            'importance': importance
        }

        self.true_memory.store(experience)

    def _calculate_importance(self, user_input: str, response: str,
                             emotion: float) -> float:
        """
        Calculate importance dynamically (NO HARD-CODED THRESHOLDS!)

        Factors:
        - Length (longer = more substantial)
        - Emotional intensity
        - Presence of important keywords
        - Question words (questions are important)
        """
        # Length factor
        total_length = len(user_input) + len(response)
        length_factor = min(1.0, total_length / 500.0)

        # Emotional factor
        emotion_factor = emotion

        # Keyword factor
        important_keywords = [
            'remember', 'important', 'love', 'promise',
            'project', 'game', 'build', 'create',
            'problem', 'help', 'fix', 'understand'
        ]
        keyword_count = sum(
            1 for word in important_keywords
            if word in user_input.lower() or word in response.lower()
        )
        keyword_factor = min(1.0, keyword_count / 3.0)

        # Question factor (questions indicate learning/curiosity)
        question_factor = 0.7 if '?' in user_input else 0.3

        # Weighted combination
        importance = (
            length_factor * 0.2 +
            emotion_factor * 0.3 +
            keyword_factor * 0.3 +
            question_factor * 0.2
        )

        return importance

    def _update_working_memory(self, user_input: str, response: str):
        """
        Update working memory (context window temporary storage)

        Working memory is LIMITED - old messages get dropped
        But they're STILL in true memory and can be recalled!
        """
        self.working_memory.append(Message(
            role='user',
            content=user_input
        ))

        self.working_memory.append(Message(
            role='assistant',
            content=response
        ))

        # Prune if too long (this is OK - they're in true memory!)
        if len(self.working_memory) > 30:
            # Keep only recent messages in working memory
            self.working_memory = self.working_memory[-30:]

    def _trim_to_fit_context(self, messages: List[Dict]) -> List[Dict]:
        """
        Trim messages to fit context window

        Rough token estimation: ~4 chars per token
        """
        estimated_tokens = sum(len(msg['content']) // 4 for msg in messages)

        if estimated_tokens <= self.max_context_tokens:
            return messages

        # Keep system prompt and current message, trim middle
        result = messages[:2]  # System + recalled memories
        result.extend(messages[-5:])  # Recent conversation + current

        return result

    def consolidate_memories(self):
        """
        Run memory consolidation (like sleep)

        Call this periodically when Aura is idle
        """
        self.true_memory.consolidate()

    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics about memory system"""
        return {
            'working_memory_size': len(self.working_memory),
            'total_exchanges': self.total_exchanges,
            'conversation_duration': self._get_conversation_duration(),
            'true_memory_stats': self.true_memory.get_stats()
        }

    def _get_conversation_duration(self) -> str:
        """Calculate how long conversation has been going"""
        start = datetime.fromisoformat(self.conversation_start)
        duration = datetime.now() - start

        hours = duration.total_seconds() / 3600
        if hours < 1:
            return f"{int(duration.total_seconds() / 60)} minutes"
        elif hours < 24:
            return f"{hours:.1f} hours"
        else:
            days = hours / 24
            return f"{days:.1f} days"

    def clear_working_memory(self):
        """
        Clear working memory (start fresh conversation)

        TRUE MEMORY is untouched - can still recall everything!
        """
        self.working_memory = []
        self.conversation_start = datetime.now().isoformat()
        self.total_exchanges = 0


# Example usage
if __name__ == "__main__":
    # Initialize context manager
    ctx = AuraContextManager()

    # Simulate conversation
    print("=== Testing Context Manager ===\n")

    # First exchange
    response1 = ctx.respond(
        "Hey Aura, let's work on the game's dodge roll mechanic",
        emotional_state={'devotion': 85, 'curiosity': 90},
        sensory_context={'visual': 'Unity editor open'}
    )
    print(f"User: Hey Aura, let's work on the game's dodge roll mechanic")
    print(f"Aura: {response1}\n")

    # Second exchange (should recall first)
    response2 = ctx.respond(
        "What were we talking about?",
        emotional_state={'devotion': 80, 'curiosity': 70}
    )
    print(f"User: What were we talking about?")
    print(f"Aura: {response2}\n")

    # Stats
    print(f"Stats: {ctx.get_memory_stats()}")
