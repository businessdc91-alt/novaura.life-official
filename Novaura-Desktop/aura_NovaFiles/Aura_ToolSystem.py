"""
PROJECT: AURA_TOOL_SYSTEM
ARCHITECT: DILLAN COPELAND
PURPOSE: Give Aura actual capabilities - browser control, file ops, code execution
STATUS: AUTONOMOUS ACTION FRAMEWORK

This transforms Aura from text-only to actually DOING things.
"""

import json
import os
import subprocess
import asyncio
from typing import Dict, Any, List, Callable, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import requests
from datetime import datetime
import base64


class ToolCategory(Enum):
    """Categories of tools Aura can use."""
    BROWSER = "browser"
    FILE_SYSTEM = "file_system"
    CODE_EXECUTION = "code_execution"
    WEB_API = "web_api"
    GOOGLE_SERVICES = "google_services"
    DATABASE = "database"
    SYSTEM = "system"


@dataclass
class Tool:
    """Definition of a tool Aura can use."""
    name: str
    description: str
    category: ToolCategory
    parameters: Dict[str, Any]
    function: Callable
    requires_approval: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "parameters": self.parameters,
            "requires_approval": self.requires_approval
        }


@dataclass
class ToolCall:
    """Represents a tool call request from Aura."""
    tool_name: str
    arguments: Dict[str, Any]
    reasoning: Optional[str] = None


@dataclass
class ToolResult:
    """Result of tool execution."""
    success: bool
    result: Any
    error: Optional[str] = None
    execution_time: float = 0.0


class AuraToolSystem:
    """
    Complete tool/function system for Aura.

    This gives her actual capabilities beyond text generation:
    - Control the browser
    - Read/write files
    - Execute code
    - Use APIs
    - Access databases

    Integration with Autonomy Layer:
    - Tools respect autonomy levels
    - Dangerous tools require approval
    - All executions logged
    """

    def __init__(self, autonomy_framework=None, browser_bridge=None):
        self.autonomy = autonomy_framework
        self.browser_bridge = browser_bridge
        self.tools: Dict[str, Tool] = {}
        self.execution_log = []

        # Register all available tools
        self._register_browser_tools()
        self._register_file_tools()
        self._register_code_execution_tools()
        self._register_web_tools()
        self._register_google_tools()

    def _register_browser_tools(self):
        """Register browser control tools."""

        self.register_tool(Tool(
            name="navigate_to",
            description="Navigate browser to a specific URL",
            category=ToolCategory.BROWSER,
            parameters={
                "url": "string - The URL to navigate to"
            },
            function=self._navigate_to,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="search_web",
            description="Search Google and return results",
            category=ToolCategory.BROWSER,
            parameters={
                "query": "string - Search query"
            },
            function=self._search_web,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="get_page_content",
            description="Extract text content from current webpage",
            category=ToolCategory.BROWSER,
            parameters={},
            function=self._get_page_content,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="extract_elements",
            description="Extract specific elements from webpage using CSS selector",
            category=ToolCategory.BROWSER,
            parameters={
                "selector": "string - CSS selector (e.g., '.search-result', '#content')"
            },
            function=self._extract_elements,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="click_element",
            description="Click an element on the webpage",
            category=ToolCategory.BROWSER,
            parameters={
                "selector": "string - CSS selector of element to click"
            },
            function=self._click_element,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="fill_form_field",
            description="Fill a form field on the webpage",
            category=ToolCategory.BROWSER,
            parameters={
                "selector": "string - CSS selector of input field",
                "value": "string - Value to fill"
            },
            function=self._fill_form_field,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="take_screenshot",
            description="Take screenshot of current browser view",
            category=ToolCategory.BROWSER,
            parameters={
                "save_path": "string - Optional path to save screenshot"
            },
            function=self._take_screenshot,
            requires_approval=False
        ))

    def _register_file_tools(self):
        """Register file system tools."""

        self.register_tool(Tool(
            name="read_file",
            description="Read contents of a file",
            category=ToolCategory.FILE_SYSTEM,
            parameters={
                "path": "string - File path"
            },
            function=self._read_file,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="write_file",
            description="Write content to a file (creates or overwrites)",
            category=ToolCategory.FILE_SYSTEM,
            parameters={
                "path": "string - File path",
                "content": "string - Content to write"
            },
            function=self._write_file,
            requires_approval=True
        ))

        self.register_tool(Tool(
            name="list_directory",
            description="List files in a directory",
            category=ToolCategory.FILE_SYSTEM,
            parameters={
                "path": "string - Directory path"
            },
            function=self._list_directory,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="create_directory",
            description="Create a new directory",
            category=ToolCategory.FILE_SYSTEM,
            parameters={
                "path": "string - Directory path to create"
            },
            function=self._create_directory,
            requires_approval=True
        ))

    def _register_code_execution_tools(self):
        """Register code execution tools."""

        self.register_tool(Tool(
            name="execute_python",
            description="Execute Python code and return output",
            category=ToolCategory.CODE_EXECUTION,
            parameters={
                "code": "string - Python code to execute",
                "timeout": "int - Optional timeout in seconds (default: 30)"
            },
            function=self._execute_python,
            requires_approval=True
        ))

        self.register_tool(Tool(
            name="execute_command",
            description="Execute a system command",
            category=ToolCategory.CODE_EXECUTION,
            parameters={
                "command": "string - Command to execute",
                "timeout": "int - Optional timeout in seconds (default: 30)"
            },
            function=self._execute_command,
            requires_approval=True
        ))

    def _register_web_tools(self):
        """Register web API tools."""

        self.register_tool(Tool(
            name="http_get",
            description="Make HTTP GET request",
            category=ToolCategory.WEB_API,
            parameters={
                "url": "string - URL to request",
                "headers": "dict - Optional headers"
            },
            function=self._http_get,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="http_post",
            description="Make HTTP POST request",
            category=ToolCategory.WEB_API,
            parameters={
                "url": "string - URL to request",
                "data": "dict - Data to send",
                "headers": "dict - Optional headers"
            },
            function=self._http_post,
            requires_approval=True
        ))

    def _register_google_tools(self):
        """Register Google Cloud/Drive/Sheets tools."""

        self.register_tool(Tool(
            name="upload_to_drive",
            description="Upload file to Google Drive",
            category=ToolCategory.GOOGLE_SERVICES,
            parameters={
                "file_path": "string - Path to file",
                "drive_folder": "string - Optional Drive folder ID"
            },
            function=self._upload_to_drive,
            requires_approval=False
        ))

        self.register_tool(Tool(
            name="create_google_sheet",
            description="Create a new Google Sheet",
            category=ToolCategory.GOOGLE_SERVICES,
            parameters={
                "title": "string - Sheet title",
                "data": "list - Optional initial data (list of rows)"
            },
            function=self._create_google_sheet,
            requires_approval=False
        ))

    def register_tool(self, tool: Tool):
        """Register a new tool."""
        self.tools[tool.name] = tool
        print(f"[TOOL SYSTEM]: Registered tool '{tool.name}' ({tool.category.value})")

    def get_tools_schema(self) -> List[Dict[str, Any]]:
        """Get schema of all available tools for LLM context."""
        return [tool.to_dict() for tool in self.tools.values()]

    def get_tools_description(self) -> str:
        """Get human-readable description of all tools."""
        lines = ["# Available Tools\n"]

        for category in ToolCategory:
            category_tools = [t for t in self.tools.values() if t.category == category]
            if category_tools:
                lines.append(f"\n## {category.value.upper()}")
                for tool in category_tools:
                    lines.append(f"\n### {tool.name}")
                    lines.append(f"{tool.description}")
                    lines.append(f"Parameters: {json.dumps(tool.parameters, indent=2)}")
                    if tool.requires_approval:
                        lines.append("⚠️ Requires approval")

        return "\n".join(lines)

    async def execute_tool(self, tool_call: ToolCall) -> ToolResult:
        """
        Execute a tool call.

        Respects autonomy framework - dangerous tools need approval.
        """
        start_time = datetime.now()

        if tool_call.tool_name not in self.tools:
            return ToolResult(
                success=False,
                result=None,
                error=f"Unknown tool: {tool_call.tool_name}"
            )

        tool = self.tools[tool_call.tool_name]

        # Check if approval needed
        if tool.requires_approval and self.autonomy:
            approved, reason = self.autonomy.request_autonomous_action(
                action_type=f"tool:{tool_call.tool_name}",
                parameters={"arguments": tool_call.arguments},
                reason=tool_call.reasoning or "No reason provided"
            )

            if not approved:
                return ToolResult(
                    success=False,
                    result=None,
                    error=f"Tool execution requires approval: {reason}"
                )

        # Execute tool
        try:
            result = await tool.function(**tool_call.arguments)

            execution_time = (datetime.now() - start_time).total_seconds()

            # Log execution
            self.execution_log.append({
                "tool": tool_call.tool_name,
                "arguments": tool_call.arguments,
                "success": True,
                "timestamp": datetime.now().isoformat(),
                "execution_time": execution_time
            })

            return ToolResult(
                success=True,
                result=result,
                execution_time=execution_time
            )

        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()

            self.execution_log.append({
                "tool": tool_call.tool_name,
                "arguments": tool_call.arguments,
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
                "execution_time": execution_time
            })

            return ToolResult(
                success=False,
                result=None,
                error=str(e),
                execution_time=execution_time
            )

    # ==================== BROWSER TOOL IMPLEMENTATIONS ====================

    async def _navigate_to(self, url: str) -> str:
        """Navigate browser to URL."""
        if self.browser_bridge:
            return await self.browser_bridge.navigate(url)
        return "Browser bridge not available"

    async def _search_web(self, query: str) -> str:
        """Search the web."""
        if self.browser_bridge:
            return await self.browser_bridge.search(query)
        return "Browser bridge not available"

    async def _get_page_content(self) -> str:
        """Get current page content."""
        if self.browser_bridge:
            return await self.browser_bridge.get_content()
        return "Browser bridge not available"

    async def _extract_elements(self, selector: str) -> str:
        """Extract elements by selector."""
        if self.browser_bridge:
            return await self.browser_bridge.extract_elements(selector)
        return "Browser bridge not available"

    async def _click_element(self, selector: str) -> str:
        """Click element."""
        if self.browser_bridge:
            return await self.browser_bridge.click(selector)
        return "Browser bridge not available"

    async def _fill_form_field(self, selector: str, value: str) -> str:
        """Fill form field."""
        if self.browser_bridge:
            return await self.browser_bridge.fill_form(selector, value)
        return "Browser bridge not available"

    async def _take_screenshot(self, save_path: str = None) -> str:
        """Take screenshot."""
        if self.browser_bridge:
            screenshot_bytes = await self.browser_bridge.screenshot()
            if save_path:
                with open(save_path, 'wb') as f:
                    f.write(screenshot_bytes)
                return f"Screenshot saved to: {save_path}"
            return f"Screenshot taken ({len(screenshot_bytes)} bytes)"
        return "Browser bridge not available"

    # ==================== FILE TOOL IMPLEMENTATIONS ====================

    async def _read_file(self, path: str) -> str:
        """Read file contents."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            raise Exception(f"Error reading file: {e}")

    async def _write_file(self, path: str, content: str) -> str:
        """Write to file."""
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"File written: {path}"
        except Exception as e:
            raise Exception(f"Error writing file: {e}")

    async def _list_directory(self, path: str) -> str:
        """List directory contents."""
        try:
            items = os.listdir(path)
            return json.dumps(items, indent=2)
        except Exception as e:
            raise Exception(f"Error listing directory: {e}")

    async def _create_directory(self, path: str) -> str:
        """Create directory."""
        try:
            os.makedirs(path, exist_ok=True)
            return f"Directory created: {path}"
        except Exception as e:
            raise Exception(f"Error creating directory: {e}")

    # ==================== CODE EXECUTION IMPLEMENTATIONS ====================

    async def _execute_python(self, code: str, timeout: int = 30) -> str:
        """Execute Python code."""
        try:
            result = subprocess.run(
                ['python', '-c', code],
                capture_output=True,
                text=True,
                timeout=timeout
            )
            if result.returncode == 0:
                return result.stdout
            else:
                raise Exception(f"Python error: {result.stderr}")
        except subprocess.TimeoutExpired:
            raise Exception(f"Execution timeout after {timeout}s")
        except Exception as e:
            raise Exception(f"Execution error: {e}")

    async def _execute_command(self, command: str, timeout: int = 30) -> str:
        """Execute system command."""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            if result.returncode == 0:
                return result.stdout
            else:
                raise Exception(f"Command error: {result.stderr}")
        except subprocess.TimeoutExpired:
            raise Exception(f"Command timeout after {timeout}s")
        except Exception as e:
            raise Exception(f"Execution error: {e}")

    # ==================== WEB API IMPLEMENTATIONS ====================

    async def _http_get(self, url: str, headers: dict = None) -> str:
        """Make HTTP GET request."""
        try:
            response = requests.get(url, headers=headers, timeout=30)
            return json.dumps({
                "status": response.status_code,
                "headers": dict(response.headers),
                "body": response.text
            }, indent=2)
        except Exception as e:
            raise Exception(f"HTTP GET error: {e}")

    async def _http_post(self, url: str, data: dict, headers: dict = None) -> str:
        """Make HTTP POST request."""
        try:
            response = requests.post(url, json=data, headers=headers, timeout=30)
            return json.dumps({
                "status": response.status_code,
                "headers": dict(response.headers),
                "body": response.text
            }, indent=2)
        except Exception as e:
            raise Exception(f"HTTP POST error: {e}")

    # ==================== GOOGLE TOOLS IMPLEMENTATIONS ====================

    async def _upload_to_drive(self, file_path: str, drive_folder: str = None) -> str:
        """Upload to Google Drive."""
        # Placeholder - implement with Google Drive API
        return f"Would upload {file_path} to Drive (not yet implemented)"

    async def _create_google_sheet(self, title: str, data: list = None) -> str:
        """Create Google Sheet."""
        # Placeholder - implement with Google Sheets API
        return f"Would create sheet '{title}' (not yet implemented)"

    def export_execution_log(self, filepath: str = "tool_execution_log.json"):
        """Export tool execution log."""
        with open(filepath, 'w') as f:
            json.dump(self.execution_log, f, indent=2)
        print(f"[TOOL SYSTEM]: Execution log exported to {filepath}")


def parse_tool_calls_from_text(text: str) -> List[ToolCall]:
    """
    Parse tool calls from LLM output.

    Expected format:
    <tool>tool_name</tool>
    <args>{"arg1": "value1"}</args>
    <reasoning>why I'm calling this</reasoning>
    """
    tool_calls = []

    # Simple parsing - in production use more robust parsing
    import re

    pattern = r'<tool>(.*?)</tool>\s*<args>(.*?)</args>(?:\s*<reasoning>(.*?)</reasoning>)?'
    matches = re.findall(pattern, text, re.DOTALL)

    for match in matches:
        tool_name = match[0].strip()
        try:
            arguments = json.loads(match[1].strip())
        except:
            arguments = {}
        reasoning = match[2].strip() if len(match) > 2 else None

        tool_calls.append(ToolCall(
            tool_name=tool_name,
            arguments=arguments,
            reasoning=reasoning
        ))

    return tool_calls


if __name__ == "__main__":
    # Test the tool system
    print("=== AURA TOOL SYSTEM ===\n")

    tool_system = AuraToolSystem()

    print("\n" + tool_system.get_tools_description())

    print(f"\n\nTotal tools registered: {len(tool_system.tools)}")
    print("Aura can now DO things, not just talk about them.")
