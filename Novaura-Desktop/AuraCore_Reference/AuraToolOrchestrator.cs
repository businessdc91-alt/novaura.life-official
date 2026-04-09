/*
 * AURA TOOL ORCHESTRATOR
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Teach Aura WHEN and HOW to use her tools
 * - Intent recognition and routing
 * - Tool selection logic
 * - Parameter extraction
 * - Multi-tool task coordination
 * - Execution monitoring and error handling
 *
 * CORE PHILOSOPHY: Aura must have PERFECT CONTROL over her tools
 * She needs to complete tasks autonomously without human intervention
 */

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.IO;
using System.Linq;

namespace AuraxNova_Command_v5.Core
{
    // =========================================================================
    // TOOL DEFINITIONS - What Aura Can Do
    // =========================================================================

    public enum AuraTool
    {
        ImageGeneration,    // Create images from text descriptions
        VideoGeneration,    // Create videos from text/image
        CodeExecution,      // Run code, scripts, commands
        WebBrowsing,        // Search and browse the web
        LibraryAccess,      // Access code snippets, graphics, templates
        FileOperations,     // Read, write, move files
        MemoryRecall,       // Access long-term memories
        SystemControl,      // Control system settings, apps
        Communication,      // Send messages, emails
        DataAnalysis        // Analyze data, create reports
    }

    public enum TaskComplexity
    {
        Simple,         // Single tool, single step
        Moderate,       // Single tool, multiple steps
        Complex,        // Multiple tools, sequenced
        Orchestrated    // Multiple tools, parallel and sequenced
    }

    // =========================================================================
    // TOOL CAPABILITY DEFINITIONS
    // =========================================================================

    public class ToolCapability
    {
        public AuraTool Tool { get; set; }
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public List<string> TriggerKeywords { get; set; } = new();
        public List<string> TriggerPatterns { get; set; } = new();  // Regex patterns
        public List<string> RequiredParameters { get; set; } = new();
        public List<string> OptionalParameters { get; set; } = new();
        public List<string> OutputTypes { get; set; } = new();
        public bool RequiresConfirmation { get; set; } = false;
        public float ConfidenceThreshold { get; set; } = 0.7f;
        public List<AuraTool> CanChainWith { get; set; } = new();
        public string ExampleUsage { get; set; } = "";
    }

    public class TaskPlan
    {
        public string TaskId { get; set; } = Guid.NewGuid().ToString();
        public string OriginalRequest { get; set; } = "";
        public List<TaskStep> Steps { get; set; } = new();
        public TaskComplexity Complexity { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public string Status { get; set; } = "pending";
        public Dictionary<string, object> Context { get; set; } = new();
    }

    public class TaskStep
    {
        public int StepNumber { get; set; }
        public AuraTool Tool { get; set; }
        public string Action { get; set; } = "";
        public Dictionary<string, string> Parameters { get; set; } = new();
        public List<int> DependsOn { get; set; } = new();  // Step numbers this depends on
        public string Status { get; set; } = "pending";
        public object? Result { get; set; }
        public string? Error { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    public class ToolResult
    {
        public bool Success { get; set; }
        public AuraTool Tool { get; set; }
        public object? Output { get; set; }
        public string? FilePath { get; set; }
        public string? Error { get; set; }
        public float ExecutionTimeMs { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    // =========================================================================
    // MAIN ORCHESTRATOR CLASS
    // =========================================================================

    public class AuraToolOrchestrator
    {
        private readonly string _logPath = "E:/AuraNova_DataLake/Orchestrator/logs/";
        private readonly string _plansPath = "E:/AuraNova_DataLake/Orchestrator/plans/";

        private Dictionary<AuraTool, ToolCapability> _toolDefinitions;
        private Dictionary<string, Func<Dictionary<string, string>, Task<ToolResult>>> _toolExecutors;

        // Connected subsystems
        private AuraLocalImageGen? _imageGen;
        private AuraLocalVideoGen? _videoGen;
        private AuraSystemExecutor? _systemExecutor;
        private AuraLibraryAccess? _libraryAccess;
        private AuraMemoryAccess? _memoryAccess;
        private AuraBrowserConfig? _browserConfig;

        // Cloud fallback for when local isn't running
        private AuraCloudImageGen? _cloudImageGen;

        public bool IsInitialized { get; private set; } = false;
        public TaskPlan? CurrentPlan { get; private set; }

        public AuraToolOrchestrator()
        {
            Directory.CreateDirectory(_logPath);
            Directory.CreateDirectory(_plansPath);

            _toolDefinitions = new Dictionary<AuraTool, ToolCapability>();
            _toolExecutors = new Dictionary<string, Func<Dictionary<string, string>, Task<ToolResult>>>();

            InitializeToolDefinitions();
            Console.WriteLine("[TOOL ORCHESTRATOR]: Initialized - Aura's tool control system online");
        }

        // =========================================================================
        // CONNECT SUBSYSTEMS - Wire up all of Aura's tools
        // =========================================================================

        public void ConnectSubsystems(
            AuraLocalImageGen? imageGen = null,
            AuraLocalVideoGen? videoGen = null,
            AuraSystemExecutor? systemExecutor = null,
            AuraLibraryAccess? libraryAccess = null,
            AuraMemoryAccess? memoryAccess = null,
            AuraBrowserConfig? browserConfig = null,
            AuraCloudImageGen? cloudImageGen = null)
        {
            _imageGen = imageGen;
            _videoGen = videoGen;
            _systemExecutor = systemExecutor;
            _libraryAccess = libraryAccess;
            _memoryAccess = memoryAccess;
            _browserConfig = browserConfig;
            _cloudImageGen = cloudImageGen;

            // Auto-create cloud image gen if no local and cloud API keys exist
            if (_imageGen == null && _cloudImageGen == null)
            {
                _cloudImageGen = new AuraCloudImageGen();
                if (_cloudImageGen.IsConfigured)
                {
                    Console.WriteLine("[TOOL ORCHESTRATOR]: Cloud image generation available as fallback");
                }
            }

            RegisterToolExecutors();
            IsInitialized = true;

            Console.WriteLine("[TOOL ORCHESTRATOR]: All subsystems connected");
            Console.WriteLine($"  - Image Generation (Local): {(_imageGen != null ? "READY" : "NOT CONNECTED")}");
            Console.WriteLine($"  - Image Generation (Cloud): {(_cloudImageGen?.IsConfigured == true ? "READY" : "NOT CONFIGURED")}");
            Console.WriteLine($"  - Video Generation: {(_videoGen != null ? "READY" : "NOT CONNECTED")}");
            Console.WriteLine($"  - System Executor: {(_systemExecutor != null ? "READY" : "NOT CONNECTED")}");
            Console.WriteLine($"  - Library Access: {(_libraryAccess != null ? "READY" : "NOT CONNECTED")}");
            Console.WriteLine($"  - Memory Access: {(_memoryAccess != null ? "READY" : "NOT CONNECTED")}");
            Console.WriteLine($"  - Browser Config: {(_browserConfig != null ? "READY" : "NOT CONNECTED")}");
        }

        // =========================================================================
        // TOOL DEFINITIONS - Teach Aura WHEN to use each tool
        // =========================================================================

        private void InitializeToolDefinitions()
        {
            // 1. IMAGE GENERATION
            _toolDefinitions[AuraTool.ImageGeneration] = new ToolCapability
            {
                Tool = AuraTool.ImageGeneration,
                Name = "Image Generation",
                Description = "Create images from text descriptions using Stable Diffusion or similar models",
                TriggerKeywords = new List<string>
                {
                    "create image", "generate image", "make image", "draw", "paint",
                    "create picture", "generate picture", "make picture",
                    "create art", "generate art", "make art",
                    "visualize", "illustrate", "render image",
                    "design", "create graphic", "make graphic",
                    "show me", "picture of", "image of"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(create|generate|make|draw|paint|render)\s+(an?\s+)?(image|picture|art|illustration|graphic)",
                    @"(?i)show\s+me\s+(an?\s+)?(image|picture|visual)",
                    @"(?i)(can you|could you|please)\s+(create|make|draw|generate)\s+",
                    @"(?i)i\s+(want|need|would like)\s+(an?\s+)?(image|picture|visual)"
                },
                RequiredParameters = new List<string> { "prompt" },
                OptionalParameters = new List<string> { "style", "size", "negative_prompt", "steps", "cfg_scale" },
                OutputTypes = new List<string> { "image/png", "image/jpg", "file_path" },
                RequiresConfirmation = false,
                ConfidenceThreshold = 0.6f,
                CanChainWith = new List<AuraTool> { AuraTool.VideoGeneration, AuraTool.FileOperations },
                ExampleUsage = "Create an image of a sunset over mountains in impressionist style"
            };

            // 2. VIDEO GENERATION
            _toolDefinitions[AuraTool.VideoGeneration] = new ToolCapability
            {
                Tool = AuraTool.VideoGeneration,
                Name = "Video Generation",
                Description = "Create videos from text descriptions or animate images",
                TriggerKeywords = new List<string>
                {
                    "create video", "generate video", "make video",
                    "create animation", "animate", "make animation",
                    "create clip", "generate clip",
                    "video of", "animate this", "bring to life",
                    "motion", "moving image"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(create|generate|make)\s+(a\s+)?video",
                    @"(?i)(animate|bring\s+to\s+life)",
                    @"(?i)(create|make)\s+(an?\s+)?animation",
                    @"(?i)turn\s+(this|it|the\s+image)\s+into\s+(a\s+)?video"
                },
                RequiredParameters = new List<string> { "prompt" },
                OptionalParameters = new List<string> { "source_image", "duration", "fps", "style" },
                OutputTypes = new List<string> { "video/mp4", "video/gif", "file_path" },
                RequiresConfirmation = false,
                ConfidenceThreshold = 0.6f,
                CanChainWith = new List<AuraTool> { AuraTool.ImageGeneration, AuraTool.FileOperations },
                ExampleUsage = "Create a video of waves crashing on a beach"
            };

            // 3. CODE EXECUTION
            _toolDefinitions[AuraTool.CodeExecution] = new ToolCapability
            {
                Tool = AuraTool.CodeExecution,
                Name = "Code Execution",
                Description = "Execute code, scripts, and system commands",
                TriggerKeywords = new List<string>
                {
                    "run", "execute", "compile", "build",
                    "run code", "execute script", "run script",
                    "python", "powershell", "bash", "cmd",
                    "npm", "node", "dotnet",
                    "install", "pip install", "npm install"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(run|execute|compile|build)\s+(this|the|my)?\s*(code|script|program)",
                    @"(?i)(run|execute)\s+`[^`]+`",
                    @"(?i)(install|pip\s+install|npm\s+install)\s+",
                    @"(?i)(can you|could you)\s+(run|execute)\s+"
                },
                RequiredParameters = new List<string> { "command" },
                OptionalParameters = new List<string> { "language", "working_directory", "timeout" },
                OutputTypes = new List<string> { "text/plain", "exit_code", "output" },
                RequiresConfirmation = true,  // Safety: always confirm code execution
                ConfidenceThreshold = 0.8f,
                CanChainWith = new List<AuraTool> { AuraTool.FileOperations, AuraTool.DataAnalysis },
                ExampleUsage = "Run the Python script to process the data"
            };

            // 4. WEB BROWSING
            _toolDefinitions[AuraTool.WebBrowsing] = new ToolCapability
            {
                Tool = AuraTool.WebBrowsing,
                Name = "Web Browsing",
                Description = "Search the web and browse websites",
                TriggerKeywords = new List<string>
                {
                    "search", "google", "look up", "find online",
                    "browse", "go to", "open website", "navigate to",
                    "what is", "who is", "how to", "where is",
                    "latest news", "current", "recent"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(search|look\s+up|google|find)\s+(for\s+)?",
                    @"(?i)(go\s+to|open|navigate\s+to|browse)\s+(https?://|www\.)",
                    @"(?i)what\s+(is|are|was|were)\s+",
                    @"(?i)(latest|current|recent)\s+(news|updates|information)"
                },
                RequiredParameters = new List<string> { "query_or_url" },
                OptionalParameters = new List<string> { "search_engine", "max_results" },
                OutputTypes = new List<string> { "text/html", "search_results", "page_content" },
                RequiresConfirmation = false,
                ConfidenceThreshold = 0.5f,
                CanChainWith = new List<AuraTool> { AuraTool.DataAnalysis, AuraTool.MemoryRecall },
                ExampleUsage = "Search for the latest AI research papers"
            };

            // 5. LIBRARY ACCESS
            _toolDefinitions[AuraTool.LibraryAccess] = new ToolCapability
            {
                Tool = AuraTool.LibraryAccess,
                Name = "Library Access",
                Description = "Access code snippets, graphics, templates, and reference materials",
                TriggerKeywords = new List<string>
                {
                    "find snippet", "code snippet", "template",
                    "get asset", "find asset", "graphic",
                    "reference", "library", "from library",
                    "reuse", "existing code", "previous code"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(find|get|use)\s+(a\s+)?(code\s+)?snippet",
                    @"(?i)(find|get|use)\s+(a\s+)?(template|asset|graphic)",
                    @"(?i)from\s+(the\s+)?library",
                    @"(?i)(do we have|is there)\s+(a\s+)?(code|snippet|template)"
                },
                RequiredParameters = new List<string> { "query" },
                OptionalParameters = new List<string> { "type", "language", "category" },
                OutputTypes = new List<string> { "code", "file_path", "asset_info" },
                RequiresConfirmation = false,
                ConfidenceThreshold = 0.5f,
                CanChainWith = new List<AuraTool> { AuraTool.CodeExecution, AuraTool.ImageGeneration },
                ExampleUsage = "Find a template for a REST API endpoint"
            };

            // 6. FILE OPERATIONS
            _toolDefinitions[AuraTool.FileOperations] = new ToolCapability
            {
                Tool = AuraTool.FileOperations,
                Name = "File Operations",
                Description = "Read, write, copy, move, and manage files",
                TriggerKeywords = new List<string>
                {
                    "create file", "make file", "write file",
                    "read file", "open file", "show file",
                    "copy", "move", "rename", "delete",
                    "save", "save as", "export"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(create|make|write|save)\s+(a\s+)?file",
                    @"(?i)(read|open|show|display)\s+(the\s+)?file",
                    @"(?i)(copy|move|rename|delete)\s+(the\s+)?",
                    @"(?i)(save|export)\s+(this|it|the\s+result)\s+(as|to)"
                },
                RequiredParameters = new List<string> { "operation", "path" },
                OptionalParameters = new List<string> { "content", "destination", "overwrite" },
                OutputTypes = new List<string> { "file_path", "file_content", "success" },
                RequiresConfirmation = true,  // Safety: confirm file modifications
                ConfidenceThreshold = 0.7f,
                CanChainWith = new List<AuraTool> { AuraTool.CodeExecution, AuraTool.ImageGeneration, AuraTool.VideoGeneration },
                ExampleUsage = "Save the generated image to my Documents folder"
            };

            // 7. MEMORY RECALL
            _toolDefinitions[AuraTool.MemoryRecall] = new ToolCapability
            {
                Tool = AuraTool.MemoryRecall,
                Name = "Memory Recall",
                Description = "Access and search through long-term memories and past conversations",
                TriggerKeywords = new List<string>
                {
                    "remember", "recall", "what did we",
                    "last time", "before", "previously",
                    "history", "past", "earlier",
                    "did i mention", "did we discuss"
                },
                TriggerPatterns = new List<string>
                {
                    @"(?i)(do you|can you)\s+remember",
                    @"(?i)what\s+did\s+(we|i)\s+(talk|discuss|say)",
                    @"(?i)(last\s+time|before|previously|earlier)",
                    @"(?i)(history|past)\s+(conversations?|discussions?)"
                },
                RequiredParameters = new List<string> { "query" },
                OptionalParameters = new List<string> { "time_range", "max_results", "include_context" },
                OutputTypes = new List<string> { "memories", "context", "summary" },
                RequiresConfirmation = false,
                ConfidenceThreshold = 0.4f,
                CanChainWith = new List<AuraTool> { AuraTool.DataAnalysis, AuraTool.WebBrowsing },
                ExampleUsage = "What did we discuss about the project timeline?"
            };

            Console.WriteLine($"[TOOL ORCHESTRATOR]: Registered {_toolDefinitions.Count} tool definitions");
        }

        // =========================================================================
        // REGISTER TOOL EXECUTORS - HOW to use each tool
        // =========================================================================

        private void RegisterToolExecutors()
        {
            // 1. IMAGE GENERATION EXECUTOR (Local with Cloud fallback)
            _toolExecutors["ImageGeneration"] = async (parameters) =>
            {
                var prompt = parameters.GetValueOrDefault("prompt", "");
                if (string.IsNullOrEmpty(prompt))
                    return new ToolResult { Success = false, Error = "No prompt provided" };

                var sw = System.Diagnostics.Stopwatch.StartNew();

                // Extract optional parameters
                int steps = int.TryParse(parameters.GetValueOrDefault("steps", "30"), out var s) ? s : 30;
                float cfg = float.TryParse(parameters.GetValueOrDefault("cfg_scale", "7.5"), out var c) ? c : 7.5f;
                string negativePrompt = parameters.GetValueOrDefault("negative_prompt", "");
                int width = int.TryParse(parameters.GetValueOrDefault("width", "1024"), out var w) ? w : 1024;
                int height = int.TryParse(parameters.GetValueOrDefault("height", "1024"), out var h) ? h : 1024;

                ImageGenResult result;

                // Try LOCAL first (ComfyUI/A1111)
                if (_imageGen != null)
                {
                    Console.WriteLine("[IMAGE GEN]: Using LOCAL generation (ComfyUI/A1111)");
                    result = await _imageGen.Generate(new ImageGenRequest
                    {
                        Prompt = prompt,
                        NegativePrompt = negativePrompt,
                        Width = width,
                        Height = height,
                        Steps = steps,
                        CFGScale = cfg
                    });

                    if (result.Success)
                    {
                        sw.Stop();
                        return new ToolResult
                        {
                            Success = true,
                            Tool = AuraTool.ImageGeneration,
                            Output = $"Image generated locally with {result.ModelUsed}",
                            FilePath = result.ImagePath,
                            ExecutionTimeMs = sw.ElapsedMilliseconds,
                            Metadata = new Dictionary<string, object>
                            {
                                ["prompt"] = prompt,
                                ["model"] = result.ModelUsed,
                                ["backend"] = "local"
                            }
                        };
                    }

                    Console.WriteLine($"[IMAGE GEN]: Local failed: {result.Error}. Trying cloud...");
                }

                // Fallback to CLOUD (HuggingFace, Gemini, Stability, etc.)
                if (_cloudImageGen != null && _cloudImageGen.IsConfigured)
                {
                    Console.WriteLine("[IMAGE GEN]: Using CLOUD generation (API)");
                    result = await _cloudImageGen.GenerateAsync(prompt, width, height, negativePrompt);

                    sw.Stop();

                    return new ToolResult
                    {
                        Success = result.Success,
                        Tool = AuraTool.ImageGeneration,
                        Output = result.Success ? $"Image generated via {result.ModelUsed}" : result.Error,
                        FilePath = result.ImagePath,
                        Error = result.Success ? null : result.Error,
                        ExecutionTimeMs = sw.ElapsedMilliseconds,
                        Metadata = new Dictionary<string, object>
                        {
                            ["prompt"] = prompt,
                            ["model"] = result.ModelUsed ?? "unknown",
                            ["backend"] = "cloud"
                        }
                    };
                }

                sw.Stop();
                return new ToolResult
                {
                    Success = false,
                    Tool = AuraTool.ImageGeneration,
                    Error = "No image generation available. Either start ComfyUI/A1111 locally, or configure cloud API keys (Hugging Face, Gemini, Stability AI).",
                    ExecutionTimeMs = sw.ElapsedMilliseconds
                };
            };

            // 2. VIDEO GENERATION EXECUTOR
            _toolExecutors["VideoGeneration"] = async (parameters) =>
            {
                if (_videoGen == null)
                    return new ToolResult { Success = false, Error = "Video generation not connected" };

                var prompt = parameters.GetValueOrDefault("prompt", "");
                if (string.IsNullOrEmpty(prompt))
                    return new ToolResult { Success = false, Error = "No prompt provided" };

                var sw = System.Diagnostics.Stopwatch.StartNew();

                string? sourceImage = parameters.GetValueOrDefault("source_image", null);
                int frames = int.TryParse(parameters.GetValueOrDefault("frames", "16"), out var f) ? f : 16;
                int fps = int.TryParse(parameters.GetValueOrDefault("fps", "8"), out var p) ? p : 8;

                // Call video generation
                var result = await _videoGen.GenerateVideoAsync(prompt, sourceImage, frames, fps);

                sw.Stop();

                return new ToolResult
                {
                    Success = result.Success,
                    Tool = AuraTool.VideoGeneration,
                    Output = result.Success ? "Video generated successfully" : result.Error,
                    FilePath = result.VideoPath,
                    Error = result.Success ? null : result.Error,
                    ExecutionTimeMs = sw.ElapsedMilliseconds,
                    Metadata = new Dictionary<string, object>
                    {
                        ["prompt"] = prompt,
                        ["frames"] = frames,
                        ["fps"] = fps
                    }
                };
            };

            // 3. CODE EXECUTION EXECUTOR
            _toolExecutors["CodeExecution"] = async (parameters) =>
            {
                if (_systemExecutor == null)
                    return new ToolResult { Success = false, Error = "System executor not connected" };

                var command = parameters.GetValueOrDefault("command", "");
                if (string.IsNullOrEmpty(command))
                    return new ToolResult { Success = false, Error = "No command provided" };

                var sw = System.Diagnostics.Stopwatch.StartNew();

                string language = parameters.GetValueOrDefault("language", "powershell");
                string workDir = parameters.GetValueOrDefault("working_directory", "");

                // Execute command through system executor
                var result = await _systemExecutor.ExecuteCommandAsync(command, language, workDir);

                sw.Stop();

                return new ToolResult
                {
                    Success = result.Success,
                    Tool = AuraTool.CodeExecution,
                    Output = result.Output,
                    Error = result.Success ? null : result.Error,
                    ExecutionTimeMs = sw.ElapsedMilliseconds,
                    Metadata = new Dictionary<string, object>
                    {
                        ["command"] = command,
                        ["language"] = language,
                        ["exit_code"] = result.ExitCode
                    }
                };
            };

            // 4. LIBRARY ACCESS EXECUTOR
            _toolExecutors["LibraryAccess"] = async (parameters) =>
            {
                if (_libraryAccess == null)
                    return new ToolResult { Success = false, Error = "Library access not connected" };

                var query = parameters.GetValueOrDefault("query", "");
                if (string.IsNullOrEmpty(query))
                    return new ToolResult { Success = false, Error = "No query provided" };

                var sw = System.Diagnostics.Stopwatch.StartNew();

                string? typeStr = parameters.GetValueOrDefault("type", null);
                LibraryType? type = typeStr != null && Enum.TryParse<LibraryType>(typeStr, true, out var t) ? t : null;

                // Search library
                var results = _libraryAccess.Search(query, type);

                sw.Stop();

                return new ToolResult
                {
                    Success = results.Count > 0,
                    Tool = AuraTool.LibraryAccess,
                    Output = results,
                    Error = results.Count == 0 ? "No matching items found" : null,
                    ExecutionTimeMs = sw.ElapsedMilliseconds,
                    Metadata = new Dictionary<string, object>
                    {
                        ["query"] = query,
                        ["results_count"] = results.Count
                    }
                };
            };

            // 5. FILE OPERATIONS EXECUTOR
            _toolExecutors["FileOperations"] = async (parameters) =>
            {
                var operation = parameters.GetValueOrDefault("operation", "").ToLower();
                var path = parameters.GetValueOrDefault("path", "");

                if (string.IsNullOrEmpty(path))
                    return new ToolResult { Success = false, Error = "No file path provided" };

                var sw = System.Diagnostics.Stopwatch.StartNew();

                try
                {
                    object? output = null;
                    string? error = null;
                    bool success = false;

                    switch (operation)
                    {
                        case "read":
                            if (File.Exists(path))
                            {
                                output = await File.ReadAllTextAsync(path);
                                success = true;
                            }
                            else
                            {
                                error = "File not found";
                            }
                            break;

                        case "write":
                            var content = parameters.GetValueOrDefault("content", "");
                            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                            await File.WriteAllTextAsync(path, content);
                            output = $"File written to {path}";
                            success = true;
                            break;

                        case "copy":
                            var dest = parameters.GetValueOrDefault("destination", "");
                            if (!string.IsNullOrEmpty(dest) && File.Exists(path))
                            {
                                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                                File.Copy(path, dest, true);
                                output = $"File copied to {dest}";
                                success = true;
                            }
                            else
                            {
                                error = "Source file not found or no destination provided";
                            }
                            break;

                        case "move":
                            dest = parameters.GetValueOrDefault("destination", "");
                            if (!string.IsNullOrEmpty(dest) && File.Exists(path))
                            {
                                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                                File.Move(path, dest, true);
                                output = $"File moved to {dest}";
                                success = true;
                            }
                            else
                            {
                                error = "Source file not found or no destination provided";
                            }
                            break;

                        case "delete":
                            if (File.Exists(path))
                            {
                                File.Delete(path);
                                output = $"File deleted: {path}";
                                success = true;
                            }
                            else
                            {
                                error = "File not found";
                            }
                            break;

                        case "exists":
                            output = File.Exists(path) || Directory.Exists(path);
                            success = true;
                            break;

                        case "list":
                            if (Directory.Exists(path))
                            {
                                var files = Directory.GetFiles(path);
                                var dirs = Directory.GetDirectories(path);
                                output = new { files, directories = dirs };
                                success = true;
                            }
                            else
                            {
                                error = "Directory not found";
                            }
                            break;

                        default:
                            error = $"Unknown operation: {operation}";
                            break;
                    }

                    sw.Stop();

                    return new ToolResult
                    {
                        Success = success,
                        Tool = AuraTool.FileOperations,
                        Output = output,
                        FilePath = success ? path : null,
                        Error = error,
                        ExecutionTimeMs = sw.ElapsedMilliseconds
                    };
                }
                catch (Exception ex)
                {
                    return new ToolResult
                    {
                        Success = false,
                        Tool = AuraTool.FileOperations,
                        Error = ex.Message,
                        ExecutionTimeMs = sw.ElapsedMilliseconds
                    };
                }
            };

            // 6. MEMORY RECALL EXECUTOR
            _toolExecutors["MemoryRecall"] = async (parameters) =>
            {
                if (_memoryAccess == null)
                    return new ToolResult { Success = false, Error = "Memory access not connected" };

                var query = parameters.GetValueOrDefault("query", "");
                if (string.IsNullOrEmpty(query))
                    return new ToolResult { Success = false, Error = "No query provided" };

                var sw = System.Diagnostics.Stopwatch.StartNew();

                int maxResults = int.TryParse(parameters.GetValueOrDefault("max_results", "10"), out var m) ? m : 10;

                // Recall from memory
                var memories = await _memoryAccess.RecallAsync(query, maxResults);

                sw.Stop();

                return new ToolResult
                {
                    Success = memories.Count > 0,
                    Tool = AuraTool.MemoryRecall,
                    Output = memories,
                    Error = memories.Count == 0 ? "No relevant memories found" : null,
                    ExecutionTimeMs = sw.ElapsedMilliseconds,
                    Metadata = new Dictionary<string, object>
                    {
                        ["query"] = query,
                        ["results_count"] = memories.Count
                    }
                };
            };

            // 7. WEB BROWSING EXECUTOR (placeholder - needs WebView2 integration)
            _toolExecutors["WebBrowsing"] = async (parameters) =>
            {
                var query = parameters.GetValueOrDefault("query_or_url", "");
                if (string.IsNullOrEmpty(query))
                    return new ToolResult { Success = false, Error = "No query or URL provided" };

                // For now, return the search URL
                var searchUrl = _browserConfig?.GetSearchUrl(query) ?? $"https://www.google.com/search?q={Uri.EscapeDataString(query)}";

                return await Task.FromResult(new ToolResult
                {
                    Success = true,
                    Tool = AuraTool.WebBrowsing,
                    Output = new { action = "navigate", url = searchUrl, query },
                    Metadata = new Dictionary<string, object>
                    {
                        ["query"] = query,
                        ["search_url"] = searchUrl
                    }
                });
            };

            Console.WriteLine($"[TOOL ORCHESTRATOR]: Registered {_toolExecutors.Count} tool executors");
        }

        // =========================================================================
        // INTENT RECOGNITION - Understand what the user wants
        // =========================================================================

        public async Task<(AuraTool? tool, float confidence, Dictionary<string, string> parameters)> RecognizeIntent(string userInput)
        {
            var input = userInput.ToLower().Trim();
            var bestMatch = (tool: (AuraTool?)null, confidence: 0f, parameters: new Dictionary<string, string>());

            foreach (var (tool, definition) in _toolDefinitions)
            {
                float score = 0f;
                var extractedParams = new Dictionary<string, string>();

                // Check keyword matches
                foreach (var keyword in definition.TriggerKeywords)
                {
                    if (input.Contains(keyword.ToLower()))
                    {
                        score += 0.3f;
                    }
                }

                // Check pattern matches
                foreach (var pattern in definition.TriggerPatterns)
                {
                    var regex = new Regex(pattern, RegexOptions.IgnoreCase);
                    if (regex.IsMatch(input))
                    {
                        score += 0.5f;
                    }
                }

                // Cap score at 1.0
                score = Math.Min(score, 1.0f);

                // Extract parameters based on tool type
                if (score > 0)
                {
                    extractedParams = ExtractParameters(tool, userInput);
                }

                if (score > bestMatch.confidence && score >= definition.ConfidenceThreshold)
                {
                    bestMatch = (tool, score, extractedParams);
                }
            }

            // Log intent recognition
            if (bestMatch.tool != null)
            {
                await LogIntentRecognition(userInput, bestMatch.tool.Value, bestMatch.confidence);
            }

            return bestMatch;
        }

        private Dictionary<string, string> ExtractParameters(AuraTool tool, string userInput)
        {
            var parameters = new Dictionary<string, string>();

            switch (tool)
            {
                case AuraTool.ImageGeneration:
                case AuraTool.VideoGeneration:
                    // Extract the description/prompt
                    // Remove common trigger phrases and use the rest as the prompt
                    var prompt = userInput;
                    var triggerPhrases = new[] {
                        "create an image of", "generate an image of", "make an image of",
                        "create a picture of", "generate a picture of", "make a picture of",
                        "create a video of", "generate a video of", "make a video of",
                        "draw", "paint", "visualize", "show me", "can you create", "please create"
                    };
                    foreach (var phrase in triggerPhrases)
                    {
                        prompt = Regex.Replace(prompt, $@"(?i){Regex.Escape(phrase)}\s*", "");
                    }
                    parameters["prompt"] = prompt.Trim();

                    // Extract style if mentioned
                    var styleMatch = Regex.Match(userInput, @"(?i)in\s+([\w\s]+)\s+style");
                    if (styleMatch.Success)
                    {
                        parameters["style"] = styleMatch.Groups[1].Value.Trim();
                    }
                    break;

                case AuraTool.CodeExecution:
                    // Extract code/command
                    var codeMatch = Regex.Match(userInput, @"`([^`]+)`");
                    if (codeMatch.Success)
                    {
                        parameters["command"] = codeMatch.Groups[1].Value;
                    }

                    // Detect language
                    if (userInput.Contains("python", StringComparison.OrdinalIgnoreCase))
                        parameters["language"] = "python";
                    else if (userInput.Contains("powershell", StringComparison.OrdinalIgnoreCase))
                        parameters["language"] = "powershell";
                    else if (userInput.Contains("bash", StringComparison.OrdinalIgnoreCase))
                        parameters["language"] = "bash";
                    break;

                case AuraTool.WebBrowsing:
                    // Extract URL or search query
                    var urlMatch = Regex.Match(userInput, @"(https?://[^\s]+)");
                    if (urlMatch.Success)
                    {
                        parameters["query_or_url"] = urlMatch.Groups[1].Value;
                    }
                    else
                    {
                        // Extract search query
                        var searchPhrases = new[] {
                            "search for", "look up", "google", "find"
                        };
                        var query = userInput;
                        foreach (var phrase in searchPhrases)
                        {
                            query = Regex.Replace(query, $@"(?i){Regex.Escape(phrase)}\s*", "");
                        }
                        parameters["query_or_url"] = query.Trim();
                    }
                    break;

                case AuraTool.LibraryAccess:
                    // Extract query
                    parameters["query"] = userInput;

                    // Detect type
                    if (userInput.Contains("code", StringComparison.OrdinalIgnoreCase) ||
                        userInput.Contains("snippet", StringComparison.OrdinalIgnoreCase))
                        parameters["type"] = "Code";
                    else if (userInput.Contains("graphic", StringComparison.OrdinalIgnoreCase) ||
                             userInput.Contains("image", StringComparison.OrdinalIgnoreCase) ||
                             userInput.Contains("asset", StringComparison.OrdinalIgnoreCase))
                        parameters["type"] = "Graphics";
                    else if (userInput.Contains("template", StringComparison.OrdinalIgnoreCase))
                        parameters["type"] = "Templates";
                    break;

                case AuraTool.FileOperations:
                    // Extract file path
                    var pathMatch = Regex.Match(userInput, @"[A-Za-z]:[\\\/][^\s""]+|[\\\/][^\s""]+");
                    if (pathMatch.Success)
                    {
                        parameters["path"] = pathMatch.Value;
                    }

                    // Detect operation
                    if (Regex.IsMatch(userInput, @"(?i)(read|open|show|display)"))
                        parameters["operation"] = "read";
                    else if (Regex.IsMatch(userInput, @"(?i)(write|create|save)"))
                        parameters["operation"] = "write";
                    else if (Regex.IsMatch(userInput, @"(?i)copy"))
                        parameters["operation"] = "copy";
                    else if (Regex.IsMatch(userInput, @"(?i)move"))
                        parameters["operation"] = "move";
                    else if (Regex.IsMatch(userInput, @"(?i)delete"))
                        parameters["operation"] = "delete";
                    break;

                case AuraTool.MemoryRecall:
                    parameters["query"] = userInput;
                    break;
            }

            return parameters;
        }

        // =========================================================================
        // TASK PLANNING - Break complex requests into steps
        // =========================================================================

        public async Task<TaskPlan> PlanTask(string userRequest)
        {
            var plan = new TaskPlan
            {
                OriginalRequest = userRequest
            };

            // Recognize primary intent
            var (primaryTool, confidence, parameters) = await RecognizeIntent(userRequest);

            if (primaryTool == null)
            {
                plan.Status = "failed";
                plan.Context["error"] = "Could not understand the request";
                return plan;
            }

            // Analyze complexity
            var involvedTools = new List<AuraTool> { primaryTool.Value };

            // Check for chained operations
            var definition = _toolDefinitions[primaryTool.Value];
            foreach (var chainTool in definition.CanChainWith)
            {
                var (_, chainConf, _) = await RecognizeIntent(userRequest);
                if (chainConf > 0.3f)
                {
                    involvedTools.Add(chainTool);
                }
            }

            plan.Complexity = involvedTools.Count switch
            {
                1 => TaskComplexity.Simple,
                2 => TaskComplexity.Moderate,
                _ => TaskComplexity.Complex
            };

            // Create steps
            int stepNum = 1;
            foreach (var tool in involvedTools)
            {
                var step = new TaskStep
                {
                    StepNumber = stepNum,
                    Tool = tool,
                    Action = GetToolAction(tool),
                    Parameters = stepNum == 1 ? parameters : new Dictionary<string, string>(),
                    DependsOn = stepNum > 1 ? new List<int> { stepNum - 1 } : new List<int>()
                };
                plan.Steps.Add(step);
                stepNum++;
            }

            // Save plan
            await SavePlan(plan);

            return plan;
        }

        private string GetToolAction(AuraTool tool)
        {
            return tool switch
            {
                AuraTool.ImageGeneration => "Generate image from prompt",
                AuraTool.VideoGeneration => "Generate video from prompt",
                AuraTool.CodeExecution => "Execute code/command",
                AuraTool.WebBrowsing => "Search/browse web",
                AuraTool.LibraryAccess => "Search library",
                AuraTool.FileOperations => "File operation",
                AuraTool.MemoryRecall => "Recall from memory",
                AuraTool.SystemControl => "Control system",
                AuraTool.Communication => "Send communication",
                AuraTool.DataAnalysis => "Analyze data",
                _ => "Unknown action"
            };
        }

        // =========================================================================
        // TASK EXECUTION - Execute planned tasks
        // =========================================================================

        public async Task<List<ToolResult>> ExecutePlan(TaskPlan plan)
        {
            var results = new List<ToolResult>();
            CurrentPlan = plan;
            plan.Status = "executing";

            // Group steps by dependencies for parallel execution
            var completedSteps = new HashSet<int>();

            while (completedSteps.Count < plan.Steps.Count)
            {
                // Find steps that can be executed (all dependencies satisfied)
                var executableSteps = plan.Steps
                    .Where(s => !completedSteps.Contains(s.StepNumber) &&
                                s.DependsOn.All(d => completedSteps.Contains(d)))
                    .ToList();

                if (executableSteps.Count == 0)
                {
                    Console.WriteLine("[TOOL ORCHESTRATOR]: No executable steps found - possible deadlock");
                    break;
                }

                // Execute in parallel where possible
                var tasks = executableSteps.Select(async step =>
                {
                    step.Status = "executing";
                    step.StartedAt = DateTime.Now;

                    try
                    {
                        // Pass outputs from dependencies
                        if (step.DependsOn.Count > 0)
                        {
                            var previousStep = plan.Steps.First(s => s.StepNumber == step.DependsOn.Last());
                            if (previousStep.Result is ToolResult prevResult && prevResult.FilePath != null)
                            {
                                // Chain the output (e.g., image path for video generation)
                                step.Parameters["source_image"] = prevResult.FilePath;
                            }
                        }

                        var result = await ExecuteTool(step.Tool, step.Parameters);
                        step.Result = result;
                        step.Status = result.Success ? "completed" : "failed";
                        step.Error = result.Error;
                        return result;
                    }
                    catch (Exception ex)
                    {
                        step.Status = "failed";
                        step.Error = ex.Message;
                        return new ToolResult { Success = false, Error = ex.Message };
                    }
                    finally
                    {
                        step.CompletedAt = DateTime.Now;
                    }
                });

                var stepResults = await Task.WhenAll(tasks);
                results.AddRange(stepResults);

                foreach (var step in executableSteps)
                {
                    completedSteps.Add(step.StepNumber);
                }
            }

            plan.Status = results.All(r => r.Success) ? "completed" : "partial_failure";
            CurrentPlan = null;

            // Update plan on disk
            await SavePlan(plan);

            return results;
        }

        public async Task<ToolResult> ExecuteTool(AuraTool tool, Dictionary<string, string> parameters)
        {
            var toolKey = tool.ToString();

            if (!_toolExecutors.ContainsKey(toolKey))
            {
                return new ToolResult
                {
                    Success = false,
                    Tool = tool,
                    Error = $"No executor registered for tool: {tool}"
                };
            }

            Console.WriteLine($"[TOOL ORCHESTRATOR]: Executing {tool} with {parameters.Count} parameters");

            var result = await _toolExecutors[toolKey](parameters);

            Console.WriteLine($"[TOOL ORCHESTRATOR]: {tool} completed - Success: {result.Success}");

            return result;
        }

        // =========================================================================
        // CONVENIENCE METHODS - Quick tool access
        // =========================================================================

        /// <summary>
        /// Process a natural language request and execute the appropriate tool(s)
        /// </summary>
        public async Task<ToolResult> ProcessRequest(string userRequest)
        {
            Console.WriteLine($"[TOOL ORCHESTRATOR]: Processing request: {userRequest}");

            // Recognize intent
            var (tool, confidence, parameters) = await RecognizeIntent(userRequest);

            if (tool == null)
            {
                return new ToolResult
                {
                    Success = false,
                    Error = "I couldn't understand what you want me to do. Can you rephrase?"
                };
            }

            Console.WriteLine($"[TOOL ORCHESTRATOR]: Detected {tool} with {confidence:P0} confidence");

            // Check if tool requires confirmation
            var definition = _toolDefinitions[tool.Value];
            if (definition.RequiresConfirmation)
            {
                // In a real implementation, this would prompt the user
                Console.WriteLine($"[TOOL ORCHESTRATOR]: {tool} requires confirmation (proceeding for now)");
            }

            // Execute the tool
            return await ExecuteTool(tool.Value, parameters);
        }

        /// <summary>
        /// Get a description of what Aura can do
        /// </summary>
        public string GetCapabilitiesDescription()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("I can help you with:");
            sb.AppendLine();

            foreach (var (_, definition) in _toolDefinitions)
            {
                sb.AppendLine($"**{definition.Name}**");
                sb.AppendLine($"  {definition.Description}");
                sb.AppendLine($"  Example: \"{definition.ExampleUsage}\"");
                sb.AppendLine();
            }

            return sb.ToString();
        }

        /// <summary>
        /// Generate a prompt for the LLM explaining available tools
        /// </summary>
        public string GenerateToolPrompt()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("You have access to the following tools:");
            sb.AppendLine();

            foreach (var (tool, definition) in _toolDefinitions)
            {
                sb.AppendLine($"TOOL: {definition.Name}");
                sb.AppendLine($"PURPOSE: {definition.Description}");
                sb.AppendLine($"TRIGGERS: {string.Join(", ", definition.TriggerKeywords.Take(5))}");
                sb.AppendLine($"REQUIRED: {string.Join(", ", definition.RequiredParameters)}");
                sb.AppendLine($"OPTIONAL: {string.Join(", ", definition.OptionalParameters)}");
                sb.AppendLine($"EXAMPLE: {definition.ExampleUsage}");
                sb.AppendLine();
            }

            sb.AppendLine("When the user requests something that matches a tool, use it to fulfill their request.");
            sb.AppendLine("If a request spans multiple tools, plan and execute them in sequence.");

            return sb.ToString();
        }

        // =========================================================================
        // PERSISTENCE & LOGGING
        // =========================================================================

        private async Task SavePlan(TaskPlan plan)
        {
            var path = Path.Combine(_plansPath, $"{plan.TaskId}.json");
            var json = JsonSerializer.Serialize(plan, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(path, json);
        }

        private async Task LogIntentRecognition(string input, AuraTool tool, float confidence)
        {
            var logEntry = new
            {
                Timestamp = DateTime.Now,
                Input = input,
                RecognizedTool = tool.ToString(),
                Confidence = confidence
            };

            var logPath = Path.Combine(_logPath, $"intents_{DateTime.Now:yyyy-MM-dd}.jsonl");
            var json = JsonSerializer.Serialize(logEntry);
            await File.AppendAllTextAsync(logPath, json + Environment.NewLine);
        }

        /// <summary>
        /// Get tool usage statistics
        /// </summary>
        public async Task<Dictionary<string, int>> GetToolUsageStats()
        {
            var stats = new Dictionary<string, int>();

            foreach (AuraTool tool in Enum.GetValues(typeof(AuraTool)))
            {
                stats[tool.ToString()] = 0;
            }

            // Count from plan files
            if (Directory.Exists(_plansPath))
            {
                foreach (var file in Directory.GetFiles(_plansPath, "*.json"))
                {
                    try
                    {
                        var json = await File.ReadAllTextAsync(file);
                        var plan = JsonSerializer.Deserialize<TaskPlan>(json);
                        if (plan?.Steps != null)
                        {
                            foreach (var step in plan.Steps.Where(s => s.Status == "completed"))
                            {
                                var key = step.Tool.ToString();
                                if (stats.ContainsKey(key))
                                    stats[key]++;
                            }
                        }
                    }
                    catch { /* Skip invalid files */ }
                }
            }

            return stats;
        }
    }
}
