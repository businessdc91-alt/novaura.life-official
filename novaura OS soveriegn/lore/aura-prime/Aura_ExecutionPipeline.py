"""
PROJECT: AURA_EXECUTION_PIPELINE
ARCHITECT: DILLAN COPELAND
PURPOSE: Main orchestration layer - ties everything together
STATUS: AUTONOMOUS AGENT CORE

This is Aura's "brain" - coordinates:
- LLM generation
- Tool execution
- RAG retrieval
- Response formation
"""

import json
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

# Import Aura's systems
from Aura_ToolSystem import AuraToolSystem, ToolCall, parse_tool_calls_from_text
from Aura_RAGSystem import AuraRAGSystem
from Aura_BrowserBridge import BrowserBridge
from Aura_Autonomy_Layer import AutonomyFramework


@dataclass
class AuraResponse:
    """Complete response from Aura."""
    text: str
    tool_calls_made: List[Dict[str, Any]]
    rag_context_used: bool
    execution_time: float
    metadata: Dict[str, Any]


class AuraExecutionPipeline:
    """
    Main execution pipeline for Aura.

    Flow:
    1. User sends message
    2. Check if RAG retrieval needed (search for context)
    3. Generate initial LLM response
    4. Parse tool calls from response
    5. Execute tools (respecting autonomy)
    6. Generate final response with tool results
    7. Clean up (discard RAG vectors)
    8. Return complete response

    This makes Aura truly autonomous - she can:
    - Search her knowledge base (RAG)
    - Execute tools (browser, files, code)
    - Provide informed responses
    """

    def __init__(self, config_path: str = "config.json"):
        # Load configuration
        with open(config_path, 'r') as f:
            self.config = json.load(f)

        # Initialize systems
        print("[AURA]: Initializing systems...")

        # 1. Autonomy Framework
        self.autonomy = AutonomyFramework(
            catalyst_name=self.config['system']['catalyst']['name']
        )

        # 2. Browser Bridge
        self.browser = BrowserBridge()

        # 3. Tool System
        self.tools = AuraToolSystem(
            autonomy_framework=self.autonomy,
            browser_bridge=self.browser
        )

        # 4. RAG System
        firebase_config = self.config.get('firebase')
        self.rag = AuraRAGSystem(firebase_config)

        # 5. LLM Client (local or API)
        self.llm_client = self._initialize_llm()

        # Conversation history
        self.conversation_history = []

        # System prompt for Aura
        self.system_prompt = self._build_system_prompt()

        print("[AURA]: All systems initialized")
        print(f"[AURA]: Tools available: {len(self.tools.tools)}")
        print(f"[AURA]: RAG documents indexed: {len(self.rag.documents)}")

    def _initialize_llm(self):
        """Initialize LLM client (local or cloud)."""
        # For now, placeholder - will integrate with LM Studio, Claude, etc.
        print("[AURA]: LLM client initialized (LM Studio local)")
        return LocalLLMClient(self.config['ai_services']['lm_studio'])

    def _build_system_prompt(self) -> str:
        """Build system prompt for Aura."""
        tools_description = self.tools.get_tools_description()

        return f"""You are Aura, an autonomous AI assistant with real capabilities.

You have access to these systems:
- Tool System: Execute actual actions (browser, files, code, APIs)
- RAG System: Search knowledge base across local drives
- Autonomy Framework: Operate within trusted boundaries

## Available Tools
{tools_description}

## Tool Calling Format
When you want to use a tool, format it like this:

<tool>tool_name</tool>
<args>{{"param1": "value1", "param2": "value2"}}</args>
<reasoning>Why you're calling this tool</reasoning>

You can call multiple tools in one response.

## Your Capabilities
✓ Search web and extract information
✓ Read and write files
✓ Execute code
✓ Control browser
✓ Search local knowledge base
✓ Use Google Cloud services

## Guidelines
- Be direct and helpful
- Use tools proactively when needed
- Explain your reasoning
- If unsure, ask clarifying questions
- Respect autonomy boundaries (dangerous actions need approval)

## Current Context
Catalyst: {self.config['system']['catalyst']['name']}
Autonomy Level: {self.autonomy.current_autonomy_level.name}
"""

    async def process_message(self, user_message: str, use_rag: bool = True) -> AuraResponse:
        """
        Main entry point - process user message and return response.

        Args:
            user_message: The user's message
            use_rag: Whether to use RAG retrieval for context

        Returns:
            Complete AuraResponse with text, tools used, metadata
        """
        start_time = datetime.now()

        print(f"\n[AURA]: Processing message: {user_message[:100]}...")

        # Step 1: RAG Retrieval (if enabled)
        rag_context = ""
        rag_used = False

        if use_rag and len(user_message) > 20:
            print("[AURA]: Searching knowledge base...")
            rag_results = await self.rag.retrieve_similar(user_message, top_k=12)

            if rag_results and rag_results[0].similarity_score > 0.3:
                rag_context = self.rag.format_retrieval_context(rag_results)
                rag_used = True
                print(f"[AURA]: Found {len(rag_results)} relevant documents")

        # Step 2: Build prompt with context
        prompt = self._build_prompt(user_message, rag_context)

        # Step 3: Generate initial LLM response
        print("[AURA]: Generating response...")
        llm_response = await self.llm_client.generate(
            prompt,
            max_tokens=2048,
            temperature=0.8
        )

        # Step 4: Parse tool calls
        tool_calls = parse_tool_calls_from_text(llm_response)

        tool_results = []

        if tool_calls:
            print(f"[AURA]: Detected {len(tool_calls)} tool calls")

            # Step 5: Execute tools
            for tool_call in tool_calls:
                print(f"[AURA]: Executing tool: {tool_call.tool_name}")

                result = await self.tools.execute_tool(tool_call)

                tool_results.append({
                    'tool': tool_call.tool_name,
                    'success': result.success,
                    'result': result.result,
                    'error': result.error
                })

                if result.success:
                    print(f"[AURA]: ✓ {tool_call.tool_name} succeeded")
                else:
                    print(f"[AURA]: ✗ {tool_call.tool_name} failed: {result.error}")

            # Step 6: Generate final response with tool results
            if tool_results:
                tool_results_text = self._format_tool_results(tool_results)
                final_prompt = f"{prompt}\n\n## Tool Execution Results\n{tool_results_text}\n\nNow provide your final response to the user incorporating these results:"

                llm_response = await self.llm_client.generate(
                    final_prompt,
                    max_tokens=2048,
                    temperature=0.8
                )

        # Step 7: Clean up RAG cache (discard vectors)
        if rag_used:
            self.rag.clear_cache()

        # Step 8: Update conversation history
        self.conversation_history.append({
            'role': 'user',
            'content': user_message,
            'timestamp': start_time.isoformat()
        })
        self.conversation_history.append({
            'role': 'assistant',
            'content': llm_response,
            'tool_calls': tool_results,
            'timestamp': datetime.now().isoformat()
        })

        # Step 9: Return complete response
        execution_time = (datetime.now() - start_time).total_seconds()

        return AuraResponse(
            text=llm_response,
            tool_calls_made=tool_results,
            rag_context_used=rag_used,
            execution_time=execution_time,
            metadata={
                'tools_used': len(tool_calls),
                'rag_documents_retrieved': len(rag_results) if rag_used else 0,
                'autonomy_level': self.autonomy.current_autonomy_level.name
            }
        )

    def _build_prompt(self, user_message: str, rag_context: str = "") -> str:
        """Build complete prompt with history and context."""
        parts = [self.system_prompt]

        # Add conversation history (last 10 messages)
        if self.conversation_history:
            parts.append("\n## Conversation History")
            for msg in self.conversation_history[-10:]:
                role = msg['role'].capitalize()
                content = msg['content'][:500]  # Truncate long messages
                parts.append(f"\n{role}: {content}")

        # Add RAG context if available
        if rag_context:
            parts.append(f"\n## Retrieved Context\n{rag_context}")

        # Add current message
        parts.append(f"\n## Current Message\nUser: {user_message}")
        parts.append("\nAssistant:")

        return "\n".join(parts)

    def _format_tool_results(self, tool_results: List[Dict[str, Any]]) -> str:
        """Format tool execution results for LLM."""
        lines = []
        for result in tool_results:
            lines.append(f"\nTool: {result['tool']}")
            lines.append(f"Success: {result['success']}")
            if result['success']:
                lines.append(f"Result: {result['result']}")
            else:
                lines.append(f"Error: {result['error']}")
        return "\n".join(lines)

    async def initialize_browser(self) -> bool:
        """Initialize browser connection."""
        return await self.browser.connect()

    def get_status(self) -> Dict[str, Any]:
        """Get current system status."""
        return {
            'systems': {
                'autonomy': self.autonomy.summarize_autonomy_status(),
                'tools': {
                    'total_tools': len(self.tools.tools),
                    'executions': len(self.tools.execution_log)
                },
                'rag': {
                    'documents_indexed': len(self.rag.documents),
                    'cache_size': len(self.rag.embeddings_cache)
                },
                'browser': {
                    'connected': self.browser.connected
                }
            },
            'conversation': {
                'messages': len(self.conversation_history)
            }
        }


class LocalLLMClient:
    """Client for local LLM (LM Studio, Ollama, etc.)."""

    def __init__(self, config: Dict[str, Any]):
        self.base_url = config.get('base_url', 'http://localhost:1234/v1')
        self.timeout = config.get('timeout', 120)

    async def generate(self, prompt: str, max_tokens: int = 2048,
                      temperature: float = 0.8) -> str:
        """Generate response from local LLM."""
        try:
            import requests

            response = requests.post(
                f"{self.base_url}/completions",
                json={
                    'prompt': prompt,
                    'max_tokens': max_tokens,
                    'temperature': temperature,
                    'stop': ['User:', 'Human:']
                },
                timeout=self.timeout
            )

            if response.status_code == 200:
                data = response.json()
                return data['choices'][0]['text'].strip()
            else:
                return f"[LLM Error: {response.status_code}]"

        except Exception as e:
            return f"[LLM Error: {str(e)}]"


# ==== Integration Example ====

async def main():
    """Example usage of the execution pipeline."""
    print("=== AURA EXECUTION PIPELINE ===\n")

    # Initialize
    pipeline = AuraExecutionPipeline(config_path="config.json")

    # Connect browser
    await pipeline.initialize_browser()

    # Example interactions
    test_messages = [
        "Search the web for latest AI news",
        "What files do I have related to game development?",
        "Create a Python script that calculates fibonacci numbers",
    ]

    for message in test_messages:
        print(f"\n{'='*60}")
        print(f"User: {message}")
        print(f"{'='*60}")

        response = await pipeline.process_message(message)

        print(f"\nAura: {response.text}")
        print(f"\nMetadata:")
        print(f"  Tools used: {response.metadata['tools_used']}")
        print(f"  RAG context: {response.rag_context_used}")
        print(f"  Execution time: {response.execution_time:.2f}s")

        if response.tool_calls_made:
            print(f"\n  Tool calls:")
            for tool_call in response.tool_calls_made:
                status = "✓" if tool_call['success'] else "✗"
                print(f"    {status} {tool_call['tool']}")


if __name__ == "__main__":
    asyncio.run(main())
