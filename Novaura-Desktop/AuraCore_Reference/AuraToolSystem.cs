/*
 * AURA TOOL SYSTEM - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Give Aura actual capabilities - browser control, file ops, execution
 *
 * This is the C#-only version. No Python dependencies.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Diagnostics;

namespace AuraxNova_Command_v5.Core
{
    public enum ToolCategory
    {
        Browser,
        FileSystem,
        CodeExecution,
        WebAPI,
        GoogleServices,
        Database,
        System
    }

    public class Tool
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public ToolCategory Category { get; set; }
        public Dictionary<string, string> Parameters { get; set; }
        public Func<Dictionary<string, object>, Task<string>> Function { get; set; }
        public bool RequiresApproval { get; set; }

        public Tool(string name, string description, ToolCategory category,
                    Dictionary<string, string> parameters,
                    Func<Dictionary<string, object>, Task<string>> function,
                    bool requiresApproval = false)
        {
            Name = name;
            Description = description;
            Category = category;
            Parameters = parameters;
            Function = function;
            RequiresApproval = requiresApproval;
        }
    }

    public class ToolCall
    {
        public string ToolName { get; set; }
        public Dictionary<string, object> Arguments { get; set; }
        public string? Reasoning { get; set; }
    }

    public class ToolSystemResult
    {
        public bool Success { get; set; }
        public string Result { get; set; }
        public string? Error { get; set; }
        public double ExecutionTime { get; set; }
    }

    public class AuraToolSystem
    {
        private readonly Dictionary<string, Tool> _tools = new();
        private readonly List<Dictionary<string, object>> _executionLog = new();
        private readonly MainWindow _mainWindow; // Reference to UI for browser control

        public AuraToolSystem(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            RegisterAllTools();
        }

        private void RegisterAllTools()
        {
            RegisterBrowserTools();
            RegisterFileTools();
            RegisterCodeExecutionTools();
            RegisterWebTools();
        }

        #region Tool Registration

        private void RegisterBrowserTools()
        {
            RegisterTool(new Tool(
                "navigate_to",
                "Navigate browser to a specific URL",
                ToolCategory.Browser,
                new Dictionary<string, string> { { "url", "string - URL to navigate to" } },
                async args => await _mainWindow.NavigateToUrlAsync(args["url"].ToString()),
                requiresApproval: false
            ));

            RegisterTool(new Tool(
                "search_web",
                "Search Google and return results",
                ToolCategory.Browser,
                new Dictionary<string, string> { { "query", "string - Search query" } },
                async args => await _mainWindow.SearchGoogleAsync(args["query"].ToString()),
                requiresApproval: false
            ));

            RegisterTool(new Tool(
                "get_page_content",
                "Extract text content from current webpage",
                ToolCategory.Browser,
                new Dictionary<string, string>(),
                async args => await _mainWindow.GetPageContentAsync(),
                requiresApproval: false
            ));

            RegisterTool(new Tool(
                "extract_elements",
                "Extract elements from webpage using CSS selector",
                ToolCategory.Browser,
                new Dictionary<string, string> { { "selector", "string - CSS selector" } },
                async args => await _mainWindow.ExtractElementsAsync(args["selector"].ToString()),
                requiresApproval: false
            ));

            RegisterTool(new Tool(
                "take_screenshot",
                "Take screenshot of current browser view",
                ToolCategory.Browser,
                new Dictionary<string, string> { { "save_path", "string - Optional save path" } },
                async args =>
                {
                    var screenshot = await _mainWindow.TakeScreenshotAsync();
                    if (args.ContainsKey("save_path") && screenshot != null)
                    {
                        File.WriteAllBytes(args["save_path"].ToString(), screenshot);
                        return $"Screenshot saved to: {args["save_path"]}";
                    }
                    return screenshot != null ? $"Screenshot taken ({screenshot.Length} bytes)" : "Screenshot failed";
                },
                requiresApproval: false
            ));
        }

        private void RegisterFileTools()
        {
            RegisterTool(new Tool(
                "read_file",
                "Read contents of a file",
                ToolCategory.FileSystem,
                new Dictionary<string, string> { { "path", "string - File path" } },
                async args =>
                {
                    var path = args["path"].ToString();
                    return await Task.Run(() => File.ReadAllText(path));
                },
                requiresApproval: false
            ));

            RegisterTool(new Tool(
                "write_file",
                "Write content to a file",
                ToolCategory.FileSystem,
                new Dictionary<string, string>
                {
                    { "path", "string - File path" },
                    { "content", "string - Content to write" }
                },
                async args =>
                {
                    var path = args["path"].ToString();
                    var content = args["content"].ToString();
                    await Task.Run(() =>
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(path));
                        File.WriteAllText(path, content);
                    });
                    return $"File written: {path}";
                },
                requiresApproval: true
            ));

            RegisterTool(new Tool(
                "list_directory",
                "List files in a directory",
                ToolCategory.FileSystem,
                new Dictionary<string, string> { { "path", "string - Directory path" } },
                async args =>
                {
                    var path = args["path"].ToString();
                    return await Task.Run(() =>
                    {
                        var files = Directory.GetFiles(path);
                        var dirs = Directory.GetDirectories(path);
                        return JsonSerializer.Serialize(new { files, directories = dirs },
                            new JsonSerializerOptions { WriteIndented = true });
                    });
                },
                requiresApproval: false
            ));
        }

        private void RegisterCodeExecutionTools()
        {
            RegisterTool(new Tool(
                "execute_command",
                "Execute a system command",
                ToolCategory.CodeExecution,
                new Dictionary<string, string>
                {
                    { "command", "string - Command to execute" },
                    { "timeout", "int - Timeout in seconds (default 30)" }
                },
                async args =>
                {
                    var command = args["command"].ToString();
                    var timeout = args.ContainsKey("timeout") ? int.Parse(args["timeout"].ToString()) : 30;

                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "cmd.exe",
                            Arguments = $"/c {command}",
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        }
                    };

                    process.Start();
                    var output = await process.StandardOutput.ReadToEndAsync();
                    var error = await process.StandardError.ReadToEndAsync();

                    if (!process.WaitForExit(timeout * 1000))
                    {
                        process.Kill();
                        throw new TimeoutException($"Command timeout after {timeout}s");
                    }

                    return process.ExitCode == 0 ? output : $"Error: {error}";
                },
                requiresApproval: true
            ));
        }

        private void RegisterWebTools()
        {
            RegisterTool(new Tool(
                "http_get",
                "Make HTTP GET request",
                ToolCategory.WebAPI,
                new Dictionary<string, string> { { "url", "string - URL to request" } },
                async args =>
                {
                    var url = args["url"].ToString();
                    using var client = new HttpClient();
                    var response = await client.GetAsync(url);
                    var content = await response.Content.ReadAsStringAsync();

                    return JsonSerializer.Serialize(new
                    {
                        status = (int)response.StatusCode,
                        headers = response.Headers.ToDictionary(h => h.Key, h => string.Join(", ", h.Value)),
                        body = content
                    }, new JsonSerializerOptions { WriteIndented = true });
                },
                requiresApproval: false
            ));
        }

        #endregion

        public void RegisterTool(Tool tool)
        {
            _tools[tool.Name] = tool;
            Debug.WriteLine($"[TOOL SYSTEM]: Registered tool '{tool.Name}' ({tool.Category})");
        }

        public async Task<ToolSystemResult> ExecuteToolAsync(ToolCall toolCall)
        {
            var startTime = DateTime.Now;

            if (!_tools.ContainsKey(toolCall.ToolName))
            {
                return new ToolSystemResult
                {
                    Success = false,
                    Error = $"Unknown tool: {toolCall.ToolName}"
                };
            }

            var tool = _tools[toolCall.ToolName];

            try
            {
                var result = await tool.Function(toolCall.Arguments);
                var executionTime = (DateTime.Now - startTime).TotalSeconds;

                _executionLog.Add(new Dictionary<string, object>
                {
                    { "tool", toolCall.ToolName },
                    { "arguments", toolCall.Arguments },
                    { "success", true },
                    { "timestamp", DateTime.Now },
                    { "execution_time", executionTime }
                });

                return new ToolSystemResult
                {
                    Success = true,
                    Result = result,
                    ExecutionTime = executionTime
                };
            }
            catch (Exception ex)
            {
                var executionTime = (DateTime.Now - startTime).TotalSeconds;

                _executionLog.Add(new Dictionary<string, object>
                {
                    { "tool", toolCall.ToolName },
                    { "arguments", toolCall.Arguments },
                    { "success", false },
                    { "error", ex.Message },
                    { "timestamp", DateTime.Now },
                    { "execution_time", executionTime }
                });

                return new ToolSystemResult
                {
                    Success = false,
                    Error = ex.Message,
                    ExecutionTime = executionTime
                };
            }
        }

        public string GetToolsDescription()
        {
            var description = "# Available Tools\n\n";

            foreach (var category in Enum.GetValues<ToolCategory>())
            {
                var categoryTools = _tools.Values.Where(t => t.Category == category).ToList();
                if (categoryTools.Any())
                {
                    description += $"\n## {category.ToString().ToUpper()}\n";
                    foreach (var tool in categoryTools)
                    {
                        description += $"\n### {tool.Name}\n";
                        description += $"{tool.Description}\n";
                        description += $"Parameters: {JsonSerializer.Serialize(tool.Parameters)}\n";
                        if (tool.RequiresApproval)
                            description += "⚠️ Requires approval\n";
                    }
                }
            }

            return description;
        }

        public Dictionary<string, Tool> GetTools() => _tools;

        public void ExportExecutionLog(string filePath)
        {
            var json = JsonSerializer.Serialize(_executionLog, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(filePath, json);
            Debug.WriteLine($"[TOOL SYSTEM]: Execution log exported to {filePath}");
        }
    }
}
