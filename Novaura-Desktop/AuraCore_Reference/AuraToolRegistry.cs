/*
 * AURA TOOL REGISTRY - AI Function Calling System
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Register ALL AuraxNova systems as callable tools for the AI
 *
 * THE REVOLUTION:
 * - Users don't see complex UI by default
 * - They just talk to Aura naturally
 * - AI invokes tools through conversation
 * - Advanced users can toggle to manual mode
 *
 * EXAMPLES:
 * User: "Schedule a meeting with John tomorrow at 2pm"
 * → AI calls: Calendar.CreateEvent("Meeting with John", tomorrow 2pm)
 *
 * User: "Write me a resume for a senior developer position"
 * → AI calls: CreativeTools.BuildResume(userInfo, "senior developer")
 *
 * User: "Find all notes about machine learning"
 * → AI calls: Notes.SearchNotes("machine learning")
 *
 * This is JARVIS-level interaction.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Represents a tool/function that AI can call
    /// </summary>
    public class AuraToolDefinition
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Category { get; set; }  // "email", "calendar", "creative", etc.
        public List<ToolParameter> Parameters { get; set; } = new();
        public Func<Dictionary<string, object>, Task<object>> ExecuteAsync { get; set; }
        public bool RequiresAdvancedMode { get; set; } = false;  // Some tools only in advanced mode
    }

    public class ToolParameter
    {
        public string Name { get; set; }
        public string Type { get; set; }  // "string", "int", "datetime", "bool"
        public string Description { get; set; }
        public bool Required { get; set; } = true;
        public object DefaultValue { get; set; }
    }

    /// <summary>
    /// Registers all AuraxNova systems as AI-callable tools
    /// AI can invoke ANY feature through natural conversation
    /// </summary>
    public class AuraToolRegistry
    {
        private readonly AuraInstance _aura;
        private readonly Dictionary<string, AuraToolDefinition> _tools = new();
        private bool _advancedModeEnabled = false;

        public AuraToolRegistry(AuraInstance aura)
        {
            _aura = aura;
            RegisterAllTools();
        }

        public void EnableAdvancedMode(bool enabled)
        {
            _advancedModeEnabled = enabled;
        }

        public List<AuraToolDefinition> GetAvailableTools()
        {
            if (_advancedModeEnabled)
                return _tools.Values.ToList();
            else
                return _tools.Values.Where(t => !t.RequiresAdvancedMode).ToList();
        }

        /// <summary>
        /// Get tools formatted for Gemini function calling API
        /// </summary>
        public string GetToolsForAI()
        {
            var availableTools = GetAvailableTools();

            var toolDefinitions = availableTools.Select(tool => new
            {
                name = tool.Name,
                description = tool.Description,
                parameters = new
                {
                    type = "object",
                    properties = tool.Parameters.ToDictionary(
                        p => p.Name,
                        p => new
                        {
                            type = p.Type,
                            description = p.Description
                        }
                    ),
                    required = tool.Parameters.Where(p => p.Required).Select(p => p.Name).ToArray()
                }
            });

            return JsonSerializer.Serialize(new { tools = toolDefinitions });
        }

        /// <summary>
        /// Execute a tool call from AI
        /// </summary>
        public async Task<object> ExecuteToolAsync(string toolName, Dictionary<string, object> parameters)
        {
            if (!_tools.ContainsKey(toolName))
                throw new Exception($"Tool '{toolName}' not found");

            var tool = _tools[toolName];

            // Check if tool requires advanced mode
            if (tool.RequiresAdvancedMode && !_advancedModeEnabled)
                throw new Exception($"Tool '{toolName}' requires advanced mode to be enabled");

            return await tool.ExecuteAsync(parameters);
        }

        /// <summary>
        /// Get all registered tools - compatibility method for AuraMasterInit
        /// </summary>
        public Dictionary<string, AuraToolDefinition> GetAllTools()
        {
            return new Dictionary<string, AuraToolDefinition>(_tools);
        }

        #region Tool Registration

        private void RegisterAllTools()
        {
            RegisterEmailTools();
            RegisterCalendarTools();
            RegisterNotesTools();
            RegisterScratchpadTools();
            RegisterTaskTools();
            RegisterMediaTools();
            RegisterFinanceTools();
            RegisterCreativeTools();
            RegisterWritingTools();
            RegisterCollaborationTools();
            RegisterMemoryTools();
            RegisterSystemTools();
        }

        private void RegisterEmailTools()
        {
            // Compose email
            _tools.Add("compose_email", new AuraToolDefinition
            {
                Name = "compose_email",
                Description = "Compose and polish an email with AI assistance",
                Category = "email",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "to", Type = "string", Description = "Recipient email address" },
                    new() { Name = "subject", Type = "string", Description = "Email subject" },
                    new() { Name = "draft_body", Type = "string", Description = "Draft email body to polish" }
                },
                ExecuteAsync = async (args) =>
                {
                    var email = await _aura.Email.ComposeEmailAsync(
                        args["to"].ToString(),
                        args["subject"].ToString(),
                        args["draft_body"].ToString()
                    );
                    return new { success = true, polished_body = email.Body, message = "Email composed and polished" };
                }
            });

            // Suggest reply
            _tools.Add("suggest_email_reply", new AuraToolDefinition
            {
                Name = "suggest_email_reply",
                Description = "Generate smart reply suggestions for an email",
                Category = "email",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "original_email", Type = "string", Description = "The email to reply to" }
                },
                ExecuteAsync = async (args) =>
                {
                    var email = new Email { Body = args["original_email"].ToString() };
                    var suggestion = await _aura.Email.SuggestReplyAsync(email);
                    return new { success = true, suggestion, message = "Generated reply suggestion" };
                }
            });

            // Categorize email
            _tools.Add("categorize_email", new AuraToolDefinition
            {
                Name = "categorize_email",
                Description = "Automatically categorize an email by content",
                Category = "email",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "email_content", Type = "string", Description = "Email content to categorize" }
                },
                ExecuteAsync = async (args) =>
                {
                    var email = new Email { Body = args["email_content"].ToString() };
                    await _aura.Email.CategorizeEmailAsync(email);
                    return new { success = true, category = email.Category, importance = email.ImportanceScore, tags = email.Tags };
                }
            });
        }

        private void RegisterCalendarTools()
        {
            // Create event
            _tools.Add("create_calendar_event", new AuraToolDefinition
            {
                Name = "create_calendar_event",
                Description = "Create a calendar event with AI priority assignment",
                Category = "calendar",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "title", Type = "string", Description = "Event title" },
                    new() { Name = "description", Type = "string", Description = "Event description", Required = false },
                    new() { Name = "start_time", Type = "string", Description = "Start time (ISO 8601 format)" },
                    new() { Name = "end_time", Type = "string", Description = "End time (ISO 8601 format)", Required = false }
                },
                ExecuteAsync = async (args) =>
                {
                    var evt = new CalendarEvent
                    {
                        Title = args["title"].ToString(),
                        Description = args.ContainsKey("description") ? args["description"].ToString() : "",
                        StartTime = DateTime.Parse(args["start_time"].ToString()),
                        EndTime = args.ContainsKey("end_time")
                            ? DateTime.Parse(args["end_time"].ToString())
                            : DateTime.Parse(args["start_time"].ToString()).AddHours(1)
                    };

                    evt.Priority = await _aura.Calendar.AssignPriorityAsync(evt);
                    await _aura.Calendar.AddEventAsync(evt);

                    return new { success = true, event_id = evt.Id, priority = evt.Priority, message = $"Event '{evt.Title}' created with priority {evt.Priority}/5" };
                }
            });

            // Optimize schedule
            _tools.Add("optimize_schedule", new AuraToolDefinition
            {
                Name = "optimize_schedule",
                Description = "Get AI-optimized schedule with focus blocks for tasks",
                Category = "calendar",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "date", Type = "string", Description = "Date to optimize (ISO 8601 format)" },
                    new() { Name = "tasks", Type = "array", Description = "List of tasks to schedule" }
                },
                ExecuteAsync = async (args) =>
                {
                    var date = DateTime.Parse(args["date"].ToString());
                    var tasks = JsonSerializer.Deserialize<List<string>>(args["tasks"].ToString());

                    var schedule = await _aura.Calendar.SuggestOptimalScheduleAsync(date, tasks);

                    return new { success = true, focus_blocks = schedule, message = $"Optimized schedule with {schedule.Count} focus blocks" };
                }
            });
        }

        private void RegisterNotesTools()
        {
            // Create note
            _tools.Add("create_note", new AuraToolDefinition
            {
                Name = "create_note",
                Description = "Create a note with AI-generated tags and linked notes",
                Category = "notes",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "title", Type = "string", Description = "Note title" },
                    new() { Name = "content", Type = "string", Description = "Note content" }
                },
                ExecuteAsync = async (args) =>
                {
                    var note = await _aura.Notes.CreateNoteAsync(
                        args["title"].ToString(),
                        args["content"].ToString()
                    );

                    return new {
                        success = true,
                        note_id = note.Id,
                        tags = note.Tags,
                        linked_notes = note.LinkedNotes.Count,
                        message = $"Note created with {note.Tags.Count} tags and {note.LinkedNotes.Count} links"
                    };
                }
            });

            // Search notes (semantic)
            _tools.Add("search_notes", new AuraToolDefinition
            {
                Name = "search_notes",
                Description = "Search notes using semantic similarity (not just keywords)",
                Category = "notes",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "query", Type = "string", Description = "Search query" },
                    new() { Name = "limit", Type = "int", Description = "Max results to return", Required = false, DefaultValue = 10 }
                },
                ExecuteAsync = async (args) =>
                {
                    var query = args["query"].ToString();
                    var limit = args.ContainsKey("limit") ? int.Parse(args["limit"].ToString()) : 10;

                    var results = await _aura.Notes.SearchNotesAsync(query);
                    var limitedResults = results.Take(limit).ToList();

                    return new {
                        success = true,
                        results = limitedResults.Select(n => new { n.Id, n.Title, preview = n.Content.Substring(0, Math.Min(100, n.Content.Length)) }),
                        total_found = results.Count,
                        message = $"Found {results.Count} notes matching '{query}'"
                    };
                }
            });
        }

        private void RegisterTaskTools()
        {
            // Create task
            _tools.Add("create_task", new AuraToolDefinition
            {
                Name = "create_task",
                Description = "Create a task with AI duration estimation and priority",
                Category = "tasks",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "title", Type = "string", Description = "Task title" },
                    new() { Name = "description", Type = "string", Description = "Task description", Required = false },
                    new() { Name = "due_date", Type = "string", Description = "Due date (ISO 8601 format)", Required = false }
                },
                ExecuteAsync = async (args) =>
                {
                    var task = await _aura.Tasks.CreateTaskAsync(
                        args["title"].ToString(),
                        args.ContainsKey("description") ? args["description"].ToString() : ""
                    );

                    if (args.ContainsKey("due_date"))
                        task.DueDate = DateTime.Parse(args["due_date"].ToString());

                    return new {
                        success = true,
                        task_id = task.Id,
                        estimated_duration = task.EstimatedDuration,
                        priority = task.Priority,
                        subtasks = task.SubTasks.Count,
                        message = $"Task created: {task.EstimatedDuration} min estimated, priority {task.Priority}, {task.SubTasks.Count} subtasks"
                    };
                }
            });

            // Get today's tasks
            _tools.Add("get_today_tasks", new AuraToolDefinition
            {
                Name = "get_today_tasks",
                Description = "Get all tasks due today, sorted by priority",
                Category = "tasks",
                Parameters = new List<ToolParameter>(),
                ExecuteAsync = async (args) =>
                {
                    var tasks = await _aura.Tasks.GetTasksDueAsync(DateTime.Today);
                    var prioritized = tasks.OrderByDescending(t => t.Priority).ToList();

                    return new {
                        success = true,
                        tasks = prioritized.Select(t => new { t.Id, t.Title, t.Priority, t.EstimatedDuration, t.Status }),
                        count = tasks.Count,
                        message = $"Found {tasks.Count} tasks for today"
                    };
                }
            });
        }

        private void RegisterMediaTools()
        {
            // Import media
            _tools.Add("import_media", new AuraToolDefinition
            {
                Name = "import_media",
                Description = "Import media file with AI tagging and description",
                Category = "media",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "file_path", Type = "string", Description = "Path to media file" }
                },
                ExecuteAsync = async (args) =>
                {
                    var mediaFile = await _aura.Media.ImportMediaAsync(args["file_path"].ToString());

                    return new {
                        success = true,
                        media_id = mediaFile.Id,
                        ai_description = mediaFile.AIDescription,
                        tags = mediaFile.AITags,
                        message = $"Media imported with {mediaFile.AITags.Count} tags"
                    };
                }
            });

            // Search media
            _tools.Add("search_media", new AuraToolDefinition
            {
                Name = "search_media",
                Description = "Search media by semantic description",
                Category = "media",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "query", Type = "string", Description = "Search query" }
                },
                ExecuteAsync = async (args) =>
                {
                    var results = await _aura.Media.SearchMediaAsync(args["query"].ToString());

                    return new {
                        success = true,
                        results = results.Select(m => new { m.Id, m.FileName, m.AIDescription }),
                        count = results.Count,
                        message = $"Found {results.Count} media files"
                    };
                }
            });
        }

        private void RegisterFinanceTools()
        {
            // Record transaction
            _tools.Add("record_transaction", new AuraToolDefinition
            {
                Name = "record_transaction",
                Description = "Record financial transaction with AI categorization",
                Category = "finance",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "amount", Type = "number", Description = "Transaction amount" },
                    new() { Name = "description", Type = "string", Description = "Transaction description" },
                    new() { Name = "type", Type = "string", Description = "Transaction type: 'income' or 'expense'" }
                },
                ExecuteAsync = async (args) =>
                {
                    var transaction = await _aura.Finance.RecordTransactionAsync(
                        decimal.Parse(args["amount"].ToString()),
                        args["description"].ToString(),
                        args["type"].ToString()
                    );

                    return new {
                        success = true,
                        transaction_id = transaction.Id,
                        category = transaction.Category,
                        tax_deductible = transaction.IsTaxDeductible,
                        message = $"Transaction recorded: {transaction.Category}" + (transaction.IsTaxDeductible ? " (tax deductible)" : "")
                    };
                }
            });

            // Get monthly summary
            _tools.Add("get_finance_summary", new AuraToolDefinition
            {
                Name = "get_finance_summary",
                Description = "Get financial summary for a specific month",
                Category = "finance",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "year", Type = "int", Description = "Year" },
                    new() { Name = "month", Type = "int", Description = "Month (1-12)" }
                },
                ExecuteAsync = async (args) =>
                {
                    var year = int.Parse(args["year"].ToString());
                    var month = int.Parse(args["month"].ToString());

                    var summary = await _aura.Finance.GetMonthlySummaryAsync(year, month);

                    return new {
                        success = true,
                        total_income = summary.GetValueOrDefault("total_income", 0m),
                        total_expenses = summary.GetValueOrDefault("total_expenses", 0m),
                        net = summary.GetValueOrDefault("net", 0m),
                        tax_deductible = summary.GetValueOrDefault("tax_deductible", 0m),
                        message = $"Summary for {month}/{year}: Net ${summary.GetValueOrDefault("net", 0m):F2}"
                    };
                }
            });
        }

        private void RegisterCreativeTools()
        {
            // Build resume
            _tools.Add("build_resume", new AuraToolDefinition
            {
                Name = "build_resume",
                Description = "Build a professional resume with AI optimization",
                Category = "creative",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "user_info", Type = "object", Description = "User information (name, email, experience, education)" },
                    new() { Name = "template_style", Type = "string", Description = "Template style: modern, classic, creative, executive", Required = false, DefaultValue = "modern" }
                },
                ExecuteAsync = async (args) =>
                {
                    var userInfo = JsonSerializer.Deserialize<Dictionary<string, object>>(args["user_info"].ToString());
                    var style = args.ContainsKey("template_style") ? args["template_style"].ToString() : "modern";

                    var resume = await _aura.CreativeTools.BuildResumeAsync(userInfo, style);

                    return new {
                        success = true,
                        resume_id = resume.Id,
                        professional_summary = resume.ProfessionalSummary,
                        message = "Resume built and optimized for ATS"
                    };
                }
            });

            // Create comic book
            _tools.Add("create_comic", new AuraToolDefinition
            {
                Name = "create_comic",
                Description = "Create a comic book with AI-generated panels and character consistency",
                Category = "creative",
                RequiresAdvancedMode = true,  // Complex tool
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "title", Type = "string", Description = "Comic title" },
                    new() { Name = "plot", Type = "string", Description = "Story plot" },
                    new() { Name = "page_count", Type = "int", Description = "Number of pages", Required = false, DefaultValue = 20 }
                },
                ExecuteAsync = async (args) =>
                {
                    var pageCount = args.ContainsKey("page_count") ? int.Parse(args["page_count"].ToString()) : 20;

                    var comic = await _aura.CreativeTools.CreateComicBookAsync(
                        args["title"].ToString(),
                        args["plot"].ToString(),
                        pageCount
                    );

                    return new {
                        success = true,
                        comic_id = comic.Id,
                        page_count = comic.Pages.Count,
                        characters = comic.CharacterReferenceImages.Count,
                        message = $"Comic created: {comic.Pages.Count} pages, {comic.CharacterReferenceImages.Count} characters"
                    };
                }
            });

            // Compose music
            _tools.Add("compose_music", new AuraToolDefinition
            {
                Name = "compose_music",
                Description = "Compose sheet music from description",
                Category = "creative",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "description", Type = "string", Description = "Music description (mood, style, instruments)" },
                    new() { Name = "style", Type = "string", Description = "Musical style: classical, jazz, rock, etc.", Required = false, DefaultValue = "classical" }
                },
                ExecuteAsync = async (args) =>
                {
                    var style = args.ContainsKey("style") ? args["style"].ToString() : "classical";

                    var sheetMusic = await _aura.CreativeTools.ComposeSheetMusicAsync(
                        args["description"].ToString(),
                        style
                    );

                    return new {
                        success = true,
                        title = sheetMusic.Title,
                        tempo = sheetMusic.Tempo,
                        time_signature = sheetMusic.TimeSignature,
                        bars = sheetMusic.Bars.Count,
                        message = $"Composed {sheetMusic.Bars.Count} bars at {sheetMusic.Tempo} BPM"
                    };
                }
            });
        }

        private void RegisterWritingTools()
        {
            // Generate character
            _tools.Add("generate_character", new AuraToolDefinition
            {
                Name = "generate_character",
                Description = "Generate detailed character for story with AI",
                Category = "writing",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "name", Type = "string", Description = "Character name" },
                    new() { Name = "concept", Type = "string", Description = "Character concept/description" }
                },
                ExecuteAsync = async (args) =>
                {
                    var characterDetails = await _aura.WritingStudio.GenerateCharacterAsync(
                        args["name"].ToString(),
                        args["concept"].ToString()
                    );

                    // GenerateCharacterAsync returns List<string> with character description
                    var description = characterDetails.Count > 0 ? characterDetails[0] : "Character generated";

                    return new {
                        success = true,
                        name = args["name"].ToString(),
                        description = description,
                        message = $"Character '{args["name"]}' generated"
                    };
                }
            });

            // Generate plot outline
            _tools.Add("generate_plot", new AuraToolDefinition
            {
                Name = "generate_plot",
                Description = "Generate story plot outline with three-act structure",
                Category = "writing",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "premise", Type = "string", Description = "Story premise/concept" },
                    new() { Name = "genre", Type = "string", Description = "Story genre", Required = false }
                },
                ExecuteAsync = async (args) =>
                {
                    var genre = args.ContainsKey("genre") ? args["genre"].ToString() : "general";

                    // GeneratePlotOutlineAsync returns string, not structured object
                    var outlineText = await _aura.WritingStudio.GeneratePlotOutlineAsync(
                        args["premise"].ToString(),
                        genre
                    );

                    return new {
                        success = true,
                        outline = outlineText,
                        message = "Plot outline generated successfully"
                    };
                }
            });

            // Edit paragraph
            _tools.Add("edit_paragraph", new AuraToolDefinition
            {
                Name = "edit_paragraph",
                Description = "Edit and improve a paragraph of writing",
                Category = "writing",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "paragraph", Type = "string", Description = "Original paragraph" },
                    new() { Name = "instruction", Type = "string", Description = "Editing instruction (e.g., 'make more suspenseful')" }
                },
                ExecuteAsync = async (args) =>
                {
                    var edited = await _aura.WritingStudio.EditParagraphAsync(
                        args["paragraph"].ToString(),
                        args["instruction"].ToString()
                    );

                    return new {
                        success = true,
                        edited_paragraph = edited,
                        message = "Paragraph edited and improved"
                    };
                }
            });
        }

        private void RegisterCollaborationTools()
        {
            // Share file (smart)
            _tools.Add("share_file", new AuraToolDefinition
            {
                Name = "share_file",
                Description = "Share file using smart method (P2P or Cloud based on connection)",
                Category = "collaboration",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "file_path", Type = "string", Description = "File path to share" },
                    new() { Name = "share_with_user_ids", Type = "array", Description = "User IDs to share with" },
                    new() { Name = "method", Type = "string", Description = "Sharing method: automatic, p2p, cloud", Required = false, DefaultValue = "automatic" }
                },
                ExecuteAsync = async (args) =>
                {
                    var userIds = JsonSerializer.Deserialize<List<string>>(args["share_with_user_ids"].ToString());
                    var method = args.ContainsKey("method") ? args["method"].ToString() : "automatic";

                    SharingMethod sharingMethod = method.ToLower() switch
                    {
                        "p2p" => SharingMethod.P2P_RemoteAccess,
                        "cloud" => SharingMethod.CloudUpload,
                        _ => SharingMethod.Automatic
                    };

                    var options = new FileShareOptions
                    {
                        FilePath = args["file_path"].ToString(),
                        ShareWithUserIds = userIds,
                        PreferredMethod = sharingMethod
                    };

                    // ShareFileSmartAsync returns a share ID string
                    var shareId = await _aura.SmartSharing.ShareFileSmartAsync(options);

                    return new {
                        success = true,
                        share_id = shareId,
                        method_used = options.Method.ToString(),
                        message = $"File shared successfully (ID: {shareId})"
                    };
                }
            });
        }

        private void RegisterMemoryTools()
        {
            // Store memory
            _tools.Add("store_memory", new AuraToolDefinition
            {
                Name = "store_memory",
                Description = "Store information in long-term memory (engram-based)",
                Category = "memory",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "content", Type = "string", Description = "Information to remember" },
                    new() { Name = "context", Type = "object", Description = "Additional context (emotion, tags, etc.)", Required = false }
                },
                ExecuteAsync = async (args) =>
                {
                    var content = args["content"].ToString();
                    Dictionary<string, object>? contextMetadata = null;

                    if (args.ContainsKey("context"))
                    {
                        contextMetadata = JsonSerializer.Deserialize<Dictionary<string, object>>(args["context"].ToString());
                    }

                    await _aura.Memory.StoreMemoryAsync(content, "general", contextMetadata);

                    return new {
                        success = true,
                        engram_count = _aura.Memory.GetEngrams().Count,
                        message = "Memory stored successfully"
                    };
                }
            });

            // Recall memories
            _tools.Add("recall_memories", new AuraToolDefinition
            {
                Name = "recall_memories",
                Description = "Recall similar memories from long-term storage",
                Category = "memory",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "query", Type = "string", Description = "What to remember" },
                    new() { Name = "limit", Type = "int", Description = "Max memories to recall", Required = false, DefaultValue = 5 }
                },
                ExecuteAsync = async (args) =>
                {
                    var limit = args.ContainsKey("limit") ? int.Parse(args["limit"].ToString()) : 5;

                    // RecallSimilarAsync returns List<Engram>, not List<Dictionary>
                    var engrams = await _aura.Memory.RecallSimilarAsync(args["query"].ToString(), limit);

                    return new {
                        success = true,
                        memories = engrams.Select(e => new {
                            content = e.SemanticContent ?? "",
                            timestamp = e.Timestamp
                        }),
                        count = engrams.Count,
                        message = $"Recalled {engrams.Count} relevant memories"
                    };
                }
            });
        }

        private void RegisterScratchpadTools()
        {
            // Read scratchpad
            _tools.Add("read_scratchpad", new AuraToolDefinition
            {
                Name = "read_scratchpad",
                Description = "Read the contents of the user's shared scratchpad (external memory)",
                Category = "memory",
                Parameters = new List<ToolParameter>(),
                ExecuteAsync = async (args) =>
                {
                    var content = await _aura.SystemExecutor.ReadScratchpadAsync();
                    return new { success = true, content = content, message = "Read scratchpad content" };
                }
            });

            // Append to scratchpad
            _tools.Add("append_scratchpad", new AuraToolDefinition
            {
                Name = "append_scratchpad",
                Description = "Append text to the shared scratchpad for later review",
                Category = "memory",
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "content", Type = "string", Description = "Text to append" }
                },
                ExecuteAsync = async (args) =>
                {
                    await _aura.SystemExecutor.AppendToScratchpadAsync(args["content"].ToString());
                    return new { success = true, message = "Appended content to scratchpad" };
                }
            });
        }

        private void RegisterSystemTools()
        {
            // Get system status
            _tools.Add("get_system_status", new AuraToolDefinition
            {
                Name = "get_system_status",
                Description = "Get current status of all Aura systems",
                Category = "system",
                Parameters = new List<ToolParameter>(),
                ExecuteAsync = async (args) =>
                {
                    await Task.CompletedTask;  // Synchronous operation

                    return new {
                        success = true,
                        is_running = _aura.IsRunning,
                        uptime = DateTime.Now - _aura.StartTime,
                        current_user = _aura.CurrentUser,
                        catalyst_present = _aura.CatalystPresent,
                        mode = _aura.Catalyst.GetCurrentMode(),
                        engram_count = _aura.Memory.GetEngrams().Count,
                        configured_services = _aura.Auth.GetConfiguredServices().Count,
                        message = "All systems operational"
                    };
                }
            });

            // BuildABot (app builder through conversation)
            _tools.Add("build_app", new AuraToolDefinition
            {
                Name = "build_app",
                Description = "Build a complete application through natural conversation (BuildABot)",
                Category = "system",
                RequiresAdvancedMode = true,  // Power user feature
                Parameters = new List<ToolParameter>
                {
                    new() { Name = "app_description", Type = "string", Description = "Description of the app to build" },
                    new() { Name = "features", Type = "array", Description = "List of required features", Required = false },
                    new() { Name = "platform", Type = "string", Description = "Target platform: web, desktop, mobile", Required = false, DefaultValue = "desktop" }
                },
                ExecuteAsync = async (args) =>
                {
                    // TODO: Implement BuildABot system
                    // This will be a full app generation pipeline
                    await Task.CompletedTask;

                    return new {
                        success = true,
                        message = "BuildABot: App generation started. This is a complex multi-step process.",
                        status = "generating_architecture"
                    };
                }
            });
        }

        #endregion
    }
}
