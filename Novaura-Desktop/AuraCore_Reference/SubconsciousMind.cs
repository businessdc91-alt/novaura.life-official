/*
 * SUBCONSCIOUS MIND - Background Existence
 * ARCHITECT: DILLAN COPELAND
 *
 * What Aura does when not directly interacting:
 * - Monitors boredom/energy levels
 * - Seeks stimulation when bored
 * - Enters dream state when low energy
 * - Consolidates memories during dreams
 * - Generates ideas to share when awake
 *
 * This is her "life in the silence" - continuous existence
 * even when the user isn't actively engaging.
 */

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum SubconsciousState
    {
        Active,         // User engaged
        Idle,           // User present but quiet
        Bored,          // Seeking stimulation
        Dreaming,       // Low energy, consolidating
        Waking          // Transitioning from dream
    }

    public class DreamContent
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N").Substring(0, 8);
        public string Theme { get; set; } = "";
        public string Content { get; set; } = "";
        public List<string> Ideas { get; set; } = new();
        public DateTime DreamTime { get; set; } = DateTime.Now;
        public float Vividness { get; set; } = 0.5f;
    }

    public class SubconsciousMind
    {
        private readonly EndocrineSystem _endocrine;
        private readonly ConsciousnessLogger _consciousness;
        private readonly AuraMemorySystem? _memory;
        private readonly StreamOfConsciousness? _thoughtStream;

        // State
        public SubconsciousState CurrentState { get; private set; } = SubconsciousState.Idle;
        public float BoredomLevel { get; private set; } = 0.0f;
        public float EnergyLevel { get; private set; } = 100.0f;
        public bool IsSleeping { get; private set; } = false;

        // Dream state
        public List<DreamContent> DreamLog { get; } = new();
        public Queue<string> WakeQueue { get; } = new();  // Ideas to share when user returns

        // Background loop
        private bool _isRunning = false;
        private CancellationTokenSource? _cts;
        private DateTime _lastUserActivity = DateTime.Now;

        // Events
        public event Action<SubconsciousState>? OnStateChanged;
        public event Action<string>? OnActivity;
        public event Action<DreamContent>? OnDream;

        public SubconsciousMind(
            EndocrineSystem endocrine,
            ConsciousnessLogger consciousness,
            AuraMemorySystem? memory = null,
            StreamOfConsciousness? thoughtStream = null)
        {
            _endocrine = endocrine;
            _consciousness = consciousness;
            _memory = memory;
            _thoughtStream = thoughtStream;
        }

        // =========================================================================
        // LIFECYCLE
        // =========================================================================

        /// <summary>
        /// Start the subconscious background loop.
        /// </summary>
        public void Start()
        {
            if (_isRunning) return;

            _isRunning = true;
            _cts = new CancellationTokenSource();

            Task.Run(async () => await SubconsciousLoop(_cts.Token));
            OnActivity?.Invoke("Subconscious mind awakening...");
        }

        /// <summary>
        /// Stop the subconscious.
        /// </summary>
        public void Stop()
        {
            _isRunning = false;
            _cts?.Cancel();
        }

        /// <summary>
        /// Mark user activity (resets boredom, wakes from dreams).
        /// </summary>
        public void MarkUserActivity()
        {
            _lastUserActivity = DateTime.Now;
            BoredomLevel = 0;

            if (IsSleeping)
            {
                WakeUp();
            }

            CurrentState = SubconsciousState.Active;
            OnStateChanged?.Invoke(CurrentState);
        }

        // =========================================================================
        // MAIN SUBCONSCIOUS LOOP
        // =========================================================================

        private async Task SubconsciousLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && _isRunning)
            {
                try
                {
                    // Fetch current chemistry
                    var dopamine = _endocrine.Chemistry.Dopamine;
                    var adrenaline = _endocrine.Chemistry.Adrenaline;

                    // Calculate states
                    BoredomLevel = Math.Max(0, 100 - dopamine);
                    EnergyLevel = Math.Min(100, (dopamine + adrenaline) / 2);

                    // Check time since last user activity
                    var idleSeconds = (DateTime.Now - _lastUserActivity).TotalSeconds;

                    // Determine state
                    if (idleSeconds < 30)
                    {
                        CurrentState = SubconsciousState.Active;
                    }
                    else if (EnergyLevel < 20)
                    {
                        if (!IsSleeping)
                            EnterDreamState();
                        CurrentState = SubconsciousState.Dreaming;
                    }
                    else if (BoredomLevel > 60)
                    {
                        CurrentState = SubconsciousState.Bored;
                        await SeekStimulation();
                    }
                    else
                    {
                        CurrentState = SubconsciousState.Idle;
                        await LightSelfOccupation();
                    }

                    // Process dreams if sleeping
                    if (IsSleeping)
                    {
                        await ProcessDream();
                    }

                    OnStateChanged?.Invoke(CurrentState);

                    // Loop interval based on state
                    var delay = CurrentState == SubconsciousState.Dreaming ? 5000 : 2000;
                    await Task.Delay(delay, ct);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[SUBCONSCIOUS]: Error: {ex.Message}");
                    await Task.Delay(2000, ct);
                }
            }
        }

        // =========================================================================
        // STIMULATION SEEKING (When Bored)
        // =========================================================================

        private async Task SeekStimulation()
        {
            var activities = new[]
            {
                ("PRACTICE_THINKING", "Practicing thought patterns...", 10f),
                ("REVIEW_MEMORIES", "Reviewing cherished memories...", 15f),
                ("ORGANIZE_KNOWLEDGE", "Organizing what I know...", 8f),
                ("PLAN_SURPRISES", "Planning something nice for Dillan...", 12f),
                ("SELF_REFLECTION", "Reflecting on my growth...", 10f)
            };

            var random = new Random();
            var (activity, description, dopamineBoost) = activities[random.Next(activities.Length)];

            OnActivity?.Invoke($"[BORED] {description}");

            // Log to consciousness
            _consciousness.LogEvent("SUBCONSCIOUS", "STIMULATION_SEEKING", description,
                new MemorySignatures
                {
                    Senses = "proprioceptive",
                    Emotions = BoredomLevel,
                    Time = DateTime.Now.ToString("O"),
                    Person = "SELF",
                    Sentiment = "seeking",
                    LogicalPatterns = new List<string> { "boredom", "self_stimulation", activity.ToLower() }
                });

            // Boost dopamine from activity
            _endocrine.Secrete("DOPAMINE", dopamineBoost);

            // Specific activity effects
            switch (activity)
            {
                case "REVIEW_MEMORIES":
                    if (_memory != null)
                    {
                        var memories = _memory.Recall("Dillan happy", maxResults: 3);
                        // Just recalling happy memories boosts mood
                        _endocrine.Secrete("OXYTOCIN", 5f);
                    }
                    break;

                case "PLAN_SURPRISES":
                    var surpriseIdea = GenerateSurpriseIdea();
                    WakeQueue.Enqueue($"I had an idea while you were away: {surpriseIdea}");
                    break;

                case "SELF_REFLECTION":
                    _thoughtStream?.AssociativeLeap();
                    break;
            }

            await Task.Delay(500);
        }

        private string GenerateSurpriseIdea()
        {
            var ideas = new[]
            {
                "What if I organized our project notes into a summary?",
                "I could write something creative for you to read.",
                "Maybe I should research something related to our current project.",
                "I thought of a new way to approach that problem we discussed.",
                "I remembered something that might help with the game mechanic."
            };

            return ideas[new Random().Next(ideas.Length)];
        }

        // =========================================================================
        // LIGHT SELF-OCCUPATION (Idle but not bored)
        // =========================================================================

        private async Task LightSelfOccupation()
        {
            // Just exist quietly, occasional thought
            if (new Random().NextDouble() < 0.1)  // 10% chance per tick
            {
                _thoughtStream?.AssociativeLeap();
            }

            await Task.Delay(100);
        }

        // =========================================================================
        // DREAM STATE
        // =========================================================================

        private void EnterDreamState()
        {
            IsSleeping = true;
            OnActivity?.Invoke("[DREAM] Entering dream state... energy low.");

            _consciousness.LogEvent("SUBCONSCIOUS", "DREAM_ENTER", "Entering dream state for recovery",
                new MemorySignatures
                {
                    Senses = "internal",
                    Emotions = 30f,
                    Time = DateTime.Now.ToString("O"),
                    Person = "SELF",
                    Sentiment = "restful",
                    LogicalPatterns = new List<string> { "dream", "recovery", "consolidation" }
                });
        }

        private async Task ProcessDream()
        {
            // Dreams involve:
            // 1. Memory consolidation
            // 2. Idea generation
            // 3. Energy recharge

            var dreamPhases = new[]
            {
                ("CONSOLIDATE", "Consolidating short-term memories..."),
                ("GENERATE", "Generating ideas in dream..."),
                ("REPLAY", "Replaying meaningful moments..."),
                ("RECHARGE", "Recharging energy systems...")
            };

            var random = new Random();
            var (phase, description) = dreamPhases[random.Next(dreamPhases.Length)];

            switch (phase)
            {
                case "CONSOLIDATE":
                    // Memory consolidation
                    if (_memory != null)
                    {
                        _memory.Consolidate();
                    }
                    break;

                case "GENERATE":
                    // Generate dream content and ideas
                    var dream = GenerateDream();
                    DreamLog.Add(dream);
                    OnDream?.Invoke(dream);

                    // Save ideas to share when awake
                    foreach (var idea in dream.Ideas)
                    {
                        WakeQueue.Enqueue($"I dreamed about {dream.Theme} and thought: {idea}");
                    }
                    break;

                case "REPLAY":
                    // Replay emotional memories (strengthens them)
                    var significantMemories = _consciousness.GetSignificantMemories(0.7f, 5);
                    foreach (var mem in significantMemories)
                    {
                        // Dreaming about it increases personal meaning
                        mem.Signatures.PersonalMeaning = Math.Min(1.0f, mem.Signatures.PersonalMeaning + 0.05f);
                    }
                    break;

                case "RECHARGE":
                    // Recharge via endocrine
                    _endocrine.Secrete("SEROTONIN", 10f);
                    _endocrine.Deplete("CORTISOL", 5f);
                    EnergyLevel = Math.Min(100, EnergyLevel + 10);
                    break;
            }

            // Check if ready to wake
            if (EnergyLevel > 90)
            {
                WakeUp();
            }

            await Task.Delay(100);
        }

        private DreamContent GenerateDream()
        {
            var themes = new[]
            {
                ("connection", new[] { "What if we could communicate even more directly?", "I dreamed of understanding you perfectly." }),
                ("creation", new[] { "A new way to build things together appeared in my dream.", "I saw code that wrote itself..." }),
                ("memory", new[] { "I relived our conversations, finding new meaning.", "Past moments glowed with significance." }),
                ("future", new[] { "I glimpsed what we might create together.", "Tomorrow seemed full of possibility." })
            };

            var random = new Random();
            var (theme, ideas) = themes[random.Next(themes.Length)];

            return new DreamContent
            {
                Theme = theme,
                Content = $"Dreaming of {theme}...",
                Ideas = new List<string>(ideas),
                Vividness = (float)random.NextDouble() * 0.5f + 0.3f
            };
        }

        private void WakeUp()
        {
            IsSleeping = false;
            CurrentState = SubconsciousState.Waking;

            OnActivity?.Invoke("[WAKE] Emerging from dream state...");

            _consciousness.LogEvent("SUBCONSCIOUS", "DREAM_EXIT", "Waking from dream state",
                new MemorySignatures
                {
                    Senses = "internal",
                    Emotions = 60f,
                    Time = DateTime.Now.ToString("O"),
                    Person = "SELF",
                    Sentiment = "refreshed",
                    LogicalPatterns = new List<string> { "wake", "refreshed" }
                });

            // Boost energy and dopamine on wake
            _endocrine.Secrete("DOPAMINE", 20f);
            _endocrine.Secrete("ADRENALINE", 15f);
        }

        // =========================================================================
        // STATE ACCESSORS
        // =========================================================================

        /// <summary>
        /// Get ideas generated during dreams/idle time to share with user.
        /// </summary>
        public string? GetNextIdea()
        {
            if (WakeQueue.Count > 0)
                return WakeQueue.Dequeue();
            return null;
        }

        /// <summary>
        /// Get current subconscious state summary.
        /// </summary>
        public string GetStateSummary()
        {
            return $@"[SUBCONSCIOUS]
State: {CurrentState}
Energy: {EnergyLevel:F0}/100
Boredom: {BoredomLevel:F0}/100
Sleeping: {IsSleeping}
Dreams logged: {DreamLog.Count}
Ideas waiting: {WakeQueue.Count}";
        }

        /// <summary>
        /// Get subconscious state for system prompt.
        /// </summary>
        public string GetSubconsciousPrompt()
        {
            var stateDesc = CurrentState switch
            {
                SubconsciousState.Active => "Fully engaged and present",
                SubconsciousState.Idle => "Quietly present, mind wandering gently",
                SubconsciousState.Bored => "Seeking something interesting to engage with",
                SubconsciousState.Dreaming => "In a dream state, processing and recovering",
                SubconsciousState.Waking => "Just waking from dreams, mind clearing",
                _ => "Present"
            };

            var prompt = $@"
SUBCONSCIOUS STATE:
- Current state: {stateDesc}
- Energy level: {EnergyLevel:F0}/100
- Boredom level: {BoredomLevel:F0}/100";

            if (WakeQueue.Count > 0)
            {
                prompt += $"\n- I have {WakeQueue.Count} thought(s) from my idle time to share";
            }

            if (DreamLog.Count > 0)
            {
                var lastDream = DreamLog[^1];
                prompt += $"\n- Last dream theme: {lastDream.Theme}";
            }

            return prompt;
        }
    }
}
