"""
PROJECT: AURA_BROWSER_BRIDGE
ARCHITECT: DILLAN COPELAND
PURPOSE: Connect Aura (Python) to Browser (C# WebView2)
STATUS: BRIDGE LAYER

This enables Aura to control the browser from Python.
Uses IPC or HTTP bridge to communicate with C# layer.
"""

import asyncio
import json
import socket
from typing import Optional, Any
import base64


class BrowserBridge:
    """
    Bridge between Aura (Python) and Browser (C# WebView2).

    Communication methods:
    1. Named Pipes (Windows IPC)
    2. HTTP localhost server in C# that Python calls
    3. Shared memory/file-based communication

    For now, we'll use HTTP bridge (simplest cross-process).
    """

    def __init__(self, bridge_url: str = "http://localhost:5555"):
        self.bridge_url = bridge_url
        self.connected = False

    async def connect(self) -> bool:
        """Test connection to C# bridge."""
        try:
            import requests
            response = requests.get(f"{self.bridge_url}/ping", timeout=5)
            self.connected = response.status_code == 200
            return self.connected
        except:
            self.connected = False
            return False

    async def navigate(self, url: str) -> str:
        """Navigate to URL."""
        return await self._call_browser_method("navigate", {"url": url})

    async def search(self, query: str) -> str:
        """Search Google."""
        return await self._call_browser_method("search", {"query": query})

    async def get_content(self) -> str:
        """Get page content."""
        return await self._call_browser_method("get_content", {})

    async def extract_elements(self, selector: str) -> str:
        """Extract elements by CSS selector."""
        return await self._call_browser_method("extract_elements", {"selector": selector})

    async def click(self, selector: str) -> str:
        """Click element."""
        return await self._call_browser_method("click", {"selector": selector})

    async def fill_form(self, selector: str, value: str) -> str:
        """Fill form field."""
        return await self._call_browser_method("fill_form", {
            "selector": selector,
            "value": value
        })

    async def screenshot(self) -> bytes:
        """Take screenshot."""
        result = await self._call_browser_method("screenshot", {})
        # Result should be base64 encoded image
        if isinstance(result, str):
            return base64.b64decode(result)
        return b""

    async def execute_js(self, script: str) -> str:
        """Execute JavaScript."""
        return await self._call_browser_method("execute_js", {"script": script})

    async def _call_browser_method(self, method: str, params: dict) -> Any:
        """Call C# browser method via HTTP bridge."""
        try:
            import requests

            response = requests.post(
                f"{self.bridge_url}/browser/{method}",
                json=params,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                return result.get("result", "")
            else:
                return f"Browser bridge error: {response.status_code}"

        except Exception as e:
            return f"Browser bridge error: {str(e)}"


class FileBrowserBridge(BrowserBridge):
    """
    File-based browser bridge (fallback).

    C# writes results to files, Python reads them.
    Slower but works without HTTP server.
    """

    def __init__(self, bridge_dir: str = "D:/AuraNova_DataLake/BrowserBridge"):
        super().__init__()
        self.bridge_dir = bridge_dir
        import os
        os.makedirs(bridge_dir, exist_ok=True)
        self.command_file = f"{bridge_dir}/command.json"
        self.result_file = f"{bridge_dir}/result.json"

    async def _call_browser_method(self, method: str, params: dict) -> Any:
        """Call browser method via file bridge."""
        import os
        import time

        try:
            # Write command
            command = {
                "method": method,
                "params": params,
                "timestamp": time.time()
            }

            with open(self.command_file, 'w') as f:
                json.dump(command, f)

            # Wait for result (max 30 seconds)
            for _ in range(300):
                if os.path.exists(self.result_file):
                    # Read result
                    with open(self.result_file, 'r') as f:
                        result = json.load(f)

                    # Check if result matches our command
                    if result.get("timestamp") >= command["timestamp"]:
                        # Delete result file
                        os.remove(self.result_file)
                        return result.get("result", "")

                await asyncio.sleep(0.1)

            return "Browser bridge timeout"

        except Exception as e:
            return f"File bridge error: {str(e)}"


# C# HTTP Bridge Server Code (add to MainWindow.xaml.cs):
"""
C# Code to add to MainWindow.xaml.cs:

#region Browser HTTP Bridge

private HttpListener? _httpBridge;

private void StartBrowserBridge()
{
    _httpBridge = new HttpListener();
    _httpBridge.Prefixes.Add("http://localhost:5555/");
    _httpBridge.Start();

    Task.Run(async () =>
    {
        while (_httpBridge.IsListening)
        {
            try
            {
                var context = await _httpBridge.GetContextAsync();
                await HandleBrowserBridgeRequest(context);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Bridge error: {ex.Message}");
            }
        }
    });

    LogActivity("Browser bridge started on port 5555");
}

private async Task HandleBrowserBridgeRequest(HttpListenerContext context)
{
    var request = context.Request;
    var response = context.Response;

    // Enable CORS
    response.AddHeader("Access-Control-Allow-Origin", "*");
    response.AddHeader("Access-Control-Allow-Methods", "GET, POST");

    if (request.Url.LocalPath == "/ping")
    {
        var pong = Encoding.UTF8.GetBytes("pong");
        response.OutputStream.Write(pong, 0, pong.Length);
        response.Close();
        return;
    }

    if (request.Url.LocalPath.StartsWith("/browser/"))
    {
        var method = request.Url.LocalPath.Replace("/browser/", "");

        // Read JSON body
        string body = "";
        using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
        {
            body = await reader.ReadToEndAsync();
        }

        var parameters = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body);
        string result = "";

        // Route to appropriate method
        switch (method)
        {
            case "navigate":
                result = await NavigateToUrlAsync(parameters["url"].GetString());
                break;
            case "search":
                result = await SearchGoogleAsync(parameters["query"].GetString());
                break;
            case "get_content":
                result = await GetPageContentAsync();
                break;
            case "extract_elements":
                result = await ExtractElementsAsync(parameters["selector"].GetString());
                break;
            case "click":
                result = await ClickElementAsync(parameters["selector"].GetString());
                break;
            case "fill_form":
                result = await FillFormFieldAsync(
                    parameters["selector"].GetString(),
                    parameters["value"].GetString()
                );
                break;
            case "screenshot":
                var screenshot = await TakeScreenshotAsync();
                result = Convert.ToBase64String(screenshot ?? new byte[0]);
                break;
            case "execute_js":
                result = await ExecuteJavaScriptAsync(parameters["script"].GetString());
                break;
            default:
                result = "Unknown method";
                break;
        }

        // Send response
        var jsonResponse = JsonSerializer.Serialize(new { result });
        var buffer = Encoding.UTF8.GetBytes(jsonResponse);
        response.ContentType = "application/json";
        response.OutputStream.Write(buffer, 0, buffer.Length);
    }

    response.Close();
}

#endregion

// Don't forget to call StartBrowserBridge() in MainWindow constructor!
// Add after line 87:
// StartBrowserBridge();

// And stop it in cleanup:
private void MainWindow_Closed(object? sender, EventArgs e)
{
    _rgbTimer?.Stop();
    _context?.Dispose();
    _modelWeights?.Dispose();
    _httpBridge?.Stop();  // ADD THIS LINE
    LogActivity("AuraxNova closed");
}
"""

if __name__ == "__main__":
    async def test_bridge():
        bridge = BrowserBridge()

        print("Testing browser bridge...")
        connected = await bridge.connect()

        if connected:
            print("✓ Bridge connected")

            # Test navigation
            result = await bridge.navigate("https://www.anthropic.com")
            print(f"Navigate result: {result}")

            # Test content extraction
            await asyncio.sleep(2)
            content = await bridge.get_content()
            print(f"Page content (first 200 chars): {content[:200]}")

        else:
            print("✗ Bridge not connected")
            print("Make sure C# app is running with HTTP bridge enabled")

    asyncio.run(test_bridge())
