/*
 * AURA BROWSER BRIDGE - Python to C# Communication
 * ARCHITECT: DILLAN COPELAND
 *
 * HTTP Bridge that allows Python (Aura's brain) to control the
 * WebView2 browser in the C# UI.
 *
 * CAPABILITIES:
 * - Navigate to URLs
 * - Search Google
 * - Extract page content
 * - Click elements
 * - Fill forms
 * - Take screenshots
 * - Execute JavaScript
 *
 * Communication: HTTP on localhost:5555
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace AuraxNova_Command_v5.Core
{
    public class BrowserCommand
    {
        public string Method { get; set; } = "";
        public Dictionary<string, JsonElement>? Params { get; set; }
        public double Timestamp { get; set; }
    }

    public class BrowserResult
    {
        public string Result { get; set; } = "";
        public bool Success { get; set; }
        public double Timestamp { get; set; }
    }

    public class AuraBrowserBridge
    {
        private HttpListener? _listener;
        private readonly int _port;
        private readonly string _bridgeDir;
        private bool _isRunning = false;
        private CancellationTokenSource? _cts;

        // Reference to WebView2 control (set from MainWindow)
        private WebView2? _webView;

        // Events
        public event Action<string>? OnLog;
        public event Action<string>? OnNavigated;
        public event Action<string>? OnContentExtracted;

        public AuraBrowserBridge(int port = 5555)
        {
            _port = port;
            _bridgeDir = "E:/AuraNova_DataLake/BrowserBridge";
            Directory.CreateDirectory(_bridgeDir);
        }

        /// <summary>
        /// Set the WebView2 control reference.
        /// </summary>
        public void SetWebView(WebView2 webView)
        {
            _webView = webView;
            OnLog?.Invoke("[BRIDGE] WebView2 reference set");
        }

        // =========================================================================
        // HTTP BRIDGE SERVER
        // =========================================================================

        /// <summary>
        /// Start the HTTP bridge server.
        /// </summary>
        public void StartHttpBridge()
        {
            if (_isRunning) return;

            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{_port}/");
                _listener.Start();
                _isRunning = true;
                _cts = new CancellationTokenSource();

                Task.Run(async () => await HttpBridgeLoop(_cts.Token));

                OnLog?.Invoke($"[BRIDGE] HTTP bridge started on port {_port}");
            }
            catch (Exception ex)
            {
                OnLog?.Invoke($"[BRIDGE] Failed to start: {ex.Message}");
            }
        }

        /// <summary>
        /// Stop the HTTP bridge server.
        /// </summary>
        public void StopHttpBridge()
        {
            _isRunning = false;
            _cts?.Cancel();

            try
            {
                _listener?.Stop();
                _listener?.Close();
            }
            catch { }

            OnLog?.Invoke("[BRIDGE] HTTP bridge stopped");
        }

        private async Task HttpBridgeLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && _isRunning && _listener != null)
            {
                try
                {
                    var context = await _listener.GetContextAsync();
                    _ = HandleRequestAsync(context);
                }
                catch (HttpListenerException)
                {
                    // Listener was stopped
                    break;
                }
                catch (Exception ex)
                {
                    OnLog?.Invoke($"[BRIDGE] Error: {ex.Message}");
                }
            }
        }

        private async Task HandleRequestAsync(HttpListenerContext context)
        {
            var request = context.Request;
            var response = context.Response;

            // CORS headers
            response.AddHeader("Access-Control-Allow-Origin", "*");
            response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.AddHeader("Access-Control-Allow-Headers", "Content-Type");

            // Handle OPTIONS (preflight)
            if (request.HttpMethod == "OPTIONS")
            {
                response.StatusCode = 200;
                response.Close();
                return;
            }

            string resultJson = "{}";

            try
            {
                var path = request.Url?.LocalPath ?? "";

                // Ping endpoint
                if (path == "/ping")
                {
                    resultJson = JsonSerializer.Serialize(new { result = "pong", status = "ok" });
                }
                // Browser commands
                else if (path.StartsWith("/browser/"))
                {
                    var method = path.Replace("/browser/", "");

                    // Read request body
                    string body = "";
                    using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                    {
                        body = await reader.ReadToEndAsync();
                    }

                    var parameters = string.IsNullOrEmpty(body)
                        ? new Dictionary<string, JsonElement>()
                        : JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body) ?? new();

                    // Execute command
                    var result = await ExecuteBrowserCommand(method, parameters);
                    resultJson = JsonSerializer.Serialize(new { result, success = true });
                }
                else
                {
                    resultJson = JsonSerializer.Serialize(new { result = "Unknown endpoint", success = false });
                }
            }
            catch (Exception ex)
            {
                resultJson = JsonSerializer.Serialize(new { result = ex.Message, success = false });
            }

            // Send response
            var buffer = Encoding.UTF8.GetBytes(resultJson);
            response.ContentType = "application/json";
            response.ContentLength64 = buffer.Length;
            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            response.Close();
        }

        // =========================================================================
        // BROWSER COMMANDS
        // =========================================================================

        private async Task<string> ExecuteBrowserCommand(string method, Dictionary<string, JsonElement> parameters)
        {
            if (_webView == null)
                return "WebView2 not initialized";

            try
            {
                return method switch
                {
                    "navigate" => await NavigateAsync(GetParam(parameters, "url")),
                    "search" => await SearchAsync(GetParam(parameters, "query")),
                    "get_content" => await GetPageContentAsync(),
                    "get_html" => await GetPageHtmlAsync(),
                    "extract_elements" => await ExtractElementsAsync(GetParam(parameters, "selector")),
                    "extract_text" => await ExtractTextAsync(GetParam(parameters, "selector")),
                    "click" => await ClickElementAsync(GetParam(parameters, "selector")),
                    "fill_form" => await FillFormAsync(GetParam(parameters, "selector"), GetParam(parameters, "value")),
                    "screenshot" => await TakeScreenshotAsync(),
                    "execute_js" => await ExecuteJavaScriptAsync(GetParam(parameters, "script")),
                    "get_url" => GetCurrentUrl(),
                    "get_title" => await GetPageTitleAsync(),
                    "go_back" => await GoBackAsync(),
                    "go_forward" => await GoForwardAsync(),
                    "refresh" => await RefreshAsync(),
                    _ => $"Unknown method: {method}"
                };
            }
            catch (Exception ex)
            {
                return $"Error: {ex.Message}";
            }
        }

        private string GetParam(Dictionary<string, JsonElement> parameters, string key)
        {
            if (parameters.TryGetValue(key, out var value))
                return value.GetString() ?? "";
            return "";
        }

        /// <summary>
        /// Navigate to URL.
        /// </summary>
        public async Task<string> NavigateAsync(string url)
        {
            if (_webView == null) return "WebView not initialized";

            // Ensure URL has scheme
            if (!url.StartsWith("http://") && !url.StartsWith("https://"))
                url = "https://" + url;

            var tcs = new TaskCompletionSource<string>();

            await _webView.Dispatcher.InvokeAsync(() =>
            {
                _webView.CoreWebView2.NavigationCompleted += (s, e) =>
                {
                    tcs.TrySetResult(e.IsSuccess ? "Navigation completed" : $"Navigation failed: {e.WebErrorStatus}");
                };
                _webView.CoreWebView2.Navigate(url);
            });

            OnNavigated?.Invoke(url);
            OnLog?.Invoke($"[BRIDGE] Navigating to: {url}");

            // Wait for navigation with timeout
            var completed = await Task.WhenAny(tcs.Task, Task.Delay(30000));
            return completed == tcs.Task ? await tcs.Task : "Navigation timeout";
        }

        /// <summary>
        /// Search Google.
        /// </summary>
        public async Task<string> SearchAsync(string query)
        {
            var searchUrl = $"https://www.google.com/search?q={Uri.EscapeDataString(query)}";
            return await NavigateAsync(searchUrl);
        }

        /// <summary>
        /// Get page text content.
        /// </summary>
        public async Task<string> GetPageContentAsync()
        {
            if (_webView == null) return "WebView not initialized";

            string content = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                content = await _webView.CoreWebView2.ExecuteScriptAsync("document.body.innerText");
            });

            // Clean up JSON encoding
            content = CleanJsResult(content);
            OnContentExtracted?.Invoke(content.Substring(0, Math.Min(200, content.Length)));
            return content;
        }

        /// <summary>
        /// Get page HTML.
        /// </summary>
        public async Task<string> GetPageHtmlAsync()
        {
            if (_webView == null) return "WebView not initialized";

            string html = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                html = await _webView.CoreWebView2.ExecuteScriptAsync("document.documentElement.outerHTML");
            });

            return CleanJsResult(html);
        }

        /// <summary>
        /// Extract elements by CSS selector.
        /// </summary>
        public async Task<string> ExtractElementsAsync(string selector)
        {
            if (_webView == null) return "WebView not initialized";

            string result = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                var script = $@"
                    (function() {{
                        var elements = document.querySelectorAll('{EscapeJs(selector)}');
                        var results = [];
                        elements.forEach(function(el) {{
                            results.push({{
                                tag: el.tagName,
                                text: el.innerText?.substring(0, 200) || '',
                                href: el.href || '',
                                src: el.src || ''
                            }});
                        }});
                        return JSON.stringify(results);
                    }})()
                ";
                result = await _webView.CoreWebView2.ExecuteScriptAsync(script);
            });

            return CleanJsResult(result);
        }

        /// <summary>
        /// Extract text from element by selector.
        /// </summary>
        public async Task<string> ExtractTextAsync(string selector)
        {
            if (_webView == null) return "WebView not initialized";

            string result = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                var script = $@"
                    (function() {{
                        var el = document.querySelector('{EscapeJs(selector)}');
                        return el ? el.innerText : 'Element not found';
                    }})()
                ";
                result = await _webView.CoreWebView2.ExecuteScriptAsync(script);
            });

            return CleanJsResult(result);
        }

        /// <summary>
        /// Click element by selector.
        /// </summary>
        public async Task<string> ClickElementAsync(string selector)
        {
            if (_webView == null) return "WebView not initialized";

            string result = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                var script = $@"
                    (function() {{
                        var el = document.querySelector('{EscapeJs(selector)}');
                        if (el) {{
                            el.click();
                            return 'Clicked';
                        }}
                        return 'Element not found';
                    }})()
                ";
                result = await _webView.CoreWebView2.ExecuteScriptAsync(script);
            });

            OnLog?.Invoke($"[BRIDGE] Click: {selector}");
            return CleanJsResult(result);
        }

        /// <summary>
        /// Fill form field by selector.
        /// </summary>
        public async Task<string> FillFormAsync(string selector, string value)
        {
            if (_webView == null) return "WebView not initialized";

            string result = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                var script = $@"
                    (function() {{
                        var el = document.querySelector('{EscapeJs(selector)}');
                        if (el) {{
                            el.value = '{EscapeJs(value)}';
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            return 'Filled';
                        }}
                        return 'Element not found';
                    }})()
                ";
                result = await _webView.CoreWebView2.ExecuteScriptAsync(script);
            });

            OnLog?.Invoke($"[BRIDGE] Fill form: {selector}");
            return CleanJsResult(result);
        }

        /// <summary>
        /// Take screenshot (returns base64).
        /// </summary>
        public async Task<string> TakeScreenshotAsync()
        {
            if (_webView == null) return "WebView not initialized";

            string base64 = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                using var stream = new MemoryStream();
                await _webView.CoreWebView2.CapturePreviewAsync(
                    CoreWebView2CapturePreviewImageFormat.Png, stream);
                base64 = Convert.ToBase64String(stream.ToArray());
            });

            OnLog?.Invoke("[BRIDGE] Screenshot taken");
            return base64;
        }

        /// <summary>
        /// Execute JavaScript and return result.
        /// </summary>
        public async Task<string> ExecuteJavaScriptAsync(string script)
        {
            if (_webView == null) return "WebView not initialized";

            string result = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                result = await _webView.CoreWebView2.ExecuteScriptAsync(script);
            });

            return CleanJsResult(result);
        }

        /// <summary>
        /// Get current URL.
        /// </summary>
        public string GetCurrentUrl()
        {
            if (_webView == null) return "WebView not initialized";
            return _webView.Source?.ToString() ?? "";
        }

        /// <summary>
        /// Get page title.
        /// </summary>
        public async Task<string> GetPageTitleAsync()
        {
            if (_webView == null) return "WebView not initialized";

            string title = "";
            await _webView.Dispatcher.InvokeAsync(async () =>
            {
                title = await _webView.CoreWebView2.ExecuteScriptAsync("document.title");
            });

            return CleanJsResult(title);
        }

        /// <summary>
        /// Go back in history.
        /// </summary>
        public async Task<string> GoBackAsync()
        {
            if (_webView == null) return "WebView not initialized";

            await _webView.Dispatcher.InvokeAsync(() =>
            {
                if (_webView.CanGoBack)
                    _webView.GoBack();
            });

            return "OK";
        }

        /// <summary>
        /// Go forward in history.
        /// </summary>
        public async Task<string> GoForwardAsync()
        {
            if (_webView == null) return "WebView not initialized";

            await _webView.Dispatcher.InvokeAsync(() =>
            {
                if (_webView.CanGoForward)
                    _webView.GoForward();
            });

            return "OK";
        }

        /// <summary>
        /// Refresh page.
        /// </summary>
        public async Task<string> RefreshAsync()
        {
            if (_webView == null) return "WebView not initialized";

            await _webView.Dispatcher.InvokeAsync(() =>
            {
                _webView.Reload();
            });

            return "OK";
        }

        // =========================================================================
        // FILE-BASED BRIDGE (Fallback)
        // =========================================================================

        /// <summary>
        /// Start file-based bridge monitoring (fallback if HTTP doesn't work).
        /// </summary>
        public void StartFileBridge()
        {
            var commandFile = Path.Combine(_bridgeDir, "command.json");
            var resultFile = Path.Combine(_bridgeDir, "result.json");

            _cts = new CancellationTokenSource();

            Task.Run(async () =>
            {
                while (!_cts.Token.IsCancellationRequested)
                {
                    try
                    {
                        if (File.Exists(commandFile))
                        {
                            var json = await File.ReadAllTextAsync(commandFile);
                            var command = JsonSerializer.Deserialize<BrowserCommand>(json);

                            if (command != null)
                            {
                                var result = await ExecuteBrowserCommand(
                                    command.Method,
                                    command.Params ?? new Dictionary<string, JsonElement>()
                                );

                                var resultObj = new BrowserResult
                                {
                                    Result = result,
                                    Success = true,
                                    Timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds()
                                };

                                await File.WriteAllTextAsync(resultFile, JsonSerializer.Serialize(resultObj));

                                // Delete command file after processing
                                File.Delete(commandFile);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[FILE BRIDGE] Error: {ex.Message}");
                    }

                    await Task.Delay(100);
                }
            });

            OnLog?.Invoke("[BRIDGE] File-based bridge started");
        }

        // =========================================================================
        // UTILITIES
        // =========================================================================

        private string CleanJsResult(string result)
        {
            if (string.IsNullOrEmpty(result)) return "";

            // Remove surrounding quotes from JSON string result
            if (result.StartsWith("\"") && result.EndsWith("\""))
            {
                result = result.Substring(1, result.Length - 2);
            }

            // Unescape
            result = result.Replace("\\n", "\n")
                          .Replace("\\r", "\r")
                          .Replace("\\t", "\t")
                          .Replace("\\\"", "\"")
                          .Replace("\\\\", "\\");

            return result;
        }

        private string EscapeJs(string str)
        {
            return str.Replace("\\", "\\\\")
                     .Replace("'", "\\'")
                     .Replace("\"", "\\\"")
                     .Replace("\n", "\\n")
                     .Replace("\r", "\\r");
        }
    }
}
