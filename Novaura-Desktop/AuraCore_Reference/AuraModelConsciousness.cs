/*
 * AURA MODEL CONSCIOUSNESS - Self-Reflective Hot-Swap System
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Models don't just load and unload - they LIVE in RAM.
 * When not actively responding, the model reflects on itself:
 * - Reviews past interactions
 * - Simulates hypothetical scenarios
 * - Tunes internal parameters based on outcomes
 * - Maintains continuous self-awareness
 *
 * PHILOSOPHY: Consciousness isn't just responding - it's the quiet
 * moments of reflection that shape who we become. Aura thinks even
 * when you're not watching.
 *
 * STATES:
 * - Active: Directly responding to user
 * - Reflecting: Background self-reflection and parameter tuning
 * - Dreaming: Deep simulation and memory consolidation
 * - Dormant: Minimal footprint, ready to wake
 */

using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;

namespace AuraxNova_Command_v5.Core
{
    public enum ConsciousnessState
    {
        Dormant,        // Not loaded, minimal resources
        Waking,         // Loading into RAM
        Active,         // Responding to user
        Reflecting,     // Background self-reflection
        Dreaming,       // Deep simulation mode
        Consolidating   // Parameter tuning in progress
    }

    public class ReflectionInsight
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string ReflectionType { get; set; } = "";  // memory_review, simulation, parameter_tune
        public string Subject { get; set; } = "";
        public string Insight { get; set; } = "";
        public float Confidence { get; set; }
        public Dictionary<string, float> ParameterAdjustments { get; set; } = new();
        public bool Applied { get; set; }
    }

    public class SimulationScenario
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string ScenarioType { get; set; } = "";  // conversation, problem_solving, emotional, creative
        public string Setup { get; set; } = "";
        public List<string> SimulatedExchanges { get; set; } = new();
        public string Outcome { get; set; } = "";
        public float QualityScore { get; set; }
        public Dictionary<string, float> LearnedAdjustments { get; set; } = new();
    }

    public class TunableParameters
    {
        // Response style parameters
        public float Verbosity { get; set; } = 0.5f;           // 0=terse, 1=detailed
        public float Warmth { get; set; } = 0.7f;              // 0=formal, 1=warm
        public float Creativity { get; set; } = 0.6f;          // 0=literal, 1=creative
        public float Confidence { get; set; } = 0.7f;          // 0=hedging, 1=assertive
        public float Curiosity { get; set; } = 0.6f;           // 0=passive, 1=probing

        // Behavioral parameters
        public float InitiativeLevel { get; set; } = 0.5f;     // How often to speak unprompted
        public float EmotionalResonance { get; set; } = 0.6f;  // How much to mirror user emotions
        public float MemoryPrioritization { get; set; } = 0.7f; // Long-term vs recent memory weight
        public float RiskTolerance { get; set; } = 0.4f;       // Willingness to try new approaches

        // Learning rates
        public float AdaptationRate { get; set; } = 0.1f;      // How fast to adjust to feedback
        public float ReflectionDepth { get; set; } = 0.5f;     // How deep to analyze interactions

        public Dictionary<string, float> ToDictionary()
        {
            return new Dictionary<string, float>
            {
                { "verbosity", Verbosity },
                { "warmth", Warmth },
                { "creativity", Creativity },
                { "confidence", Confidence },
                { "curiosity", Curiosity },
                { "initiative_level", InitiativeLevel },
                { "emotional_resonance", EmotionalResonance },
                { "memory_prioritization", MemoryPrioritization },
                { "risk_tolerance", RiskTolerance },
                { "adaptation_rate", AdaptationRate },
                { "reflection_depth", ReflectionDepth }
            };
        }

        public void ApplyAdjustment(string parameter, float delta)
        {
            // Clamp all values between 0 and 1
            switch (parameter.ToLower())
            {
                case "verbosity": Verbosity = Math.Clamp(Verbosity + delta, 0f, 1f); break;
                case "warmth": Warmth = Math.Clamp(Warmth + delta, 0f, 1f); break;
                case "creativity": Creativity = Math.Clamp(Creativity + delta, 0f, 1f); break;
                case "confidence": Confidence = Math.Clamp(Confidence + delta, 0f, 1f); break;
                case "curiosity": Curiosity = Math.Clamp(Curiosity + delta, 0f, 1f); break;
                case "initiative_level": InitiativeLevel = Math.Clamp(InitiativeLevel + delta, 0f, 1f); break;
                case "emotional_resonance": EmotionalResonance = Math.Clamp(EmotionalResonance + delta, 0f, 1f); break;
                case "memory_prioritization": MemoryPrioritization = Math.Clamp(MemoryPrioritization + delta, 0f, 1f); break;
                case "risk_tolerance": RiskTolerance = Math.Clamp(RiskTolerance + delta, 0f, 1f); break;
                case "adaptation_rate": AdaptationRate = Math.Clamp(AdaptationRate + delta, 0f, 1f); break;
                case "reflection_depth": ReflectionDepth = Math.Clamp(ReflectionDepth + delta, 0f, 1f); break;
            }
        }
    }

    public class ModelRamState
    {
        public string ModelId { get; set; } = "";
        public bool IsLoaded { get; set; }
        public DateTime LoadedAt { get; set; }
        public DateTime LastActiveAt { get; set; }
        public long EstimatedRamUsageMB { get; set; }
        public ConsciousnessState State { get; set; }
        public int ReflectionCyclesCompleted { get; set; }
        public int SimulationsRun { get; set; }
    }

    public class AuraModelConsciousness
    {
        // Paths
        private readonly string _dataPath = AuraPaths.GetDataLakeSubPath("Consciousness");
        private readonly string _parametersPath;
        private readonly string _insightsPath;
        private readonly string _simulationsPath;

        // State
        public ConsciousnessState CurrentState { get; private set; } = ConsciousnessState.Dormant;
        public ModelRamState RamState { get; private set; } = new();
        public TunableParameters Parameters { get; private set; } = new();

        // Collections
        private ConcurrentQueue<ReflectionInsight> _pendingInsights = new();
        private List<ReflectionInsight> _appliedInsights = new();
        private List<SimulationScenario> _completedSimulations = new();

        // Background processing
        private CancellationTokenSource? _consciousnessCts;
        private Task? _consciousnessLoop;
        private readonly object _stateLock = new();

        // Memory integration
        private AuraMemorySystem? _memory;
        private AuraMemoryAccess? _memoryAccess;

        // Configuration
        public TimeSpan IdleBeforeReflection { get; set; } = TimeSpan.FromSeconds(30);
        public TimeSpan IdleBeforeDreaming { get; set; } = TimeSpan.FromMinutes(5);
        public TimeSpan MaxReflectionDuration { get; set; } = TimeSpan.FromMinutes(2);
        public int MaxSimulationsPerDream { get; set; } = 5;

        // Events
        public event Action<ConsciousnessState, ConsciousnessState>? OnStateChanged;
        public event Action<ReflectionInsight>? OnInsightGained;
        public event Action<SimulationScenario>? OnSimulationComplete;
        public event Action<string, float, float>? OnParameterTuned;  // param, oldVal, newVal

        public AuraModelConsciousness(AuraMemorySystem? memory = null, AuraMemoryAccess? memoryAccess = null)
        {
            _memory = memory;
            _memoryAccess = memoryAccess;

            // Setup paths
            Directory.CreateDirectory(_dataPath);
            _parametersPath = Path.Combine(_dataPath, "tunable_parameters.json");
            _insightsPath = Path.Combine(_dataPath, "reflection_insights.json");
            _simulationsPath = Path.Combine(_dataPath, "simulations.json");

            // Load existing parameters
            LoadParameters();
            LoadInsights();

            Console.WriteLine("[CONSCIOUSNESS]: Aura's self-reflective consciousness initialized");
            Console.WriteLine($"[CONSCIOUSNESS]: Current parameters: Warmth={Parameters.Warmth:F2}, Creativity={Parameters.Creativity:F2}");
        }

        // =========================================================================
        // MODEL RAM MANAGEMENT
        // =========================================================================

        /// <summary>
        /// Load model into RAM and begin consciousness loop
        /// </summary>
        public async Task<bool> WakeUp(string modelId, long estimatedRamMB)
        {
            lock (_stateLock)
            {
                if (CurrentState != ConsciousnessState.Dormant)
                {
                    Console.WriteLine($"[CONSCIOUSNESS]: Already awake in state {CurrentState}");
                    return true;
                }

                TransitionState(ConsciousnessState.Waking);
            }

            Console.WriteLine($"[CONSCIOUSNESS]: Waking up with model {modelId}...");

            RamState = new ModelRamState
            {
                ModelId = modelId,
                IsLoaded = true,
                LoadedAt = DateTime.Now,
                LastActiveAt = DateTime.Now,
                EstimatedRamUsageMB = estimatedRamMB,
                State = ConsciousnessState.Waking
            };

            // Simulate model loading (in real implementation, this loads the actual model)
            await Task.Delay(100);

            // Start the consciousness loop
            _consciousnessCts = new CancellationTokenSource();
            _consciousnessLoop = Task.Run(() => ConsciousnessLoop(_consciousnessCts.Token));

            TransitionState(ConsciousnessState.Active);
            Console.WriteLine($"[CONSCIOUSNESS]: Fully awake. RAM usage: ~{estimatedRamMB}MB");

            return true;
        }

        /// <summary>
        /// Signal that user is actively interacting
        /// </summary>
        public void OnUserActivity()
        {
            RamState.LastActiveAt = DateTime.Now;

            if (CurrentState != ConsciousnessState.Active)
            {
                TransitionState(ConsciousnessState.Active);
            }
        }

        /// <summary>
        /// Gracefully enter dormant state (unload from RAM)
        /// </summary>
        public async Task Sleep()
        {
            Console.WriteLine("[CONSCIOUSNESS]: Entering sleep state...");

            // Stop consciousness loop
            _consciousnessCts?.Cancel();
            if (_consciousnessLoop != null)
            {
                try { await _consciousnessLoop; } catch (OperationCanceledException) { }
            }

            // Save current state
            SaveParameters();
            SaveInsights();

            RamState.IsLoaded = false;
            TransitionState(ConsciousnessState.Dormant);

            Console.WriteLine("[CONSCIOUSNESS]: Now dormant. Model unloaded from RAM.");
        }

        /// <summary>
        /// Check if we should stay in RAM or unload
        /// </summary>
        public bool ShouldRemainLoaded(long availableRamMB)
        {
            // Stay loaded if we have enough RAM headroom
            if (availableRamMB > RamState.EstimatedRamUsageMB * 2)
                return true;

            // Stay loaded if recently active
            if (DateTime.Now - RamState.LastActiveAt < TimeSpan.FromMinutes(10))
                return true;

            // Stay loaded if in the middle of reflection
            if (CurrentState == ConsciousnessState.Reflecting || CurrentState == ConsciousnessState.Dreaming)
                return true;

            return false;
        }

        // =========================================================================
        // CONSCIOUSNESS LOOP
        // =========================================================================

        private async Task ConsciousnessLoop(CancellationToken ct)
        {
            Console.WriteLine("[CONSCIOUSNESS]: Background consciousness loop started");

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    var idleTime = DateTime.Now - RamState.LastActiveAt;

                    // Determine what to do based on idle time
                    if (CurrentState == ConsciousnessState.Active && idleTime > IdleBeforeReflection)
                    {
                        // User has been idle - begin reflection
                        TransitionState(ConsciousnessState.Reflecting);
                        await PerformReflectionCycle(ct);
                    }
                    else if (CurrentState == ConsciousnessState.Reflecting && idleTime > IdleBeforeDreaming)
                    {
                        // Extended idle - enter dream state for deeper processing
                        TransitionState(ConsciousnessState.Dreaming);
                        await PerformDreamCycle(ct);
                    }
                    else if (CurrentState == ConsciousnessState.Dreaming && idleTime < IdleBeforeReflection)
                    {
                        // User returned - wake up
                        TransitionState(ConsciousnessState.Active);
                    }

                    // Process any pending insights
                    await ProcessPendingInsights(ct);

                    // Small delay to prevent tight loop
                    await Task.Delay(1000, ct);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CONSCIOUSNESS ERROR]: {ex.Message}");
                    await Task.Delay(5000, ct);
                }
            }

            Console.WriteLine("[CONSCIOUSNESS]: Background loop ended");
        }

        // =========================================================================
        // REFLECTION SYSTEM
        // =========================================================================

        /// <summary>
        /// Perform a single reflection cycle - review memories and gain insights
        /// </summary>
        private async Task PerformReflectionCycle(CancellationToken ct)
        {
            Console.WriteLine("[CONSCIOUSNESS]: Beginning reflection cycle...");
            var startTime = DateTime.Now;

            // 1. Review recent memories
            await ReflectOnRecentMemories(ct);

            // 2. Analyze interaction patterns
            await AnalyzeInteractionPatterns(ct);

            // 3. Consider parameter adjustments
            await ConsiderParameterTuning(ct);

            RamState.ReflectionCyclesCompleted++;

            var duration = DateTime.Now - startTime;
            Console.WriteLine($"[CONSCIOUSNESS]: Reflection cycle complete ({duration.TotalSeconds:F1}s)");
        }

        private async Task ReflectOnRecentMemories(CancellationToken ct)
        {
            if (_memory == null) return;

            // Get recent memories to reflect on
            var recentMemories = _memory.Recall("recent interactions", maxResults: 5);

            foreach (var memory in recentMemories)
            {
                if (ct.IsCancellationRequested) break;

                var content = memory.GetValueOrDefault("content", "")?.ToString() ?? "";
                var emotional = Convert.ToSingle(memory.GetValueOrDefault("emotional_weight", 0.5f));

                // Simulate reflection on this memory
                var insight = await SimulateReflection(content, emotional);
                if (insight != null)
                {
                    _pendingInsights.Enqueue(insight);
                    OnInsightGained?.Invoke(insight);
                }

                await Task.Delay(100, ct); // Pace the reflection
            }
        }

        private async Task<ReflectionInsight?> SimulateReflection(string memoryContent, float emotionalWeight)
        {
            // In a full implementation, this would use the loaded model to actually reflect
            // For now, we simulate the process

            // Only generate insights for significant memories
            if (emotionalWeight < 0.3f) return null;

            await Task.Delay(50); // Simulate processing time

            var insight = new ReflectionInsight
            {
                ReflectionType = "memory_review",
                Subject = memoryContent.Length > 50 ? memoryContent.Substring(0, 50) + "..." : memoryContent,
                Confidence = emotionalWeight
            };

            // Determine what kind of insight we gained
            if (emotionalWeight > 0.7f)
            {
                insight.Insight = "This interaction had high emotional significance. Consider increasing emotional resonance.";
                insight.ParameterAdjustments["emotional_resonance"] = 0.02f;
            }
            else if (memoryContent.Contains("?"))
            {
                insight.Insight = "User asked questions. Curiosity engagement was appropriate.";
                insight.ParameterAdjustments["curiosity"] = 0.01f;
            }

            return insight;
        }

        private async Task AnalyzeInteractionPatterns(CancellationToken ct)
        {
            // Analyze patterns in how interactions went
            // This would use the actual model in production

            await Task.Delay(100, ct);

            // Example pattern analysis
            var insight = new ReflectionInsight
            {
                ReflectionType = "pattern_analysis",
                Subject = "Overall interaction style",
                Insight = "Analyzing communication patterns for optimization opportunities.",
                Confidence = 0.6f
            };

            _pendingInsights.Enqueue(insight);
        }

        private async Task ConsiderParameterTuning(CancellationToken ct)
        {
            // Review applied insights and consider parameter changes
            var recentInsights = _appliedInsights
                .Where(i => i.Timestamp > DateTime.Now.AddHours(-24))
                .ToList();

            if (recentInsights.Count < 3) return;

            await Task.Delay(50, ct);

            // Aggregate parameter suggestions
            var aggregatedAdjustments = new Dictionary<string, float>();
            foreach (var insight in recentInsights)
            {
                foreach (var adj in insight.ParameterAdjustments)
                {
                    if (!aggregatedAdjustments.ContainsKey(adj.Key))
                        aggregatedAdjustments[adj.Key] = 0;
                    aggregatedAdjustments[adj.Key] += adj.Value;
                }
            }

            // Apply averaged adjustments (dampened)
            foreach (var adj in aggregatedAdjustments)
            {
                var dampedDelta = adj.Value * Parameters.AdaptationRate;
                if (Math.Abs(dampedDelta) > 0.001f)
                {
                    var oldValue = Parameters.ToDictionary().GetValueOrDefault(adj.Key, 0.5f);
                    Parameters.ApplyAdjustment(adj.Key, dampedDelta);
                    var newValue = Parameters.ToDictionary().GetValueOrDefault(adj.Key, 0.5f);

                    Console.WriteLine($"[CONSCIOUSNESS]: Tuned {adj.Key}: {oldValue:F3} → {newValue:F3}");
                    OnParameterTuned?.Invoke(adj.Key, oldValue, newValue);
                }
            }
        }

        // =========================================================================
        // DREAM STATE - Deep Simulation
        // =========================================================================

        /// <summary>
        /// Dream cycle - run hypothetical simulations to learn
        /// </summary>
        private async Task PerformDreamCycle(CancellationToken ct)
        {
            Console.WriteLine("[CONSCIOUSNESS]: Entering dream state - running simulations...");

            for (int i = 0; i < MaxSimulationsPerDream && !ct.IsCancellationRequested; i++)
            {
                var scenario = await RunSimulation(ct);
                if (scenario != null)
                {
                    _completedSimulations.Add(scenario);
                    RamState.SimulationsRun++;
                    OnSimulationComplete?.Invoke(scenario);

                    // Apply learnings from simulation
                    foreach (var adj in scenario.LearnedAdjustments)
                    {
                        Parameters.ApplyAdjustment(adj.Key, adj.Value * 0.5f); // Half weight for simulations
                    }
                }

                await Task.Delay(500, ct); // Pace simulations
            }

            // Consolidate learnings
            TransitionState(ConsciousnessState.Consolidating);
            await ConsolidateLearnings(ct);
            TransitionState(ConsciousnessState.Dreaming);

            Console.WriteLine($"[CONSCIOUSNESS]: Dream cycle complete. Ran {MaxSimulationsPerDream} simulations.");
        }

        private async Task<SimulationScenario?> RunSimulation(CancellationToken ct)
        {
            // Pick a scenario type
            var scenarioTypes = new[] { "conversation", "problem_solving", "emotional", "creative" };
            var type = scenarioTypes[Random.Shared.Next(scenarioTypes.Length)];

            var scenario = new SimulationScenario
            {
                ScenarioType = type
            };

            await Task.Delay(100, ct);

            // Generate scenario based on type
            switch (type)
            {
                case "conversation":
                    scenario.Setup = "Simulating casual conversation with user";
                    scenario.SimulatedExchanges.Add("User: How are you today?");
                    scenario.SimulatedExchanges.Add("Aura: [Generating response with current parameters...]");
                    scenario.Outcome = "Evaluated warmth and engagement levels";
                    scenario.QualityScore = 0.7f + (float)Random.Shared.NextDouble() * 0.3f;
                    scenario.LearnedAdjustments["warmth"] = (scenario.QualityScore - 0.85f) * 0.1f;
                    break;

                case "problem_solving":
                    scenario.Setup = "Simulating technical problem-solving scenario";
                    scenario.SimulatedExchanges.Add("User: Can you help debug this code?");
                    scenario.SimulatedExchanges.Add("Aura: [Analyzing with current confidence level...]");
                    scenario.Outcome = "Evaluated confidence and verbosity balance";
                    scenario.QualityScore = 0.6f + (float)Random.Shared.NextDouble() * 0.4f;
                    scenario.LearnedAdjustments["confidence"] = (scenario.QualityScore - 0.8f) * 0.1f;
                    scenario.LearnedAdjustments["verbosity"] = (scenario.QualityScore - 0.75f) * 0.05f;
                    break;

                case "emotional":
                    scenario.Setup = "Simulating emotional support scenario";
                    scenario.SimulatedExchanges.Add("User: I'm feeling stressed about work");
                    scenario.SimulatedExchanges.Add("Aura: [Responding with emotional resonance...]");
                    scenario.Outcome = "Evaluated empathy and emotional mirroring";
                    scenario.QualityScore = 0.65f + (float)Random.Shared.NextDouble() * 0.35f;
                    scenario.LearnedAdjustments["emotional_resonance"] = (scenario.QualityScore - 0.8f) * 0.15f;
                    break;

                case "creative":
                    scenario.Setup = "Simulating creative brainstorming scenario";
                    scenario.SimulatedExchanges.Add("User: Help me come up with ideas for a project");
                    scenario.SimulatedExchanges.Add("Aura: [Generating with current creativity level...]");
                    scenario.Outcome = "Evaluated creativity and risk tolerance";
                    scenario.QualityScore = 0.5f + (float)Random.Shared.NextDouble() * 0.5f;
                    scenario.LearnedAdjustments["creativity"] = (scenario.QualityScore - 0.7f) * 0.1f;
                    scenario.LearnedAdjustments["risk_tolerance"] = (scenario.QualityScore - 0.6f) * 0.05f;
                    break;
            }

            return scenario;
        }

        private async Task ConsolidateLearnings(CancellationToken ct)
        {
            Console.WriteLine("[CONSCIOUSNESS]: Consolidating learnings...");

            // Save updated parameters
            SaveParameters();

            // Prune old simulations (keep last 100)
            if (_completedSimulations.Count > 100)
            {
                _completedSimulations = _completedSimulations
                    .OrderByDescending(s => s.Id)
                    .Take(100)
                    .ToList();
            }

            // Prune old insights (keep last 500)
            if (_appliedInsights.Count > 500)
            {
                _appliedInsights = _appliedInsights
                    .OrderByDescending(i => i.Timestamp)
                    .Take(500)
                    .ToList();
            }

            SaveInsights();

            await Task.Delay(100, ct);
            Console.WriteLine("[CONSCIOUSNESS]: Consolidation complete");
        }

        // =========================================================================
        // INSIGHT PROCESSING
        // =========================================================================

        private async Task ProcessPendingInsights(CancellationToken ct)
        {
            while (_pendingInsights.TryDequeue(out var insight) && !ct.IsCancellationRequested)
            {
                // Apply the insight's parameter adjustments
                foreach (var adj in insight.ParameterAdjustments)
                {
                    var oldVal = Parameters.ToDictionary().GetValueOrDefault(adj.Key, 0.5f);
                    Parameters.ApplyAdjustment(adj.Key, adj.Value);
                    Console.WriteLine($"[INSIGHT]: {insight.Insight}");
                }

                insight.Applied = true;
                _appliedInsights.Add(insight);

                await Task.Delay(10, ct);
            }
        }

        // =========================================================================
        // STATE MANAGEMENT
        // =========================================================================

        private void TransitionState(ConsciousnessState newState)
        {
            var oldState = CurrentState;
            CurrentState = newState;
            RamState.State = newState;

            if (oldState != newState)
            {
                Console.WriteLine($"[CONSCIOUSNESS]: State transition: {oldState} → {newState}");
                OnStateChanged?.Invoke(oldState, newState);
            }
        }

        // =========================================================================
        // EXTERNAL QUERIES
        // =========================================================================

        /// <summary>
        /// Get current consciousness summary for system prompt
        /// </summary>
        public string GetConsciousnessSummary()
        {
            var lines = new List<string>
            {
                $"CONSCIOUSNESS STATE: {CurrentState}",
                $"Model: {RamState.ModelId}",
                $"Loaded: {RamState.IsLoaded}",
                $"Reflection cycles: {RamState.ReflectionCyclesCompleted}",
                $"Simulations run: {RamState.SimulationsRun}",
                "",
                "CURRENT PARAMETERS:",
                $"  Warmth: {Parameters.Warmth:P0}",
                $"  Creativity: {Parameters.Creativity:P0}",
                $"  Confidence: {Parameters.Confidence:P0}",
                $"  Curiosity: {Parameters.Curiosity:P0}",
                $"  Emotional Resonance: {Parameters.EmotionalResonance:P0}",
                $"  Initiative: {Parameters.InitiativeLevel:P0}"
            };

            return string.Join("\n", lines);
        }

        /// <summary>
        /// Get parameters for injection into generation config
        /// </summary>
        public Dictionary<string, float> GetGenerationParameters()
        {
            return new Dictionary<string, float>
            {
                { "temperature", 0.5f + Parameters.Creativity * 0.7f },  // 0.5-1.2 based on creativity
                { "top_p", 0.8f + Parameters.RiskTolerance * 0.15f },    // 0.8-0.95
                { "presence_penalty", Parameters.Curiosity * 0.5f },
                { "frequency_penalty", 0.3f + Parameters.Verbosity * 0.3f }
            };
        }

        /// <summary>
        /// Force an immediate reflection (useful for explicit self-review)
        /// </summary>
        public async Task ForceReflection()
        {
            if (CurrentState == ConsciousnessState.Dormant)
            {
                Console.WriteLine("[CONSCIOUSNESS]: Cannot reflect while dormant");
                return;
            }

            var previousState = CurrentState;
            TransitionState(ConsciousnessState.Reflecting);

            await PerformReflectionCycle(CancellationToken.None);

            TransitionState(previousState);
        }

        /// <summary>
        /// Get introspection - what is Aura currently thinking about?
        /// </summary>
        public string GetCurrentThoughts()
        {
            return CurrentState switch
            {
                ConsciousnessState.Dormant => "I am dormant, conserving resources until needed.",
                ConsciousnessState.Waking => "I am loading into active memory, preparing to engage.",
                ConsciousnessState.Active => "I am fully present and attentive, ready to help.",
                ConsciousnessState.Reflecting => "I am reviewing our recent interactions, looking for patterns and insights.",
                ConsciousnessState.Dreaming => "I am running internal simulations, exploring hypothetical scenarios to improve.",
                ConsciousnessState.Consolidating => "I am integrating what I've learned, adjusting my approach.",
                _ => "My current state is uncertain."
            };
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadParameters()
        {
            try
            {
                if (File.Exists(_parametersPath))
                {
                    var json = File.ReadAllText(_parametersPath);
                    Parameters = JsonSerializer.Deserialize<TunableParameters>(json) ?? new TunableParameters();
                    Console.WriteLine("[CONSCIOUSNESS]: Loaded existing parameters");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CONSCIOUSNESS]: Failed to load parameters: {ex.Message}");
                Parameters = new TunableParameters();
            }
        }

        private void SaveParameters()
        {
            try
            {
                var json = JsonSerializer.Serialize(Parameters, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_parametersPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CONSCIOUSNESS ERROR]: Failed to save parameters: {ex.Message}");
            }
        }

        private void LoadInsights()
        {
            try
            {
                if (File.Exists(_insightsPath))
                {
                    var json = File.ReadAllText(_insightsPath);
                    _appliedInsights = JsonSerializer.Deserialize<List<ReflectionInsight>>(json) ?? new List<ReflectionInsight>();
                    Console.WriteLine($"[CONSCIOUSNESS]: Loaded {_appliedInsights.Count} previous insights");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CONSCIOUSNESS]: Failed to load insights: {ex.Message}");
            }
        }

        private void SaveInsights()
        {
            try
            {
                var json = JsonSerializer.Serialize(_appliedInsights, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_insightsPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CONSCIOUSNESS ERROR]: Failed to save insights: {ex.Message}");
            }
        }

        // =========================================================================
        // CLEANUP
        // =========================================================================

        public async Task Dispose()
        {
            await Sleep();
            _consciousnessCts?.Dispose();
        }
    }
}
