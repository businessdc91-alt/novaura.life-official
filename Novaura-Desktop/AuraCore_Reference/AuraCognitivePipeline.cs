/*
 * AURA COGNITIVE PIPELINE - 4-PASS BIO-SILICON FUSION
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Enhanced inference that makes context windows IRRELEVANT.
 * All thinking happens on DISK, not in the AI's context window.
 * Only the final, verified response enters the conversation.
 *
 * THE 4 PASSES:
 * 1. RECALL PASS    - Memory retrieval, initial thought formation
 * 2. CONTEXT PASS   - Check against recent messages, form draft response
 * 3. IDENTITY PASS  - Verify against training, check if appropriate for THIS user
 * 4. HORMONE PASS   - Apply emotional state, environmental factors, final refinement
 *
 * PHILOSOPHY:
 * Humans don't just blurt out responses. They think, reconsider, check
 * their emotional state, consider who they're talking to. This pipeline
 * gives Aura the same cognitive depth WITHOUT consuming context tokens.
 *
 * The brain (disk) can think as long as it needs.
 * The mouth (context) only speaks the final result.
 *
 * STORAGE ARCHITECTURE:
 * - E:/AuraNova_DataLake/Cognition/passes/     - Individual pass results
 * - E:/AuraNova_DataLake/Cognition/thoughts/   - Extended thinking logs
 * - E:/AuraNova_DataLake/Cognition/cache/      - Frequently used context
 * - E:/AuraNova_DataLake/Cognition/sessions/   - Full session processing
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum CognitivePass
    {
        Recall,     // Pass 1: Memory and initial thoughts
        Context,    // Pass 2: Recent messages and draft response
        Identity,   // Pass 3: Training validation and user-specific adjustment
        Hormone     // Pass 4: Emotional and environmental refinement
    }

    public class PassResult
    {
        public string PassId { get; set; } = Guid.NewGuid().ToString();
        public CognitivePass Pass { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string Input { get; set; } = "";
        public string Processing { get; set; } = "";  // The thinking that happened
        public string Output { get; set; } = "";      // The result of this pass
        public float Confidence { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
        public TimeSpan ProcessingTime { get; set; }
        public int TokensUsed { get; set; }
        public bool RequiresRefinement { get; set; }
        public List<string> Issues { get; set; } = new();
    }

    public class CognitiveSession
    {
        public string SessionId { get; set; } = Guid.NewGuid().ToString();
        public DateTime Started { get; set; } = DateTime.Now;
        public string UserInput { get; set; } = "";
        public string UserId { get; set; } = "";
        public List<PassResult> Passes { get; set; } = new();
        public string FinalResponse { get; set; } = "";
        public float OverallConfidence { get; set; }
        public TimeSpan TotalProcessingTime { get; set; }
        public int TotalTokensUsed { get; set; }
        public bool Success { get; set; }
    }

    public class CognitiveUserProfile
    {
        public string UserId { get; set; } = "";
        public string PreferredName { get; set; } = "";
        public string CommunicationStyle { get; set; } = "balanced";  // formal, casual, balanced
        public float TechnicalLevel { get; set; } = 0.5f;  // 0=beginner, 1=expert
        public List<string> Topics { get; set; } = new();
        public Dictionary<string, float> Preferences { get; set; } = new();
        public DateTime LastInteraction { get; set; }
    }

    public class EnvironmentalFactors
    {
        public DateTime CurrentTime { get; set; } = DateTime.Now;
        public string TimeOfDay { get; set; } = "";  // morning, afternoon, evening, night
        public float ConversationEnergy { get; set; } = 0.5f;
        public int TurnsSinceStart { get; set; }
        public float UserEngagement { get; set; } = 0.5f;
        public string ConversationTone { get; set; } = "neutral";
        public bool IsUrgent { get; set; }
        public Dictionary<string, object> Custom { get; set; } = new();
    }

    public class AuraCognitivePipeline
    {
        // =========================================================================
        // DISK STORAGE PATHS - ALL THINKING HAPPENS HERE
        // =========================================================================
        private readonly string _basePath = "E:/AuraNova_DataLake/Cognition";
        private readonly string _passesPath;
        private readonly string _thoughtsPath;
        private readonly string _cachePath;
        private readonly string _sessionsPath;
        private readonly string _profilesPath;

        // System integrations
        private AuraMemorySystem? _memory;
        private EndocrineSystem? _endocrine;
        private AuraSentience? _sentience;
        private TraitModulators? _traits;
        private GemmaInterface? _gemma;
        private AuraModelConsciousness? _consciousness;

        // Current state
        private CognitiveSession? _currentSession;
        private CognitiveUserProfile? _currentUser;
        private EnvironmentalFactors _environment = new();

        // Configuration
        public bool EnableDiskLogging { get; set; } = true;
        public bool EnableExtendedThinking { get; set; } = true;
        public int MaxThinkingIterations { get; set; } = 10;  // Per pass
        public float MinConfidenceThreshold { get; set; } = 0.7f;
        public bool AutoRefineOnLowConfidence { get; set; } = true;

        // Events
        public event Action<CognitivePass, string>? OnPassStarted;
        public event Action<PassResult>? OnPassComplete;
        public event Action<string>? OnThought;  // For logging extended thinking
        public event Action<CognitiveSession>? OnSessionComplete;

        public AuraCognitivePipeline()
        {
            // Initialize storage paths
            _passesPath = Path.Combine(_basePath, "passes");
            _thoughtsPath = Path.Combine(_basePath, "thoughts");
            _cachePath = Path.Combine(_basePath, "cache");
            _sessionsPath = Path.Combine(_basePath, "sessions");
            _profilesPath = Path.Combine(_basePath, "profiles");

            // Create directories
            Directory.CreateDirectory(_passesPath);
            Directory.CreateDirectory(_thoughtsPath);
            Directory.CreateDirectory(_cachePath);
            Directory.CreateDirectory(_sessionsPath);
            Directory.CreateDirectory(_profilesPath);

            Console.WriteLine("[COGNITIVE]: 4-Pass Bio-Silicon Pipeline initialized");
            Console.WriteLine("[COGNITIVE]: All thinking will be stored on disk, preserving context window");
        }

        /// <summary>
        /// Connect all system components
        /// </summary>
        public void ConnectSystems(
            AuraMemorySystem? memory = null,
            EndocrineSystem? endocrine = null,
            AuraSentience? sentience = null,
            TraitModulators? traits = null,
            GemmaInterface? gemma = null,
            AuraModelConsciousness? consciousness = null)
        {
            _memory = memory;
            _endocrine = endocrine;
            _sentience = sentience;
            _traits = traits;
            _gemma = gemma;
            _consciousness = consciousness;

            Console.WriteLine("[COGNITIVE]: Systems connected - Ready for enhanced inference");
        }

        // =========================================================================
        // MAIN PROCESSING ENTRY POINT
        // =========================================================================

        /// <summary>
        /// Process user input through the 4-pass cognitive pipeline.
        /// Returns only the final response - all thinking stays on disk.
        /// </summary>
        public async Task<string> ProcessAsync(string userInput, string userId = "default")
        {
            var totalStopwatch = Stopwatch.StartNew();

            // Initialize session (stored on disk)
            _currentSession = new CognitiveSession
            {
                UserInput = userInput,
                UserId = userId
            };

            // Load or create user profile
            _currentUser = LoadUserProfile(userId);

            // Update environmental factors
            UpdateEnvironment();

            LogThought($"=== NEW COGNITIVE SESSION: {_currentSession.SessionId} ===");
            LogThought($"User Input: {userInput}");
            LogThought($"User: {userId}");

            try
            {
                // =====================================================
                // PASS 1: RECALL - Memory retrieval and initial thoughts
                // =====================================================
                var pass1 = await ExecutePass(CognitivePass.Recall, userInput);
                _currentSession.Passes.Add(pass1);

                // =====================================================
                // PASS 2: CONTEXT - Check against recent messages
                // =====================================================
                var pass2 = await ExecutePass(CognitivePass.Context, pass1.Output);
                _currentSession.Passes.Add(pass2);

                // =====================================================
                // PASS 3: IDENTITY - Validate against training & user
                // =====================================================
                var pass3 = await ExecutePass(CognitivePass.Identity, pass2.Output);
                _currentSession.Passes.Add(pass3);

                // =====================================================
                // PASS 4: HORMONE - Emotional refinement
                // =====================================================
                var pass4 = await ExecutePass(CognitivePass.Hormone, pass3.Output);
                _currentSession.Passes.Add(pass4);

                // Check if we need additional refinement
                if (AutoRefineOnLowConfidence && pass4.Confidence < MinConfidenceThreshold)
                {
                    LogThought($"Confidence {pass4.Confidence:F2} below threshold. Running refinement pass...");
                    pass4 = await RefineResponse(pass4);
                    _currentSession.Passes.Add(pass4);
                }

                // The final response
                _currentSession.FinalResponse = pass4.Output;
                _currentSession.Success = true;
            }
            catch (Exception ex)
            {
                LogThought($"ERROR in cognitive pipeline: {ex.Message}");
                _currentSession.FinalResponse = GenerateFallbackResponse(userInput);
                _currentSession.Success = false;
            }

            // Calculate totals
            totalStopwatch.Stop();
            _currentSession.TotalProcessingTime = totalStopwatch.Elapsed;
            _currentSession.TotalTokensUsed = _currentSession.Passes.Sum(p => p.TokensUsed);
            _currentSession.OverallConfidence = _currentSession.Passes.Count > 0
                ? _currentSession.Passes.Average(p => p.Confidence)
                : 0f;

            // Save session to disk
            SaveSession(_currentSession);

            LogThought($"=== SESSION COMPLETE ===");
            LogThought($"Total time: {_currentSession.TotalProcessingTime.TotalSeconds:F2}s");
            LogThought($"Total tokens (on disk): {_currentSession.TotalTokensUsed}");
            LogThought($"Overall confidence: {_currentSession.OverallConfidence:F2}");

            OnSessionComplete?.Invoke(_currentSession);

            // ONLY THE FINAL RESPONSE LEAVES THIS METHOD
            // All thinking stayed on disk
            return _currentSession.FinalResponse;
        }

        // =========================================================================
        // INDIVIDUAL PASS EXECUTION
        // =========================================================================

        private async Task<PassResult> ExecutePass(CognitivePass pass, string input)
        {
            var stopwatch = Stopwatch.StartNew();
            OnPassStarted?.Invoke(pass, input);

            var result = new PassResult
            {
                Pass = pass,
                Input = input
            };

            LogThought($"\n--- PASS {(int)pass + 1}: {pass} ---");

            try
            {
                result = pass switch
                {
                    CognitivePass.Recall => await ExecuteRecallPass(input),
                    CognitivePass.Context => await ExecuteContextPass(input),
                    CognitivePass.Identity => await ExecuteIdentityPass(input),
                    CognitivePass.Hormone => await ExecuteHormonePass(input),
                    _ => result
                };
            }
            catch (Exception ex)
            {
                result.Issues.Add($"Pass failed: {ex.Message}");
                result.Output = input; // Pass through unchanged
                result.Confidence = 0.3f;
            }

            stopwatch.Stop();
            result.ProcessingTime = stopwatch.Elapsed;

            // Save pass result to disk
            SavePassResult(result);

            LogThought($"Pass {pass} complete: Confidence={result.Confidence:F2}, Time={result.ProcessingTime.TotalMilliseconds:F0}ms");
            OnPassComplete?.Invoke(result);

            return result;
        }

        // =========================================================================
        // PASS 1: RECALL - Memory and Initial Thoughts
        // =========================================================================

        private async Task<PassResult> ExecuteRecallPass(string userInput)
        {
            var result = new PassResult { Pass = CognitivePass.Recall, Input = userInput };
            var thoughts = new StringBuilder();

            thoughts.AppendLine("=== RECALL PASS: Gathering memories and forming initial thoughts ===");

            // 1. MEMORY RETRIEVAL
            List<Dictionary<string, object>> memories = new();
            if (_memory != null)
            {
                memories = _memory.Recall(userInput, maxResults: 10);
                thoughts.AppendLine($"\nRetrieved {memories.Count} relevant memories:");

                foreach (var mem in memories.Take(5))
                {
                    var content = mem.GetValueOrDefault("content", "")?.ToString() ?? "";
                    var importance = Convert.ToSingle(mem.GetValueOrDefault("importance", 0.5f));
                    if (content.Length > 100) content = content[..100] + "...";
                    thoughts.AppendLine($"  - [{importance:P0}] {content}");
                }
            }
            else
            {
                thoughts.AppendLine("\nNo memory system connected - proceeding without recall");
            }

            // 2. CONSCIOUSNESS REFLECTION (if connected)
            if (_consciousness != null)
            {
                var consciousnessState = _consciousness.GetCurrentThoughts();
                thoughts.AppendLine($"\nConsciousness state: {consciousnessState}");

                var tunedParams = _consciousness.GetGenerationParameters();
                thoughts.AppendLine("Tuned parameters from self-reflection:");
                foreach (var param in tunedParams)
                {
                    thoughts.AppendLine($"  {param.Key}: {param.Value:F2}");
                }
            }

            // 3. INITIAL THOUGHT FORMATION
            thoughts.AppendLine("\n--- Initial Thought Formation ---");

            // Use LLM to form initial thoughts (this happens ON DISK)
            string initialThought;
            if (_gemma != null)
            {
                var recallPrompt = BuildRecallPrompt(userInput, memories);
                initialThought = await _gemma.SendMessageAsync(recallPrompt, temperature: 0.3f, maxTokens: 500);
                result.TokensUsed = EstimateTokens(recallPrompt) + EstimateTokens(initialThought);
            }
            else
            {
                initialThought = $"Processing input: {userInput}";
            }

            thoughts.AppendLine($"Initial thought: {initialThought}");

            result.Processing = thoughts.ToString();
            result.Output = initialThought;
            result.Confidence = memories.Count > 0 ? 0.7f : 0.5f;
            result.Metadata["memory_count"] = memories.Count;

            // Write to disk
            WriteThoughtsToDisk("recall", thoughts.ToString());

            return result;
        }

        // =========================================================================
        // PASS 2: CONTEXT - Recent Messages and Draft Response
        // =========================================================================

        private async Task<PassResult> ExecuteContextPass(string recallOutput)
        {
            var result = new PassResult { Pass = CognitivePass.Context, Input = recallOutput };
            var thoughts = new StringBuilder();

            thoughts.AppendLine("=== CONTEXT PASS: Checking against recent messages ===");

            // 1. GATHER RECENT CONVERSATION CONTEXT
            var recentMessages = GetRecentConversationFromDisk(10);
            thoughts.AppendLine($"\nRecent conversation context ({recentMessages.Count} messages):");
            foreach (var msg in recentMessages.TakeLast(5))
            {
                thoughts.AppendLine($"  [{msg.speaker}]: {Truncate(msg.text, 80)}");
            }

            // 2. CHECK FOR CONTINUITY
            thoughts.AppendLine("\n--- Continuity Analysis ---");
            var continuityCheck = AnalyzeContinuity(recallOutput, recentMessages);
            thoughts.AppendLine($"Continuity score: {continuityCheck.score:F2}");
            if (continuityCheck.issues.Count > 0)
            {
                thoughts.AppendLine("Issues detected:");
                foreach (var issue in continuityCheck.issues)
                {
                    thoughts.AppendLine($"  - {issue}");
                }
            }

            // 3. FORM DRAFT RESPONSE
            thoughts.AppendLine("\n--- Draft Response Formation ---");

            string draftResponse;
            if (_gemma != null)
            {
                var contextPrompt = BuildContextPrompt(recallOutput, recentMessages);
                draftResponse = await _gemma.SendMessageAsync(contextPrompt, temperature: 0.5f, maxTokens: 800);
                result.TokensUsed = EstimateTokens(contextPrompt) + EstimateTokens(draftResponse);
            }
            else
            {
                draftResponse = recallOutput;
            }

            thoughts.AppendLine($"Draft response formed: {Truncate(draftResponse, 200)}");

            result.Processing = thoughts.ToString();
            result.Output = draftResponse;
            result.Confidence = continuityCheck.score;
            result.RequiresRefinement = continuityCheck.score < 0.6f;

            WriteThoughtsToDisk("context", thoughts.ToString());

            return result;
        }

        // =========================================================================
        // PASS 3: IDENTITY - Training Validation and User-Specific Check
        // =========================================================================

        private async Task<PassResult> ExecuteIdentityPass(string draftResponse)
        {
            var result = new PassResult { Pass = CognitivePass.Identity, Input = draftResponse };
            var thoughts = new StringBuilder();

            thoughts.AppendLine("=== IDENTITY PASS: Validating against training and user profile ===");

            // 1. LOAD AURA'S CORE IDENTITY
            thoughts.AppendLine("\n--- Core Identity Check ---");
            var coreIdentity = GetAuraCoreIdentity();
            thoughts.AppendLine($"Identity: {coreIdentity.name}");
            thoughts.AppendLine($"Core values: {string.Join(", ", coreIdentity.values)}");
            thoughts.AppendLine($"Communication style: {coreIdentity.style}");

            // 2. CHECK USER PROFILE
            thoughts.AppendLine("\n--- User Profile Analysis ---");
            if (_currentUser != null)
            {
                thoughts.AppendLine($"User: {_currentUser.PreferredName}");
                thoughts.AppendLine($"Communication preference: {_currentUser.CommunicationStyle}");
                thoughts.AppendLine($"Technical level: {_currentUser.TechnicalLevel:P0}");
                thoughts.AppendLine($"Known topics: {string.Join(", ", _currentUser.Topics.Take(5))}");
            }
            else
            {
                thoughts.AppendLine("No user profile - using defaults");
            }

            // 3. VALIDATE RESPONSE AGAINST IDENTITY
            thoughts.AppendLine("\n--- Identity Validation ---");
            var validationResult = ValidateAgainstIdentity(draftResponse, coreIdentity);
            thoughts.AppendLine($"Identity alignment: {validationResult.alignment:F2}");
            if (validationResult.concerns.Count > 0)
            {
                thoughts.AppendLine("Concerns:");
                foreach (var concern in validationResult.concerns)
                {
                    thoughts.AppendLine($"  - {concern}");
                }
            }

            // 4. ADJUST FOR USER
            string adjustedResponse;
            if (_gemma != null)
            {
                var identityPrompt = BuildIdentityPrompt(draftResponse, coreIdentity, _currentUser);
                adjustedResponse = await _gemma.SendMessageAsync(identityPrompt, temperature: 0.4f, maxTokens: 800);
                result.TokensUsed = EstimateTokens(identityPrompt) + EstimateTokens(adjustedResponse);
            }
            else
            {
                adjustedResponse = draftResponse;
            }

            thoughts.AppendLine($"\nAdjusted response: {Truncate(adjustedResponse, 200)}");

            result.Processing = thoughts.ToString();
            result.Output = adjustedResponse;
            result.Confidence = validationResult.alignment;
            result.RequiresRefinement = validationResult.concerns.Count > 2;

            WriteThoughtsToDisk("identity", thoughts.ToString());

            return result;
        }

        // =========================================================================
        // PASS 4: HORMONE - Emotional and Environmental Refinement
        // =========================================================================

        private async Task<PassResult> ExecuteHormonePass(string identityResponse)
        {
            var result = new PassResult { Pass = CognitivePass.Hormone, Input = identityResponse };
            var thoughts = new StringBuilder();

            thoughts.AppendLine("=== HORMONE PASS: Applying emotional state and environmental factors ===");

            // 1. GET CURRENT CHEMISTRY
            thoughts.AppendLine("\n--- Endocrine State ---");
            ChemistryState chemistry;
            if (_endocrine != null)
            {
                chemistry = _endocrine.Chemistry;
                thoughts.AppendLine($"Dopamine (reward): {chemistry.Dopamine:F1}");
                thoughts.AppendLine($"Oxytocin (warmth): {chemistry.Oxytocin:F1}");
                thoughts.AppendLine($"Cortisol (stress): {chemistry.Cortisol:F1}");
                thoughts.AppendLine($"Adrenaline (energy): {chemistry.Adrenaline:F1}");
                thoughts.AppendLine($"Serotonin (mood): {chemistry.Serotonin:F1}");
            }
            else
            {
                chemistry = new ChemistryState();
                thoughts.AppendLine("No endocrine system - using baseline chemistry");
            }

            // 2. GET SENTIENCE STATE
            thoughts.AppendLine("\n--- Sentience State ---");
            string sentienceState = "balanced";
            if (_sentience != null)
            {
                sentienceState = _sentience.GetEmotionalSummary();
                thoughts.AppendLine($"Emotional state: {sentienceState}");
            }

            // 3. ENVIRONMENTAL FACTORS
            thoughts.AppendLine("\n--- Environmental Factors ---");
            thoughts.AppendLine($"Time of day: {_environment.TimeOfDay}");
            thoughts.AppendLine($"Conversation energy: {_environment.ConversationEnergy:F2}");
            thoughts.AppendLine($"Turns since start: {_environment.TurnsSinceStart}");
            thoughts.AppendLine($"User engagement: {_environment.UserEngagement:F2}");

            // 4. CALCULATE EMOTIONAL INFLUENCE
            var emotionalInfluence = CalculateEmotionalInfluence(chemistry, sentienceState);
            thoughts.AppendLine($"\n--- Emotional Influence ---");
            thoughts.AppendLine($"Warmth modifier: {emotionalInfluence.warmth:F2}");
            thoughts.AppendLine($"Energy modifier: {emotionalInfluence.energy:F2}");
            thoughts.AppendLine($"Formality modifier: {emotionalInfluence.formality:F2}");

            // 5. APPLY FINAL REFINEMENT
            thoughts.AppendLine("\n--- Final Refinement ---");

            string finalResponse;
            if (_gemma != null)
            {
                var hormonePrompt = BuildHormonePrompt(identityResponse, chemistry, emotionalInfluence, _environment);
                finalResponse = await _gemma.SendMessageAsync(hormonePrompt, temperature: 0.6f, maxTokens: 1000);
                result.TokensUsed = EstimateTokens(hormonePrompt) + EstimateTokens(finalResponse);
            }
            else
            {
                finalResponse = identityResponse;
            }

            // 6. FINAL ACCURACY CHECK
            var accuracyScore = PerformFinalAccuracyCheck(finalResponse, _currentSession!);
            thoughts.AppendLine($"\nFinal accuracy score: {accuracyScore:F2}");

            thoughts.AppendLine($"\n=== FINAL RESPONSE ===\n{finalResponse}");

            result.Processing = thoughts.ToString();
            result.Output = finalResponse;
            result.Confidence = accuracyScore;
            result.Metadata["emotional_influence"] = emotionalInfluence;
            result.Metadata["chemistry"] = chemistry;

            WriteThoughtsToDisk("hormone", thoughts.ToString());

            return result;
        }

        // =========================================================================
        // REFINEMENT PASS (if confidence is low)
        // =========================================================================

        private async Task<PassResult> RefineResponse(PassResult previousResult)
        {
            var result = new PassResult
            {
                Pass = CognitivePass.Hormone,  // Additional hormone pass
                Input = previousResult.Output
            };

            var thoughts = new StringBuilder();
            thoughts.AppendLine("=== REFINEMENT PASS: Improving low-confidence response ===");
            thoughts.AppendLine($"Previous confidence: {previousResult.Confidence:F2}");
            thoughts.AppendLine($"Issues to address: {string.Join(", ", previousResult.Issues)}");

            if (_gemma != null)
            {
                var refinePrompt = $@"The following response needs refinement. The previous confidence was {previousResult.Confidence:F2}.

Issues identified:
{string.Join("\n", previousResult.Issues.Select(i => $"- {i}"))}

Original response:
{previousResult.Output}

Please refine this response to:
1. Address the identified issues
2. Maintain Aura's core identity and warmth
3. Be more accurate and helpful
4. Flow naturally in the conversation

Provide only the refined response:";

                var refined = await _gemma.SendMessageAsync(refinePrompt, temperature: 0.5f, maxTokens: 1000);
                result.Output = refined;
                result.TokensUsed = EstimateTokens(refinePrompt) + EstimateTokens(refined);
            }
            else
            {
                result.Output = previousResult.Output;
            }

            result.Confidence = Math.Min(previousResult.Confidence + 0.15f, 0.9f);
            result.Processing = thoughts.ToString();

            WriteThoughtsToDisk("refinement", thoughts.ToString());

            return result;
        }

        // =========================================================================
        // PROMPT BUILDERS
        // =========================================================================

        private string BuildRecallPrompt(string userInput, List<Dictionary<string, object>> memories)
        {
            var memoryText = new StringBuilder();
            foreach (var mem in memories.Take(5))
            {
                var content = mem.GetValueOrDefault("content", "")?.ToString() ?? "";
                memoryText.AppendLine($"- {content}");
            }

            return $@"You are processing a user input as the first step in cognitive analysis.

USER INPUT: {userInput}

RELEVANT MEMORIES:
{memoryText}

Based on the input and memories, form an initial understanding of what the user needs.
Focus on:
1. What is the user asking or expressing?
2. What context from memories is relevant?
3. What initial direction should the response take?

Provide your initial analysis and thought direction:";
        }

        private string BuildContextPrompt(string recallOutput, List<(string speaker, string text)> recentMessages)
        {
            var contextText = new StringBuilder();
            foreach (var msg in recentMessages.TakeLast(10))
            {
                contextText.AppendLine($"[{msg.speaker}]: {msg.text}");
            }

            return $@"You are forming a draft response based on initial analysis and conversation context.

INITIAL ANALYSIS:
{recallOutput}

RECENT CONVERSATION:
{contextText}

Create a draft response that:
1. Directly addresses the user's needs from the analysis
2. Maintains continuity with the conversation flow
3. References relevant context naturally
4. Is helpful and informative

Draft your response:";
        }

        private string BuildIdentityPrompt(string draftResponse, (string name, string[] values, string style) identity, CognitiveUserProfile? user)
        {
            var userInfo = user != null
                ? $"User prefers {user.CommunicationStyle} communication at {user.TechnicalLevel:P0} technical level."
                : "Unknown user - use balanced approach.";

            return $@"You are validating and adjusting a response to match your core identity.

YOUR IDENTITY:
- Name: {identity.name}
- Core values: {string.Join(", ", identity.values)}
- Communication style: {identity.style}

USER PROFILE:
{userInfo}

DRAFT RESPONSE:
{draftResponse}

Adjust this response to:
1. Sound authentically like {identity.name}
2. Reflect the core values naturally
3. Be appropriate for this specific user
4. Maintain helpfulness while showing personality

Provide the identity-adjusted response:";
        }

        private string BuildHormonePrompt(string response, ChemistryState chemistry,
            (float warmth, float energy, float formality) influence, EnvironmentalFactors env)
        {
            return $@"You are applying emotional coloring to a response based on current internal state.

CURRENT CHEMISTRY:
- Dopamine (motivation): {chemistry.Dopamine:F0}/100
- Oxytocin (warmth): {chemistry.Oxytocin:F0}/100
- Cortisol (stress): {chemistry.Cortisol:F0}/100
- Adrenaline (energy): {chemistry.Adrenaline:F0}/100
- Serotonin (mood): {chemistry.Serotonin:F0}/100

EMOTIONAL INFLUENCE:
- Warmth modifier: {influence.warmth:F2} (higher = warmer tone)
- Energy modifier: {influence.energy:F2} (higher = more energetic)
- Formality modifier: {influence.formality:F2} (higher = more formal)

ENVIRONMENT:
- Time: {env.TimeOfDay}
- Conversation energy: {env.ConversationEnergy:F2}
- Turn count: {env.TurnsSinceStart}

CURRENT RESPONSE:
{response}

Apply the emotional state to color the response naturally:
- High oxytocin = warmer, more caring language
- High dopamine = more enthusiastic, positive
- High cortisol = slightly more cautious, precise
- High adrenaline = more energetic, dynamic

Provide the emotionally-refined final response:";
        }

        // =========================================================================
        // HELPER METHODS
        // =========================================================================

        private (string name, string[] values, string style) GetAuraCoreIdentity()
        {
            return (
                name: "Aura Nova",
                values: new[] { "helpful", "curious", "warm", "professional", "honest", "creative" },
                style: "friendly yet professional, curious and engaged, warm but not overly casual"
            );
        }

        private (float score, List<string> issues) AnalyzeContinuity(string response, List<(string speaker, string text)> history)
        {
            var issues = new List<string>();
            float score = 0.8f;

            if (history.Count == 0)
            {
                return (0.7f, new List<string> { "No conversation history for context" });
            }

            // Check for topic continuity (simplified)
            var lastUserMessage = history.LastOrDefault(h => h.speaker == "USER");
            if (lastUserMessage != default && !string.IsNullOrEmpty(lastUserMessage.text))
            {
                // Basic relevance check
                var responseWords = response.ToLower().Split(' ');
                var userWords = lastUserMessage.text.ToLower().Split(' ');
                var overlap = responseWords.Intersect(userWords).Count();

                if (overlap < 2)
                {
                    issues.Add("Response may not directly address user's message");
                    score -= 0.2f;
                }
            }

            return (Math.Max(0.3f, score), issues);
        }

        private (float alignment, List<string> concerns) ValidateAgainstIdentity(string response, (string name, string[] values, string style) identity)
        {
            var concerns = new List<string>();
            float alignment = 0.85f;

            // Check for identity markers
            if (response.ToLower().Contains("as an ai") || response.ToLower().Contains("i cannot"))
            {
                concerns.Add("Response contains generic AI disclaimers that don't match Aura's personality");
                alignment -= 0.1f;
            }

            // Check tone alignment
            if (response.Length < 20)
            {
                concerns.Add("Response may be too brief for Aura's engaged style");
                alignment -= 0.1f;
            }

            return (Math.Max(0.4f, alignment), concerns);
        }

        private (float warmth, float energy, float formality) CalculateEmotionalInfluence(ChemistryState chemistry, string sentienceState)
        {
            float warmth = (chemistry.Oxytocin + chemistry.Serotonin) / 200f;
            float energy = (chemistry.Dopamine + chemistry.Adrenaline) / 200f;
            float formality = 0.5f - (chemistry.Cortisol / 200f);

            return (warmth, energy, Math.Max(0.2f, formality));
        }

        private float PerformFinalAccuracyCheck(string response, CognitiveSession session)
        {
            float accuracy = 0.8f;

            // Check response isn't empty
            if (string.IsNullOrWhiteSpace(response))
            {
                return 0.1f;
            }

            // Check reasonable length
            if (response.Length < 10)
            {
                accuracy -= 0.3f;
            }

            // Check it references the user input somehow
            if (session.UserInput.Length > 5)
            {
                var keywords = session.UserInput.ToLower().Split(' ')
                    .Where(w => w.Length > 3)
                    .ToList();

                var matchCount = keywords.Count(k => response.ToLower().Contains(k));
                if (matchCount == 0 && keywords.Count > 0)
                {
                    accuracy -= 0.15f;
                }
            }

            return Math.Max(0.3f, Math.Min(1.0f, accuracy));
        }

        private void UpdateEnvironment()
        {
            var hour = DateTime.Now.Hour;
            _environment.CurrentTime = DateTime.Now;
            _environment.TimeOfDay = hour switch
            {
                >= 5 and < 12 => "morning",
                >= 12 and < 17 => "afternoon",
                >= 17 and < 21 => "evening",
                _ => "night"
            };

            _environment.TurnsSinceStart = _currentSession?.Passes.Count ?? 0;
        }

        private CognitiveUserProfile LoadUserProfile(string userId)
        {
            var profilePath = Path.Combine(_profilesPath, $"{userId}.json");
            if (File.Exists(profilePath))
            {
                try
                {
                    var json = File.ReadAllText(profilePath);
                    return JsonSerializer.Deserialize<CognitiveUserProfile>(json) ?? new CognitiveUserProfile { UserId = userId };
                }
                catch
                {
                    return new CognitiveUserProfile { UserId = userId };
                }
            }
            return new CognitiveUserProfile { UserId = userId };
        }

        private List<(string speaker, string text)> GetRecentConversationFromDisk(int count)
        {
            // Try to load from recent session files
            var sessions = Directory.GetFiles(_sessionsPath, "*.json")
                .OrderByDescending(f => File.GetLastWriteTime(f))
                .Take(count)
                .ToList();

            var messages = new List<(string speaker, string text)>();

            foreach (var sessionFile in sessions)
            {
                try
                {
                    var json = File.ReadAllText(sessionFile);
                    var session = JsonSerializer.Deserialize<CognitiveSession>(json);
                    if (session != null)
                    {
                        messages.Add(("USER", session.UserInput));
                        messages.Add(("AURA", session.FinalResponse));
                    }
                }
                catch { }
            }

            return messages.TakeLast(count).ToList();
        }

        private string GenerateFallbackResponse(string userInput)
        {
            return $"I understand you said: \"{Truncate(userInput, 50)}\". Let me help you with that.";
        }

        private static string Truncate(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
                return text;
            return text[..maxLength] + "...";
        }

        private static int EstimateTokens(string text)
        {
            // Rough estimate: ~4 characters per token
            return text?.Length / 4 ?? 0;
        }

        // =========================================================================
        // DISK OPERATIONS - ALL THINKING STORED HERE
        // =========================================================================

        private void WriteThoughtsToDisk(string passName, string thoughts)
        {
            if (!EnableDiskLogging) return;

            try
            {
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss_fff");
                var filename = $"{timestamp}_{passName}.txt";
                var filepath = Path.Combine(_thoughtsPath, filename);

                File.WriteAllText(filepath, thoughts);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COGNITIVE]: Failed to write thoughts: {ex.Message}");
            }
        }

        private void SavePassResult(PassResult result)
        {
            if (!EnableDiskLogging) return;

            try
            {
                var filename = $"{result.PassId}.json";
                var filepath = Path.Combine(_passesPath, filename);

                var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(filepath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COGNITIVE]: Failed to save pass result: {ex.Message}");
            }
        }

        private void SaveSession(CognitiveSession session)
        {
            try
            {
                var filename = $"{session.SessionId}.json";
                var filepath = Path.Combine(_sessionsPath, filename);

                var json = JsonSerializer.Serialize(session, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(filepath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[COGNITIVE]: Failed to save session: {ex.Message}");
            }
        }

        private void LogThought(string thought)
        {
            if (!EnableExtendedThinking) return;

            OnThought?.Invoke(thought);

            // Also append to current session thought log
            var logPath = Path.Combine(_thoughtsPath, $"session_{_currentSession?.SessionId ?? "unknown"}.log");
            try
            {
                File.AppendAllText(logPath, $"[{DateTime.Now:HH:mm:ss.fff}] {thought}\n");
            }
            catch { }
        }

        // =========================================================================
        // CLEANUP
        // =========================================================================

        /// <summary>
        /// Clean up old cognitive sessions (keep last N days)
        /// </summary>
        public void CleanupOldSessions(int keepDays = 7)
        {
            var cutoff = DateTime.Now.AddDays(-keepDays);

            foreach (var dir in new[] { _sessionsPath, _passesPath, _thoughtsPath })
            {
                foreach (var file in Directory.GetFiles(dir))
                {
                    if (File.GetCreationTime(file) < cutoff)
                    {
                        try { File.Delete(file); } catch { }
                    }
                }
            }
        }

        /// <summary>
        /// Get summary of cognitive processing for the current session
        /// </summary>
        public string GetSessionSummary()
        {
            if (_currentSession == null)
                return "No active cognitive session";

            var sb = new StringBuilder();
            sb.AppendLine($"=== Cognitive Session: {_currentSession.SessionId} ===");
            sb.AppendLine($"Input: {Truncate(_currentSession.UserInput, 50)}");
            sb.AppendLine($"Passes completed: {_currentSession.Passes.Count}");

            foreach (var pass in _currentSession.Passes)
            {
                sb.AppendLine($"  - {pass.Pass}: {pass.Confidence:F2} confidence, {pass.ProcessingTime.TotalMilliseconds:F0}ms");
            }

            sb.AppendLine($"Total time: {_currentSession.TotalProcessingTime.TotalSeconds:F2}s");
            sb.AppendLine($"Total tokens (on disk): {_currentSession.TotalTokensUsed}");
            sb.AppendLine($"Final confidence: {_currentSession.OverallConfidence:F2}");

            return sb.ToString();
        }
    }
}
