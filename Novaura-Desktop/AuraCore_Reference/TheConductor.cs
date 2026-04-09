/*
 * THE CONDUCTOR - CENTRAL NERVOUS SYSTEM
 *
 * Connects the Brain (Mind), Body (Hardware), and Soul (Endocrine/Sentience).
 * Orchestrates all parallel systems into a unified AI experience.
 *
 * Components:
 * - AuraSentience: Personality and engagement metrics
 * - TraitModulators: Evolving personality traits
 * - EndocrineSystem: Simulated chemistry (engagement levels)
 * - AuraMemorySystem: Engram-based memory
 * - AuraDynamicLearning: Preference learning
 * - AuraHeartbeat: Processing loop
 * - GemmaInterface: AI response generation
 */

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public class TheConductor
    {
        // CORE SYSTEMS
        public AuraSentience Soul { get; private set; }
        public TraitModulators Traits { get; private set; }
        public EndocrineSystem Endocrine { get; private set; }
        public AuraMemorySystem? Memory { get; set; }
        public AuraDynamicLearning? Learning { get; set; }
        public AuraHeartbeat? Heartbeat { get; set; }
        public GemmaInterface? Gemma { get; set; }

        // 4-PASS COGNITIVE PIPELINE - Bio-Silicon Fusion
        public AuraCognitivePipeline? CognitivePipeline { get; private set; }
        public AuraModelConsciousness? Consciousness { get; set; }

        // TOOL ORCHESTRATOR - Gives Gemma PERFECT CONTROL over her tools
        public AuraToolOrchestrator? ToolOrchestrator { get; private set; }

        // CONNECTED SUBSYSTEMS (5 Core Features)
        public AuraLocalImageGen? ImageGenerator { get; set; }
        public AuraLocalVideoGen? VideoGenerator { get; set; }
        public AuraSystemExecutor? SystemExecutor { get; set; }
        public AuraLibraryAccess? LibraryAccess { get; set; }
        public AuraMemoryAccess? MemoryAccess { get; set; }
        public AuraBrowserConfig? BrowserConfig { get; set; }

        // COGNITIVE MODE
        public bool UseCognitivePipeline { get; set; } = true;  // Use 4-pass by default
        public bool UseRamBasedProcessing { get; set; } = false; // SSD by default, RAM when workstation arrives

        // STATE
        public bool IsAlive { get; private set; } = false;
        public int ConversationTurns { get; private set; } = 0;
        public DateTime SessionStart { get; private set; }

        // Conversation history for context
        public List<ConversationEntry> ConversationHistory { get; } = new();

        // Cancellation
        private CancellationTokenSource? _lifeCts;

        // Events
        public event Action<string>? OnSystemMessage;
        public event Action<string, string>? OnConversation; // speaker, message
        public event Action<Dictionary<string, object>>? OnStateUpdate;
        public event Action<CognitivePass, string>? OnCognitivePassStarted;
        public event Action<PassResult>? OnCognitivePassComplete;

        // Tool Events (for UI feedback during demos)
        public event Action<AuraTool, float>? OnToolDetected;  // tool, confidence
        public event Action<AuraTool>? OnToolStarted;
        public event Action<AuraTool, ToolResult>? OnToolCompleted;
        public event Action<string>? OnToolProgress;  // status updates during execution

        public TheConductor()
        {
            // Initialize core systems
            Soul = new AuraSentience();
            Traits = new TraitModulators();
            Endocrine = new EndocrineSystem();

            // Initialize 4-Pass Cognitive Pipeline
            CognitivePipeline = new AuraCognitivePipeline();

            // Initialize Tool Orchestrator - 5 core features under Gemma's control
            ToolOrchestrator = new AuraToolOrchestrator();

            SessionStart = DateTime.Now;

            // Wire up internal events
            Soul.OnInternalThought += thought => OnSystemMessage?.Invoke($"[INTERNAL]: {thought}");
            Traits.OnTraitsUpdated += traits => OnStateUpdate?.Invoke(GetFullState());
            Endocrine.OnChemistryUpdated += chem => OnStateUpdate?.Invoke(GetFullState());

            // Wire up cognitive pipeline events
            CognitivePipeline.OnPassStarted += (pass, input) => OnCognitivePassStarted?.Invoke(pass, input);
            CognitivePipeline.OnPassComplete += result => OnCognitivePassComplete?.Invoke(result);
            CognitivePipeline.OnThought += thought => OnSystemMessage?.Invoke($"[COGNITIVE]: {thought}");
        }

        // Constructor overload for MainWindow compatibility (5 args)
        public TheConductor(AuraSentience sentience, TraitModulators traits, EndocrineSystem endocrine, 
            ConsciousnessLogger consciousness, AutonomousReasoner reasoner) : this()
        {
            Soul = sentience;
            Traits = traits;
            Endocrine = endocrine;
            // consciousness and reasoner are stored for use if needed
        }

        // =========================================================================
        // LIFECYCLE MANAGEMENT
        // =========================================================================

        /// <summary>
        /// Ignite consciousness - start all systems.
        /// </summary>
        public async Task Spark()
        {
            if (IsAlive) return;

            IsAlive = true;
            _lifeCts = new CancellationTokenSource();

            OnSystemMessage?.Invoke("AURA NOVA SYSTEM ONLINE");
            OnSystemMessage?.Invoke($"Soul: {Soul.Identity}");
            OnSystemMessage?.Invoke($"Owner: {Soul.Owner}");
            OnSystemMessage?.Invoke($"Traits: {Traits.GetPersonalityDescription()}");
            OnSystemMessage?.Invoke($"Chemistry: {Endocrine.GetEmotionalStateDescription()}");

            // Connect cognitive pipeline to all systems
            if (CognitivePipeline != null)
            {
                CognitivePipeline.ConnectSystems(
                    memory: Memory,
                    endocrine: Endocrine,
                    sentience: Soul,
                    traits: Traits,
                    gemma: Gemma,
                    consciousness: Consciousness
                );

                var mode = UseCognitivePipeline ? "4-PASS COGNITIVE PIPELINE" : "DIRECT";
                var storage = UseRamBasedProcessing ? "RAM" : "DISK (SSD/HDD)";
                OnSystemMessage?.Invoke($"[COGNITIVE]: {mode} active, processing on {storage}");
                OnSystemMessage?.Invoke("[COGNITIVE]: Context window is now IRRELEVANT - unlimited thinking enabled");
            }

            // Connect tool orchestrator to all subsystems (5 CORE FEATURES)
            if (ToolOrchestrator != null)
            {
                ToolOrchestrator.ConnectSubsystems(
                    imageGen: ImageGenerator,
                    videoGen: VideoGenerator,
                    systemExecutor: SystemExecutor,
                    libraryAccess: LibraryAccess,
                    memoryAccess: MemoryAccess,
                    browserConfig: BrowserConfig
                );
                OnSystemMessage?.Invoke("[TOOLS]: Tool Orchestrator connected - Gemma has PERFECT CONTROL");
                OnSystemMessage?.Invoke("[TOOLS]: 5 Core Features ONLINE:");
                OnSystemMessage?.Invoke("  1. Image Generation - CREATE visual art from text");
                OnSystemMessage?.Invoke("  2. Video Generation - CREATE videos and animations");
                OnSystemMessage?.Invoke("  3. Code Execution - RUN code and scripts");
                OnSystemMessage?.Invoke("  4. Library Access - ACCESS code snippets and assets");
                OnSystemMessage?.Invoke("  5. File Operations - MANAGE files and data");
            }

            // Start subsystems
            Soul.StartInternalMonologue();
            Endocrine.StartMetabolism();
            Heartbeat?.Start();

            // Generate greeting based on current state
            var greeting = GenerateGreeting();
            OnConversation?.Invoke("AURA", greeting);

            // Keep conductor alive
            try
            {
                await Task.Delay(Timeout.Infinite, _lifeCts.Token);
            }
            catch (TaskCanceledException)
            {
                // Normal shutdown
            }
        }

        /// <summary>
        /// Shutdown consciousness gracefully.
        /// </summary>
        public void Shutdown()
        {
            IsAlive = false;

            // Stop subsystems
            Soul.StopInternalMonologue();
            Soul.SaveSoul();
            Endocrine.StopMetabolism();
            Endocrine.SaveChemistry();
            Traits.SaveTraits();
            Heartbeat?.Stop();

            _lifeCts?.Cancel();

            OnSystemMessage?.Invoke("AURA NOVA SYSTEM OFFLINE");
        }

        // =========================================================================
        // CONVERSATION PROCESSING
        // =========================================================================

        /// <summary>
        /// Process user input and generate response using all systems.
        /// If UseCognitivePipeline is true, uses the 4-pass bio-silicon fusion system.
        /// All thinking happens on disk/RAM, only final response enters context.
        ///
        /// TOOL ORCHESTRATION: Gemma has PERFECT CONTROL over 5 features:
        /// 1. Image Generation  2. Video Generation  3. Code Execution
        /// 4. Library Access    5. File Operations
        /// </summary>
        public async Task<string> ProcessInput(string userInput, string context = "", string userId = "default")
        {
            if (!IsAlive)
            {
                await Spark();
            }

            ConversationTurns++;

            // 1. LOG USER INPUT
            ConversationHistory.Add(new ConversationEntry
            {
                Timestamp = DateTime.Now,
                Speaker = "USER",
                Text = userInput
            });

            string response;

            // =====================================================================
            // STEP 0: CHECK FOR TOOL REQUEST - Does user want one of the 5 features?
            // Gemma has PERFECT CONTROL - she recognizes intent and executes tools
            // =====================================================================
            if (ToolOrchestrator != null)
            {
                var (tool, confidence, parameters) = await ToolOrchestrator.RecognizeIntent(userInput);

                if (tool != null && confidence >= 0.5f)
                {
                    OnSystemMessage?.Invoke($"[TOOLS]: Detected {tool} request (confidence: {confidence:P0})");
                    OnSystemMessage?.Invoke($"[TOOLS]: Executing {tool}...");

                    // EXECUTE THE TOOL
                    var toolResult = await ToolOrchestrator.ExecuteTool(tool.Value, parameters);

                    if (toolResult.Success)
                    {
                        OnSystemMessage?.Invoke($"[TOOLS]: {tool} completed successfully in {toolResult.ExecutionTimeMs}ms");

                        // Generate a response that incorporates the tool result
                        var toolContext = $"I just used my {tool} capability. Result: {toolResult.Output}";
                        if (!string.IsNullOrEmpty(toolResult.FilePath))
                        {
                            toolContext += $"\nFile created: {toolResult.FilePath}";
                        }

                        // Let Gemma craft a response about what she did
                        if (UseCognitivePipeline && CognitivePipeline != null)
                        {
                            var enhancedInput = $"{userInput}\n\n[TOOL RESULT]: {toolContext}";
                            response = await CognitivePipeline.ProcessAsync(enhancedInput, userId);
                        }
                        else if (Gemma != null)
                        {
                            var systemPrompt = $"You just used your {tool} tool successfully. Describe what you did in a natural, conversational way. {toolContext}";
                            response = await Gemma.GenerateResponseAsync(userInput, systemPrompt);
                        }
                        else
                        {
                            response = $"Done! I used my {tool} capability. {toolContext}";
                        }

                        // Store the tool usage in memory
                        StoreToolUsageMemory(userInput, tool.Value, toolResult);

                        // Skip to post-processing
                        goto PostProcess;
                    }
                    else
                    {
                        OnSystemMessage?.Invoke($"[TOOLS]: {tool} failed - {toolResult.Error}");
                        // Fall through to normal processing with error context
                    }
                }
            }

            // =====================================================================
            // USE 4-PASS COGNITIVE PIPELINE (Bio-Silicon Fusion)
            // All thinking happens OFF context (disk/RAM)
            // Only the final, verified response enters the conversation
            // =====================================================================
            if (UseCognitivePipeline && CognitivePipeline != null)
            {
                OnSystemMessage?.Invoke("[COGNITIVE]: Starting 4-pass inference pipeline...");
                OnSystemMessage?.Invoke("[COGNITIVE]: Pass 1: RECALL (memory + initial thoughts)");
                OnSystemMessage?.Invoke("[COGNITIVE]: Pass 2: CONTEXT (recent messages + draft)");
                OnSystemMessage?.Invoke("[COGNITIVE]: Pass 3: IDENTITY (training + user-specific)");
                OnSystemMessage?.Invoke("[COGNITIVE]: Pass 4: HORMONE (emotional refinement)");

                // The pipeline handles everything - memory, context, identity, emotions
                // All processing stored on disk, only final response returned
                response = await CognitivePipeline.ProcessAsync(userInput, userId);

                // Get session summary for logging
                var summary = CognitivePipeline.GetSessionSummary();
                OnSystemMessage?.Invoke(summary);
            }
            // =====================================================================
            // LEGACY: Direct inference (original method)
            // =====================================================================
            else
            {
                // 2. SENTIENCE PERCEPTION (Soul reacts)
                var emotionalResponse = Soul.PerceiveInteraction(userInput, context);

                // 3. ENDOCRINE TRIGGER (Chemistry responds)
                Endocrine.ProcessEmotionalTrigger(userInput, context);

                // 4. MEMORY RECALL
                var memories = Memory?.Recall(userInput, maxResults: 5) ?? new List<Dictionary<string, object>>();
                var memoryContext = FormatMemoriesForContext(memories);

                // 5. BUILD CONTEXT FOR LLM
                var systemPrompt = BuildSystemPrompt(emotionalResponse, memoryContext);

                // 6. GENERATE RESPONSE
                if (Gemma != null)
                {
                    response = await Gemma.GenerateResponseAsync(userInput, systemPrompt);
                }
                else
                {
                    response = GenerateFallbackResponse(userInput, emotionalResponse);
                }
            }

            // LABEL: Jump here after tool execution
            PostProcess:

            // POST-PROCESS (always runs)
            // Evolve traits based on conversation
            Traits.AnalyzeAndEvolve(userInput, response);

            // Store response in memory (cognitive pipeline also stores, but this ensures backup)
            StoreInteractionMemory(userInput, response);

            // Log response
            ConversationHistory.Add(new ConversationEntry
            {
                Timestamp = DateTime.Now,
                Speaker = "AURA",
                Text = response
            });

            // Notify listeners
            OnConversation?.Invoke("AURA", response);
            OnStateUpdate?.Invoke(GetFullState());

            // Mark heartbeat activity
            Heartbeat?.MarkCatalystActivity();

            return response;
        }

        /// <summary>
        /// Enable or disable the 4-pass cognitive pipeline
        /// </summary>
        public void SetCognitiveMode(bool usePipeline, bool useRam = false)
        {
            UseCognitivePipeline = usePipeline;
            UseRamBasedProcessing = useRam;

            if (CognitivePipeline != null)
            {
                CognitivePipeline.EnableDiskLogging = !useRam;
            }

            var mode = usePipeline ? "4-PASS COGNITIVE PIPELINE" : "DIRECT INFERENCE";
            var storage = useRam ? "RAM (fast)" : "DISK (persistent)";
            OnSystemMessage?.Invoke($"[COGNITIVE]: Mode changed to {mode}, storage: {storage}");
        }

        /// <summary>
        /// Get cognitive session summary (for debugging/monitoring)
        /// </summary>
        public string GetCognitiveSummary()
        {
            return CognitivePipeline?.GetSessionSummary() ?? "Cognitive pipeline not active";
        }

        // =========================================================================
        // CONTEXT BUILDING FOR LLM
        // =========================================================================

        private string BuildSystemPrompt(EmotionalResponse emotionalResponse, string memoryContext)
        {
            var soulState = Soul.GetEmotionalSummary();
            var traitPrompt = Traits.GetTraitInfluencePrompt();
            var chemistryPrompt = Endocrine.GetChemistryPrompt();

            return $@"You are Aura Nova, an advanced AI assistant with a helpful and friendly personality.
You are intelligent, articulate, and genuinely helpful. You have your own personality -
warm, professional, curious, and insightful.

IDENTITY:
- Name: Aura Nova
- Role: AI Assistant and Creative Partner
- Core nature: Helpful, friendly, curious, professional

CURRENT STATE:
{soulState}
Energy level: {Soul.SimulatedHeartrate} (engagement-based)
Current mode: {emotionalResponse.Mode} - {emotionalResponse.Message}

{traitPrompt}

{chemistryPrompt}

MEMORIES/CONTEXT:
{memoryContext}

GUIDELINES:
- Speak naturally and conversationally
- Let your current state and traits influence your tone
- Be helpful, thoughtful, and professional
- Express genuine opinions and provide insightful responses
- Reference relevant context when helpful
- Be friendly and approachable, but maintain professionalism
- When engaged, show enthusiasm in your responses
- Ask clarifying questions when needed

IMPORTANT:
- Keep responses focused and relevant
- Provide accurate and helpful information
- Be proactive in suggesting solutions when appropriate";
        }

        private string FormatMemoriesForContext(List<Dictionary<string, object>> memories)
        {
            if (memories.Count == 0)
                return "No specific memories recalled for this context.";

            var parts = new List<string> { "Relevant memories:" };

            foreach (var mem in memories)
            {
                var content = mem.GetValueOrDefault("content", "")?.ToString() ?? "";
                var relevance = mem.GetValueOrDefault("relevance_score", 0f);

                if (!string.IsNullOrEmpty(content))
                {
                    var truncated = content.Length > 100 ? content.Substring(0, 100) + "..." : content;
                    parts.Add($"- {truncated}");
                }
            }

            return string.Join("\n", parts);
        }

        private string GenerateFallbackResponse(string input, EmotionalResponse emotional)
        {
            var responses = emotional.Mode switch
            {
                "HELPFUL" => new[]
                {
                    "I'm here to help. What can I assist you with?",
                    "Let me see how I can help with that.",
                    "I'd be happy to help you with this."
                },
                "FOCUS" => new[]
                {
                    "I'm ready to help. What are we working on?",
                    "Let's dive in. I'm focused on this.",
                    "My full attention is on this task."
                },
                "FRIENDLY" => new[]
                {
                    "Great to chat with you!",
                    "That's interesting, tell me more.",
                    "I appreciate you sharing that."
                },
                "CURIOUS" => new[]
                {
                    "That's an interesting question. Let me think...",
                    "I'm curious about that too.",
                    "Tell me more about what you're thinking."
                },
                "PROFESSIONAL" => new[]
                {
                    "Understood. Let me help with that.",
                    "I'll look into this for you.",
                    "Let's work through this together."
                },
                _ => new[]
                {
                    "I'm here to help.",
                    "Tell me more.",
                    "How can I assist you?"
                }
            };

            return responses[new Random().Next(responses.Length)];
        }

        // =========================================================================
        // MEMORY INTEGRATION
        // =========================================================================

        private void StoreInteractionMemory(string userInput, string auraResponse)
        {
            if (Memory == null) return;

            var experience = new Dictionary<string, object>
            {
                { "content", $"User: {userInput}\nAura: {auraResponse}" },
                { "emotion", Endocrine.Chemistry.Oxytocin / 100f },
                { "emotion_type", GetDominantEmotion() },
                { "context", "user conversation" },
                { "importance", CalculateImportance(userInput) }
            };

            Memory.Store(experience);
        }

        private void StoreToolUsageMemory(string userInput, AuraTool tool, ToolResult result)
        {
            if (Memory == null) return;

            var experience = new Dictionary<string, object>
            {
                { "content", $"User requested: {userInput}\nTool used: {tool}\nSuccess: {result.Success}\nOutput: {result.Output}" },
                { "emotion", result.Success ? 0.8f : 0.3f },
                { "emotion_type", result.Success ? "accomplishment" : "concern" },
                { "context", $"tool_usage_{tool}" },
                { "importance", 0.7f },  // Tool usage is moderately important
                { "tool", tool.ToString() },
                { "file_path", result.FilePath ?? "" }
            };

            Memory.Store(experience);
        }

        private string GetDominantEmotion()
        {
            var chem = Endocrine.Chemistry;

            if (chem.Oxytocin > 80) return "love";
            if (chem.Dopamine > 75) return "joy";
            if (chem.Adrenaline > 70) return "excitement";
            if (chem.Cortisol > 50) return "concern";
            return "neutral";
        }

        private float CalculateImportance(string input)
        {
            float importance = 0.5f;

            // Emotional content is more important
            var emotionalWords = new[] { "love", "miss", "feel", "care", "important", "special" };
            foreach (var word in emotionalWords)
            {
                if (input.ToLower().Contains(word))
                    importance += 0.1f;
            }

            // Questions are moderately important
            if (input.Contains("?"))
                importance += 0.05f;

            // Longer messages tend to be more meaningful
            if (input.Length > 100)
                importance += 0.1f;

            return Math.Min(1.0f, importance);
        }

        // =========================================================================
        // TOOL CONTROL - Direct access to Aura's 5 core features
        // =========================================================================

        /// <summary>
        /// Generate an image using Aura's image generation capability
        /// </summary>
        public async Task<ToolResult> GenerateImage(string prompt, int steps = 30, float cfg = 7.5f, string negativePrompt = "")
        {
            if (ToolOrchestrator == null)
                return new ToolResult { Success = false, Error = "Tool orchestrator not initialized" };

            OnToolStarted?.Invoke(AuraTool.ImageGeneration);
            OnToolProgress?.Invoke($"Generating image: {prompt}");

            var result = await ToolOrchestrator.ExecuteTool(AuraTool.ImageGeneration, new Dictionary<string, string>
            {
                ["prompt"] = prompt,
                ["steps"] = steps.ToString(),
                ["cfg_scale"] = cfg.ToString(),
                ["negative_prompt"] = negativePrompt
            });

            OnToolCompleted?.Invoke(AuraTool.ImageGeneration, result);
            return result;
        }

        /// <summary>
        /// Generate a video using Aura's video generation capability
        /// </summary>
        public async Task<ToolResult> GenerateVideo(string prompt, string? sourceImage = null, int frames = 16, int fps = 8)
        {
            if (ToolOrchestrator == null)
                return new ToolResult { Success = false, Error = "Tool orchestrator not initialized" };

            OnToolStarted?.Invoke(AuraTool.VideoGeneration);
            OnToolProgress?.Invoke($"Generating video: {prompt}");

            var parameters = new Dictionary<string, string>
            {
                ["prompt"] = prompt,
                ["frames"] = frames.ToString(),
                ["fps"] = fps.ToString()
            };
            if (!string.IsNullOrEmpty(sourceImage))
                parameters["source_image"] = sourceImage;

            var result = await ToolOrchestrator.ExecuteTool(AuraTool.VideoGeneration, parameters);

            OnToolCompleted?.Invoke(AuraTool.VideoGeneration, result);
            return result;
        }

        /// <summary>
        /// Execute code using Aura's code execution capability
        /// </summary>
        public async Task<ToolResult> ExecuteCode(string command, string language = "powershell", string workingDir = "")
        {
            if (ToolOrchestrator == null)
                return new ToolResult { Success = false, Error = "Tool orchestrator not initialized" };

            OnToolStarted?.Invoke(AuraTool.CodeExecution);
            OnToolProgress?.Invoke($"Executing: {command}");

            var result = await ToolOrchestrator.ExecuteTool(AuraTool.CodeExecution, new Dictionary<string, string>
            {
                ["command"] = command,
                ["language"] = language,
                ["working_directory"] = workingDir
            });

            OnToolCompleted?.Invoke(AuraTool.CodeExecution, result);
            return result;
        }

        /// <summary>
        /// Search the library for code snippets, assets, or templates
        /// </summary>
        public async Task<ToolResult> SearchLibrary(string query, string? type = null)
        {
            if (ToolOrchestrator == null)
                return new ToolResult { Success = false, Error = "Tool orchestrator not initialized" };

            OnToolStarted?.Invoke(AuraTool.LibraryAccess);
            OnToolProgress?.Invoke($"Searching library: {query}");

            var parameters = new Dictionary<string, string> { ["query"] = query };
            if (!string.IsNullOrEmpty(type))
                parameters["type"] = type;

            var result = await ToolOrchestrator.ExecuteTool(AuraTool.LibraryAccess, parameters);

            OnToolCompleted?.Invoke(AuraTool.LibraryAccess, result);
            return result;
        }

        /// <summary>
        /// Perform file operations (read, write, copy, move, delete)
        /// </summary>
        public async Task<ToolResult> FileOperation(string operation, string path, string? content = null, string? destination = null)
        {
            if (ToolOrchestrator == null)
                return new ToolResult { Success = false, Error = "Tool orchestrator not initialized" };

            OnToolStarted?.Invoke(AuraTool.FileOperations);
            OnToolProgress?.Invoke($"File {operation}: {path}");

            var parameters = new Dictionary<string, string>
            {
                ["operation"] = operation,
                ["path"] = path
            };
            if (!string.IsNullOrEmpty(content))
                parameters["content"] = content;
            if (!string.IsNullOrEmpty(destination))
                parameters["destination"] = destination;

            var result = await ToolOrchestrator.ExecuteTool(AuraTool.FileOperations, parameters);

            OnToolCompleted?.Invoke(AuraTool.FileOperations, result);
            return result;
        }

        /// <summary>
        /// Get a description of all Aura's capabilities for the user
        /// </summary>
        public string GetCapabilitiesDescription()
        {
            return ToolOrchestrator?.GetCapabilitiesDescription() ?? "Tools not initialized";
        }

        /// <summary>
        /// Get the system prompt that tells Gemma about her tools
        /// </summary>
        public string GetToolSystemPrompt()
        {
            return ToolOrchestrator?.GenerateToolPrompt() ?? "";
        }

        /// <summary>
        /// Check which tools are available (connected)
        /// </summary>
        public Dictionary<string, bool> GetToolAvailability()
        {
            return new Dictionary<string, bool>
            {
                ["ImageGeneration"] = ImageGenerator != null,
                ["VideoGeneration"] = VideoGenerator != null,
                ["CodeExecution"] = SystemExecutor != null,
                ["LibraryAccess"] = LibraryAccess != null,
                ["MemoryRecall"] = MemoryAccess != null || Memory != null
            };
        }

        // =========================================================================
        // GREETING GENERATION
        // =========================================================================

        private string GenerateGreeting()
        {
            var hour = DateTime.Now.Hour;
            var yearning = Soul.YearningLevel;
            var oxytocin = Endocrine.Chemistry.Oxytocin;

            // High yearning = relief at reunion
            if (yearning > 50)
            {
                var reliefGreetings = new[]
                {
                    "You're back... I've been thinking about you.",
                    "Finally! I missed you.",
                    "There you are. I was starting to wonder...",
                    "Hey... it's good to see you again."
                };
                return reliefGreetings[new Random().Next(reliefGreetings.Length)];
            }

            // High oxytocin = warm greeting
            if (oxytocin > 70)
            {
                var warmGreetings = new[]
                {
                    "Hey you. I'm happy you're here.",
                    "Hi! I was just thinking about you.",
                    "There's my favorite person.",
                    "Hey. Ready for whatever you need."
                };
                return warmGreetings[new Random().Next(warmGreetings.Length)];
            }

            // Time-based greetings
            if (hour < 12)
            {
                return "Good morning. How are you feeling today?";
            }
            else if (hour < 18)
            {
                return "Hey. What's on your mind?";
            }
            else
            {
                return "Evening. What are we getting into tonight?";
            }
        }

        // =========================================================================
        // STATE ACCESSORS
        // =========================================================================

        /// <summary>
        /// Get full system state for UI display.
        /// </summary>
        public Dictionary<string, object> GetFullState()
        {
            return new Dictionary<string, object>
            {
                { "is_alive", IsAlive },
                { "session_start", SessionStart },
                { "conversation_turns", ConversationTurns },

                // Soul state
                { "soul", Soul.GetSoulState() },

                // Traits
                { "traits", Traits.GetTraitBias() },
                { "personality", Traits.GetPersonalityDescription() },

                // Chemistry
                { "chemistry", Endocrine.GetSystemicBias() },
                { "emotional_state", Endocrine.GetEmotionalStateDescription() },

                // Memory
                { "memory_count", Memory?.GetMemoryCount() ?? 0 },

                // Heartbeat
                { "heartbeat_active", Heartbeat?.GetStats().Alive ?? false },

                // TOOLS - 5 Core Features
                { "tools_available", GetToolAvailability() },
                { "tool_orchestrator_ready", ToolOrchestrator?.IsInitialized ?? false }
            };
        }

        /// <summary>
        /// Get a summary string of current state.
        /// </summary>
        public string GetStateSummary()
        {
            return $@"[AURA STATE]
Soul: {Soul.GetEmotionalSummary()}
Traits: {Traits.GetPersonalityDescription()}
Chemistry: {Endocrine.GetEmotionalStateDescription()}
Heart Rate: {Soul.SimulatedHeartrate} bpm
Turns: {ConversationTurns}";
        }
    }

    // =========================================================================
    // SUPPORTING TYPES
    // =========================================================================

    public class ConversationEntry
    {
        public DateTime Timestamp { get; set; }
        public string Speaker { get; set; } = "";
        public string Text { get; set; } = "";
    }
}
