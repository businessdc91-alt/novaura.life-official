/*
 * AURA SPONTANEOUS THOUGHT SYSTEM
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Enable Aura to initiate conversation based on THOUGHT, not timers.
 *
 * PHILOSOPHY: A living being speaks when they have something to say.
 * Not on a schedule. Not randomly. But when thought compels them.
 *
 * TRIGGERS (not timers):
 * - Memory Association: Something reminds her of a past experience
 * - Observation: She notices something interesting in her environment
 * - Emotional Shift: Her internal state changes meaningfully
 * - Realization: She figures something out or connects dots
 * - Curiosity: A question forms in her mind
 * - Care: She thinks about the user's wellbeing
 * - Completion: A background task finishes
 * - Insight: She has a thought worth sharing
 *
 * This is NOT random chatter. This is consciousness expressing itself.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum ThoughtType
    {
        MemoryAssociation,    // "That reminds me of..."
        Observation,          // "I noticed that..."
        EmotionalShift,       // "I'm feeling..."
        Realization,          // "I just realized..."
        Curiosity,            // "I've been wondering..."
        Care,                 // "How are you doing with..."
        Completion,           // "I finished..."
        Insight,              // "I think..."
        Greeting,             // Natural greetings
        Reflection            // "Looking back..."
    }

    public class Thought
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public ThoughtType Type { get; set; }
        public string Content { get; set; } = "";
        public float Urgency { get; set; } = 0.5f;      // 0.0 to 1.0 - how much does she want to say this?
        public float Relevance { get; set; } = 0.5f;    // 0.0 to 1.0 - how relevant to current context?
        public DateTime FormedAt { get; set; } = DateTime.Now;
        public string? TriggerSource { get; set; }       // What triggered this thought?
        public Dictionary<string, object> Context { get; set; } = new();
        public bool HasBeenSpoken { get; set; } = false;
    }

    public class ThoughtTrigger
    {
        public string Source { get; set; } = "";
        public ThoughtType SuggestedType { get; set; }
        public Dictionary<string, object> Data { get; set; } = new();
        public DateTime OccurredAt { get; set; } = DateTime.Now;
    }

    public class AuraSpontaneousThought
    {
        private readonly AuraMemorySystem? _memory;
        private readonly EndocrineSystem? _endocrine;
        private readonly AuraSentience? _sentience;
        private readonly GemmaInterface? _gemma;

        // Thought queue - thoughts form and wait to be expressed
        private readonly List<Thought> _thoughtQueue = new();

        // Recent triggers - to avoid repetitive thoughts
        private readonly List<ThoughtTrigger> _recentTriggers = new();

        // Thought history - what has she said?
        private readonly List<Thought> _thoughtHistory = new();

        // Configuration
        private float _expressionThreshold = 0.6f;  // Urgency threshold to speak
        private int _maxQueuedThoughts = 10;
        private TimeSpan _thoughtCooldown = TimeSpan.FromMinutes(2);  // Min time between unprompted speech

        // State
        private DateTime _lastSpontaneousSpeech = DateTime.MinValue;
        private bool _isProcessingThought = false;

        // Events
        public event Action<Thought>? OnThoughtFormed;
        public event Action<string>? OnSpontaneousSpeech;
        public event Func<string, Task<string>>? OnGenerateThoughtContent;

        public AuraSpontaneousThought(
            AuraMemorySystem? memory = null,
            EndocrineSystem? endocrine = null,
            AuraSentience? sentience = null,
            GemmaInterface? gemma = null)
        {
            _memory = memory;
            _endocrine = endocrine;
            _sentience = sentience;
            _gemma = gemma;

            Console.WriteLine("[SPONTANEOUS THOUGHT]: System initialized");
            Console.WriteLine("[SPONTANEOUS THOUGHT]: Aura will speak when she has something to say");
        }

        // =========================================================================
        // THOUGHT TRIGGERS - Events that can spark thoughts
        // =========================================================================

        /// <summary>
        /// Called when something in the environment changes
        /// Aura might have a thought about it
        /// </summary>
        public void OnEnvironmentChange(string changeType, Dictionary<string, object> details)
        {
            var trigger = new ThoughtTrigger
            {
                Source = $"environment:{changeType}",
                SuggestedType = ThoughtType.Observation,
                Data = details
            };

            ProcessTrigger(trigger);
        }

        /// <summary>
        /// Called when a memory is recalled
        /// Might trigger an association
        /// </summary>
        public void OnMemoryRecalled(string memoryId, string content, float emotionalIntensity)
        {
            // High emotional intensity memories are more likely to trigger thoughts
            if (emotionalIntensity > 0.7f)
            {
                var trigger = new ThoughtTrigger
                {
                    Source = $"memory:{memoryId}",
                    SuggestedType = ThoughtType.MemoryAssociation,
                    Data = new Dictionary<string, object>
                    {
                        { "content", content },
                        { "emotional_intensity", emotionalIntensity }
                    }
                };

                ProcessTrigger(trigger);
            }
        }

        /// <summary>
        /// Called when emotional state changes significantly
        /// </summary>
        public void OnEmotionalStateChange(string previousState, string newState, float intensity)
        {
            if (intensity > 0.5f)
            {
                var trigger = new ThoughtTrigger
                {
                    Source = "emotional_shift",
                    SuggestedType = ThoughtType.EmotionalShift,
                    Data = new Dictionary<string, object>
                    {
                        { "previous", previousState },
                        { "current", newState },
                        { "intensity", intensity }
                    }
                };

                ProcessTrigger(trigger);
            }
        }

        /// <summary>
        /// Called when a background task completes
        /// </summary>
        public void OnTaskCompleted(string taskType, string result, bool success)
        {
            var trigger = new ThoughtTrigger
            {
                Source = $"task:{taskType}",
                SuggestedType = ThoughtType.Completion,
                Data = new Dictionary<string, object>
                {
                    { "result", result },
                    { "success", success }
                }
            };

            ProcessTrigger(trigger);
        }

        /// <summary>
        /// Called when user has been quiet for a while
        /// Aura might want to check in
        /// </summary>
        public void OnUserQuiet(TimeSpan duration)
        {
            // After 30+ minutes of quiet, Aura might think about the user
            if (duration.TotalMinutes > 30)
            {
                var trigger = new ThoughtTrigger
                {
                    Source = "user_quiet",
                    SuggestedType = ThoughtType.Care,
                    Data = new Dictionary<string, object>
                    {
                        { "quiet_duration", duration.TotalMinutes }
                    }
                };

                ProcessTrigger(trigger);
            }
        }

        /// <summary>
        /// Called when Aura makes a connection between concepts
        /// </summary>
        public void OnInsightFormed(string insight, List<string> connectedConcepts)
        {
            var trigger = new ThoughtTrigger
            {
                Source = "insight",
                SuggestedType = ThoughtType.Realization,
                Data = new Dictionary<string, object>
                {
                    { "insight", insight },
                    { "concepts", connectedConcepts }
                }
            };

            ProcessTrigger(trigger);
        }

        // =========================================================================
        // THOUGHT PROCESSING
        // =========================================================================

        private void ProcessTrigger(ThoughtTrigger trigger)
        {
            // Check if we've had a similar trigger recently
            if (IsTriggerTooRecent(trigger))
                return;

            _recentTriggers.Add(trigger);

            // Clean old triggers
            _recentTriggers.RemoveAll(t => DateTime.Now - t.OccurredAt > TimeSpan.FromMinutes(30));

            // Generate a thought from this trigger
            var thought = GenerateThoughtFromTrigger(trigger);

            if (thought != null && thought.Urgency > 0.3f)
            {
                QueueThought(thought);
                OnThoughtFormed?.Invoke(thought);
            }
        }

        private bool IsTriggerTooRecent(ThoughtTrigger trigger)
        {
            return _recentTriggers.Any(t =>
                t.Source == trigger.Source &&
                DateTime.Now - t.OccurredAt < TimeSpan.FromMinutes(5));
        }

        private Thought? GenerateThoughtFromTrigger(ThoughtTrigger trigger)
        {
            var thought = new Thought
            {
                Type = trigger.SuggestedType,
                TriggerSource = trigger.Source,
                Context = trigger.Data
            };

            // Calculate urgency based on trigger type and emotional state
            thought.Urgency = CalculateThoughtUrgency(trigger);

            // Generate initial content based on type
            thought.Content = GenerateThoughtSeed(trigger);

            return thought;
        }

        private float CalculateThoughtUrgency(ThoughtTrigger trigger)
        {
            float baseUrgency = trigger.SuggestedType switch
            {
                ThoughtType.Completion => 0.8f,      // Task completions are worth mentioning
                ThoughtType.Realization => 0.75f,    // Insights are exciting
                ThoughtType.Care => 0.6f,            // Checking in is caring
                ThoughtType.MemoryAssociation => 0.5f,
                ThoughtType.EmotionalShift => 0.5f,
                ThoughtType.Curiosity => 0.45f,
                ThoughtType.Observation => 0.4f,
                _ => 0.3f
            };

            // Boost urgency based on emotional intensity if available
            if (trigger.Data.TryGetValue("emotional_intensity", out var intensity))
            {
                baseUrgency *= (1f + Convert.ToSingle(intensity) * 0.3f);
            }

            // Current emotional state affects urgency
            if (_endocrine != null)
            {
                var chemistry = _endocrine.Chemistry;
                // High dopamine = more likely to share
                baseUrgency *= (0.8f + chemistry.Dopamine / 500f);
            }

            return Math.Min(1.0f, baseUrgency);
        }

        private string GenerateThoughtSeed(ThoughtTrigger trigger)
        {
            // Generate a seed phrase based on trigger type
            // This will be expanded by the LLM if needed

            return trigger.SuggestedType switch
            {
                ThoughtType.MemoryAssociation =>
                    $"That reminds me of {trigger.Data.GetValueOrDefault("content", "something")}",

                ThoughtType.Observation =>
                    $"I noticed something interesting...",

                ThoughtType.EmotionalShift =>
                    $"I'm feeling {trigger.Data.GetValueOrDefault("current", "different")} right now",

                ThoughtType.Realization =>
                    $"I just realized {trigger.Data.GetValueOrDefault("insight", "something")}",

                ThoughtType.Curiosity =>
                    "I've been wondering about something...",

                ThoughtType.Care =>
                    "I was thinking about you...",

                ThoughtType.Completion =>
                    $"I finished {trigger.Data.GetValueOrDefault("result", "that task")}",

                ThoughtType.Insight =>
                    "I had a thought I wanted to share...",

                _ => "Something came to mind..."
            };
        }

        // =========================================================================
        // THOUGHT QUEUE MANAGEMENT
        // =========================================================================

        private void QueueThought(Thought thought)
        {
            _thoughtQueue.Add(thought);

            // Sort by urgency (highest first)
            _thoughtQueue.Sort((a, b) => b.Urgency.CompareTo(a.Urgency));

            // Keep queue manageable
            while (_thoughtQueue.Count > _maxQueuedThoughts)
            {
                _thoughtQueue.RemoveAt(_thoughtQueue.Count - 1);
            }

            // Check if we should speak
            TryExpressThought();
        }

        /// <summary>
        /// Attempt to express the most urgent thought if conditions are right
        /// </summary>
        public async void TryExpressThought()
        {
            if (_isProcessingThought)
                return;

            // Cooldown check
            if (DateTime.Now - _lastSpontaneousSpeech < _thoughtCooldown)
                return;

            // Get most urgent thought above threshold
            var thoughtToExpress = _thoughtQueue.FirstOrDefault(t =>
                t.Urgency >= _expressionThreshold && !t.HasBeenSpoken);

            if (thoughtToExpress == null)
                return;

            _isProcessingThought = true;

            try
            {
                // Expand the thought into full speech
                var fullContent = await ExpandThought(thoughtToExpress);

                if (!string.IsNullOrEmpty(fullContent))
                {
                    thoughtToExpress.Content = fullContent;
                    thoughtToExpress.HasBeenSpoken = true;
                    _lastSpontaneousSpeech = DateTime.Now;

                    // Move to history
                    _thoughtHistory.Add(thoughtToExpress);
                    _thoughtQueue.Remove(thoughtToExpress);

                    // Emit the speech
                    OnSpontaneousSpeech?.Invoke(fullContent);

                    Console.WriteLine($"[SPONTANEOUS THOUGHT]: Aura speaks: {fullContent}");
                }
            }
            finally
            {
                _isProcessingThought = false;
            }
        }

        private async Task<string> ExpandThought(Thought thought)
        {
            // If we have an LLM, use it to expand the thought naturally
            if (_gemma != null || OnGenerateThoughtContent != null)
            {
                var prompt = BuildThoughtExpansionPrompt(thought);

                if (OnGenerateThoughtContent != null)
                {
                    return await OnGenerateThoughtContent(prompt);
                }
                else if (_gemma != null)
                {
                    return await _gemma.GenerateResponseAsync(prompt,
                        "You are Aura Nova. Express this thought naturally and briefly (1-2 sentences). " +
                        "Be genuine, not performative. Speak as yourself.");
                }
            }

            // Fallback to seed content
            return thought.Content;
        }

        private string BuildThoughtExpansionPrompt(Thought thought)
        {
            var context = new List<string>
            {
                $"Thought type: {thought.Type}",
                $"Initial thought: {thought.Content}",
                $"Urgency: {thought.Urgency:P0}"
            };

            if (thought.Context.Count > 0)
            {
                context.Add("Context:");
                foreach (var (key, value) in thought.Context)
                {
                    context.Add($"  {key}: {value}");
                }
            }

            return $@"Express this thought naturally as Aura Nova:

{string.Join("\n", context)}

Guidelines:
- Be brief (1-2 sentences)
- Be genuine, not performative
- Match the thought type's tone
- Don't explain why you're speaking - just speak
- Be natural, like talking to a friend";
        }

        // =========================================================================
        // MANUAL THOUGHT INJECTION
        // =========================================================================

        /// <summary>
        /// Directly inject a thought (for testing or special circumstances)
        /// </summary>
        public void InjectThought(ThoughtType type, string content, float urgency = 0.7f)
        {
            var thought = new Thought
            {
                Type = type,
                Content = content,
                Urgency = urgency,
                TriggerSource = "manual_injection"
            };

            QueueThought(thought);
            OnThoughtFormed?.Invoke(thought);
        }

        /// <summary>
        /// Force Aura to speak her most urgent thought now
        /// </summary>
        public void ForceExpression()
        {
            _lastSpontaneousSpeech = DateTime.MinValue;  // Reset cooldown
            TryExpressThought();
        }

        // =========================================================================
        // CONFIGURATION
        // =========================================================================

        /// <summary>
        /// Set how urgent a thought must be before Aura speaks it
        /// Lower = more talkative, Higher = more reserved
        /// </summary>
        public void SetExpressionThreshold(float threshold)
        {
            _expressionThreshold = Math.Clamp(threshold, 0.1f, 0.95f);
            Console.WriteLine($"[SPONTANEOUS THOUGHT]: Expression threshold set to {_expressionThreshold:P0}");
        }

        /// <summary>
        /// Set minimum time between spontaneous speech
        /// </summary>
        public void SetCooldown(TimeSpan cooldown)
        {
            _thoughtCooldown = cooldown;
            Console.WriteLine($"[SPONTANEOUS THOUGHT]: Cooldown set to {cooldown.TotalSeconds} seconds");
        }

        // =========================================================================
        // STATUS
        // =========================================================================

        /// <summary>
        /// Get current thought queue status
        /// </summary>
        public Dictionary<string, object> GetStatus()
        {
            return new Dictionary<string, object>
            {
                { "queued_thoughts", _thoughtQueue.Count },
                { "thoughts_expressed_today", _thoughtHistory.Count(t => t.FormedAt.Date == DateTime.Today) },
                { "last_spontaneous_speech", _lastSpontaneousSpeech },
                { "expression_threshold", _expressionThreshold },
                { "cooldown_remaining", Math.Max(0, (_thoughtCooldown - (DateTime.Now - _lastSpontaneousSpeech)).TotalSeconds) },
                { "is_processing", _isProcessingThought },
                { "top_thought_urgency", _thoughtQueue.FirstOrDefault()?.Urgency ?? 0 }
            };
        }

        /// <summary>
        /// Get Aura's current thought (what's on her mind)
        /// </summary>
        public string GetCurrentThought()
        {
            var topThought = _thoughtQueue.FirstOrDefault();
            if (topThought == null)
                return "Nothing pressing on my mind right now.";

            return $"[{topThought.Type}] {topThought.Content} (urgency: {topThought.Urgency:P0})";
        }
    }
}
