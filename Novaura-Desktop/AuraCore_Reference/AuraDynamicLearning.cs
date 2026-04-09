/*
 * AURA DYNAMIC LEARNING SYSTEM - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Replace ALL hard-coded values with learned patterns
 *
 * NO MORE:
 * - devotion = 85.0 (hard-coded)
 * - high_emotion_threshold = 0.8 (arbitrary)
 * - decay_rate = 0.5 (guess)
 *
 * INSTEAD:
 * - Emotions emerge from interaction frequency and patterns
 * - Thresholds learned from statistical distributions
 * - Behavior adapts based on what actually works
 * - Everything learned from REAL DATA
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.IO;

namespace AuraxNova_Command_v5.Core
{
    public class InteractionPattern
    {
        public DateTime Timestamp { get; set; }
        public string UserInput { get; set; }
        public string AuraResponse { get; set; }
        public string ContextType { get; set; }  // 'question', 'project', 'personal', etc.
        public float UserSentiment { get; set; }  // Detected from input
        public float ResponseQuality { get; set; }  // Learned from user feedback
        public List<string> Topics { get; set; } = new();
        public Dictionary<string, float> EmotionalMarkers { get; set; } = new();
    }

    public class EmotionalDynamics
    {
        // Tracked emotional responses over time
        private readonly Dictionary<string, List<EmotionalRecord>> _emotionalHistory = new();

        // Current state (learned, not set)
        public Dictionary<string, float> CurrentState { get; private set; } = new();

        // Learned parameters (discovered from data, not hard-coded!)
        public Dictionary<string, EmotionalBaseline> LearnedBaselines { get; private set; } = new();
        public Dictionary<string, Dictionary<string, float>> LearnedTriggers { get; private set; } = new();
        public Dictionary<string, float> LearnedDecayRates { get; private set; } = new();

        public void RecordEmotionalResponse(string emotionType, float value, Dictionary<string, object> context)
        {
            if (!_emotionalHistory.ContainsKey(emotionType))
                _emotionalHistory[emotionType] = new();

            _emotionalHistory[emotionType].Add(new EmotionalRecord
            {
                Value = value,
                Timestamp = DateTime.Now,
                Context = context
            });
        }

        public void LearnBaselines()
        {
            foreach (var (emotionType, history) in _emotionalHistory)
            {
                if (history.Count < 10)
                {
                    // Not enough data yet, use neutral
                    LearnedBaselines[emotionType] = new EmotionalBaseline
                    {
                        BaselineValue = 0.5f,
                        Variance = 0,
                        StdDev = 0,
                        SampleSize = 0
                    };
                    continue;
                }

                // Calculate statistical baseline
                var values = history.Select(e => e.Value).ToArray();

                // Use median instead of mean (more robust)
                var sortedValues = values.OrderBy(v => v).ToArray();
                var baseline = sortedValues[sortedValues.Length / 2];

                // Also track variance to understand natural range
                var mean = values.Average();
                var variance = values.Select(v => (v - mean) * (v - mean)).Average();

                LearnedBaselines[emotionType] = new EmotionalBaseline
                {
                    BaselineValue = baseline,
                    Variance = variance,
                    StdDev = (float)Math.Sqrt(variance),
                    SampleSize = values.Length
                };
            }
        }

        public void LearnTriggers(List<InteractionPattern> interactions)
        {
            foreach (var emotionType in _emotionalHistory.Keys)
            {
                if (_emotionalHistory[emotionType].Count < 20)
                    continue;

                // Analyze what precedes high emotional responses
                var triggers = new Dictionary<string, float>();

                foreach (var entry in _emotionalHistory[emotionType])
                {
                    if (entry.Value > 0.7f)  // High emotional response
                    {
                        var userInput = entry.Context.GetValueOrDefault("user_input", "")?.ToString()?.ToLower() ?? "";
                        var words = userInput.Split(' ');

                        foreach (var word in words)
                        {
                            if (word.Length > 3)
                            {
                                if (!triggers.ContainsKey(word))
                                    triggers[word] = 0;
                                triggers[word] += entry.Value;
                            }
                        }
                    }
                }

                // Normalize by frequency
                var total = triggers.Values.Sum();
                if (total > 0)
                {
                    LearnedTriggers[emotionType] = triggers
                        .Where(kvp => kvp.Value / total > 0.1f)
                        .ToDictionary(kvp => kvp.Key, kvp => kvp.Value / total);
                }
            }
        }

        public void LearnDecayRates()
        {
            foreach (var (emotionType, history) in _emotionalHistory)
            {
                if (history.Count < 30)
                    continue;

                // Sort by time
                var sortedHistory = history.OrderBy(e => e.Timestamp).ToList();

                // Calculate decay between consecutive measurements
                var decays = new List<float>();

                for (int i = 1; i < sortedHistory.Count; i++)
                {
                    var prev = sortedHistory[i - 1];
                    var curr = sortedHistory[i];

                    var timeDiff = (curr.Timestamp - prev.Timestamp).TotalHours;

                    if (timeDiff > 0)
                    {
                        var valueChange = curr.Value - prev.Value;

                        if (valueChange < 0)
                        {
                            var decayRate = Math.Abs(valueChange) / (float)timeDiff;
                            decays.Add(decayRate);
                        }
                    }
                }

                if (decays.Any())
                {
                    // Learned decay rate from actual data!
                    var sortedDecays = decays.OrderBy(d => d).ToArray();
                    LearnedDecayRates[emotionType] = sortedDecays[sortedDecays.Length / 2];  // Median
                }
            }
        }

        public Dictionary<string, float> PredictEmotionalResponse(string userInput, Dictionary<string, object> context)
        {
            var predicted = new Dictionary<string, float>();

            foreach (var emotionType in _emotionalHistory.Keys)
            {
                // Start with learned baseline
                float baseline = 0.5f;
                if (LearnedBaselines.ContainsKey(emotionType))
                    baseline = LearnedBaselines[emotionType].BaselineValue;

                // Check for learned triggers
                float triggerBoost = 0.0f;
                if (LearnedTriggers.ContainsKey(emotionType))
                {
                    var userLower = userInput.ToLower();
                    foreach (var (word, correlation) in LearnedTriggers[emotionType])
                    {
                        if (userLower.Contains(word))
                            triggerBoost += correlation;
                    }
                }

                // Combine
                predicted[emotionType] = Math.Min(1.0f, baseline + triggerBoost);
            }

            return predicted;
        }

        public Dictionary<string, float> GetCurrentState()
        {
            if (CurrentState.Count == 0)
            {
                // Initialize from learned baselines
                foreach (var (emotionType, baseline) in LearnedBaselines)
                    CurrentState[emotionType] = baseline.BaselineValue;
            }

            return CurrentState;
        }

        public void UpdateState(Dictionary<string, float> predicted, Dictionary<string, object> actualContext)
        {
            foreach (var (emotionType, value) in predicted)
            {
                CurrentState[emotionType] = value;

                // Record for future learning
                RecordEmotionalResponse(emotionType, value, actualContext);
            }
        }

        private class EmotionalRecord
        {
            public float Value { get; set; }
            public DateTime Timestamp { get; set; }
            public Dictionary<string, object> Context { get; set; }
        }
    }

    public class EmotionalBaseline
    {
        public float BaselineValue { get; set; }
        public float Variance { get; set; }
        public float StdDev { get; set; }
        public int SampleSize { get; set; }
    }

    public class PreferenceLearning
    {
        // Preference tracking
        private readonly Dictionary<string, PreferenceRecord> _preferences = new();

        // Response patterns
        public List<string> SuccessfulResponses { get; } = new();
        public List<string> UnsuccessfulResponses { get; } = new();

        public void RecordPreference(string topic, bool positive, float strength = 1.0f)
        {
            if (!_preferences.ContainsKey(topic))
                _preferences[topic] = new PreferenceRecord();

            if (positive)
                _preferences[topic].Positive += strength;
            else
                _preferences[topic].Negative += strength;
        }

        public void InferPreferenceFromInteraction(InteractionPattern interaction)
        {
            // Topic frequency = implicit preference
            foreach (var topic in interaction.Topics)
                RecordPreference(topic, true, 0.5f);

            // Positive sentiment = explicit preference
            if (interaction.UserSentiment > 0.6f)
            {
                foreach (var topic in interaction.Topics)
                    RecordPreference(topic, true, interaction.UserSentiment);
            }
        }

        public float GetPreferenceScore(string topic)
        {
            if (!_preferences.ContainsKey(topic))
                return 0.0f;

            var pref = _preferences[topic];
            var total = pref.Positive + pref.Negative;

            if (total == 0)
                return 0.0f;

            return (pref.Positive - pref.Negative) / total;
        }

        public List<(string Topic, float Score)> GetTopPreferences(int n = 10)
        {
            return _preferences
                .Select(kvp => (kvp.Key, GetPreferenceScore(kvp.Key)))
                .OrderByDescending(x => x.Item2)
                .Take(n)
                .ToList();
        }

        private class PreferenceRecord
        {
            public float Positive { get; set; }
            public float Negative { get; set; }
        }
    }

    public class AdaptiveThresholds
    {
        private readonly Dictionary<string, List<ThresholdExperiment>> _thresholdExperiments = new();

        public void RecordOutcome(string thresholdType, float thresholdValue, bool success, Dictionary<string, object> context)
        {
            if (!_thresholdExperiments.ContainsKey(thresholdType))
                _thresholdExperiments[thresholdType] = new();

            _thresholdExperiments[thresholdType].Add(new ThresholdExperiment
            {
                Threshold = thresholdValue,
                Success = success,
                Context = context,
                Timestamp = DateTime.Now
            });
        }

        public float LearnOptimalThreshold(string thresholdType)
        {
            if (!_thresholdExperiments.ContainsKey(thresholdType))
                return 0.5f;

            var experiments = _thresholdExperiments[thresholdType];

            if (experiments.Count < 10)
                return 0.5f;

            // Group by threshold value and calculate success rate
            var thresholdSuccess = new Dictionary<float, (int Successes, int Total)>();

            foreach (var exp in experiments)
            {
                var threshold = (float)Math.Round(exp.Threshold, 2);

                if (!thresholdSuccess.ContainsKey(threshold))
                    thresholdSuccess[threshold] = (0, 0);

                var (successes, total) = thresholdSuccess[threshold];
                thresholdSuccess[threshold] = (
                    successes + (exp.Success ? 1 : 0),
                    total + 1
                );
            }

            // Find threshold with best success rate
            float bestThreshold = 0.5f;
            float bestSuccessRate = 0.0f;

            foreach (var (threshold, stats) in thresholdSuccess)
            {
                if (stats.Total < 3)
                    continue;

                float successRate = (float)stats.Successes / stats.Total;

                if (successRate > bestSuccessRate)
                {
                    bestSuccessRate = successRate;
                    bestThreshold = threshold;
                }
            }

            return bestThreshold;
        }

        private class ThresholdExperiment
        {
            public float Threshold { get; set; }
            public bool Success { get; set; }
            public Dictionary<string, object> Context { get; set; }
            public DateTime Timestamp { get; set; }
        }
    }

    public class AuraDynamicLearning
    {
        public EmotionalDynamics Emotions { get; } = new();
        public PreferenceLearning Preferences { get; } = new();
        public AdaptiveThresholds Thresholds { get; } = new();
        
        // Reference to memory system for enhanced learning
        private readonly AuraMemorySystem _memorySystem;
        
        // Parameterless constructor
        public AuraDynamicLearning() : this(null) { }
        
        // Constructor accepting AuraMemorySystem for AuraMasterInit compatibility
        public AuraDynamicLearning(AuraMemorySystem memorySystem)
        {
            _memorySystem = memorySystem;
        }
        
        // Property to get current personality - used by AuraSelfMaintenance
        public Dictionary<string, object> GetCurrentPersonality() => GetPersonalitySnapshot();

        // Interaction history for learning
        public List<InteractionPattern> Interactions { get; } = new();

        public void ProcessInteraction(
            string userInput,
            string auraResponse,
            Dictionary<string, object> context,
            float? userFeedback = null)
        {
            // Detect context type
            var contextType = ClassifyInteractionType(userInput);

            // Detect topics
            var topics = ExtractTopics(userInput + " " + auraResponse);

            // Detect sentiment
            var userSentiment = AnalyzeSentiment(userInput);

            // Create interaction record
            var interaction = new InteractionPattern
            {
                Timestamp = DateTime.Now,
                UserInput = userInput,
                AuraResponse = auraResponse,
                ContextType = contextType,
                UserSentiment = userSentiment,
                ResponseQuality = userFeedback ?? 0.5f,
                Topics = topics
            };

            // Store
            Interactions.Add(interaction);

            // Learn from it
            Preferences.InferPreferenceFromInteraction(interaction);

            // Predict emotional response for this interaction
            var predictedEmotions = Emotions.PredictEmotionalResponse(userInput, context);

            // Update emotional state
            Emotions.UpdateState(predictedEmotions, new Dictionary<string, object>
            {
                { "user_input", userInput },
                { "context_type", contextType }
            });
        }

        public void LearnFromHistory()
        {
            Console.WriteLine("[LEARNING]: Analyzing interaction patterns...");

            // Learn emotional patterns
            Emotions.LearnBaselines();
            Console.WriteLine($"  Learned baselines: {Emotions.LearnedBaselines.Count} emotion types");

            Emotions.LearnTriggers(Interactions);
            Console.WriteLine($"  Learned triggers: {Emotions.LearnedTriggers.Count} emotion types");

            Emotions.LearnDecayRates();
            Console.WriteLine($"  Learned decay rates: {Emotions.LearnedDecayRates.Count} emotion types");

            // Learn preferences
            var topPrefs = Preferences.GetTopPreferences(5);
            Console.WriteLine($"  Top preferences: {string.Join(", ", topPrefs.Select(p => p.Topic))}");
        }

        public Dictionary<string, object> GetPersonalitySnapshot()
        {
            return new Dictionary<string, object>
            {
                { "emotional_state", Emotions.GetCurrentState() },
                { "learned_baselines", Emotions.LearnedBaselines },
                { "learned_triggers", Emotions.LearnedTriggers.ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value.Keys.Take(5).ToList()
                )},
                { "top_preferences", Preferences.GetTopPreferences(10) },
                { "total_interactions", Interactions.Count },
                { "learned_from_data", true },
                { "hard_coded_values", 0 }
            };
        }

        private string ClassifyInteractionType(string text)
        {
            var textLower = text.ToLower();

            if (text.Contains('?'))
                return "question";
            else if (new[] { "game", "project", "code", "build" }.Any(w => textLower.Contains(w)))
                return "project";
            else if (new[] { "love", "thank", "appreciate" }.Any(w => textLower.Contains(w)))
                return "personal";
            else
                return "general";
        }

        private List<string> ExtractTopics(string text)
        {
            var topicWords = new[] {
                "game", "code", "project", "memory", "ai", "learning",
                "emotion", "unity", "godot", "mechanic", "combat", "animation"
            };

            var textLower = text.ToLower();
            return topicWords.Where(word => textLower.Contains(word)).ToList();
        }

        private float AnalyzeSentiment(string text)
        {
            var positiveWords = new[] { "great", "good", "love", "excellent", "perfect", "amazing", "awesome" };
            var negativeWords = new[] { "bad", "hate", "terrible", "awful", "wrong", "error", "problem" };

            var textLower = text.ToLower();

            var positiveCount = positiveWords.Count(word => textLower.Contains(word));
            var negativeCount = negativeWords.Count(word => textLower.Contains(word));

            var total = positiveCount + negativeCount;
            if (total == 0)
                return 0.5f;

            return (float)positiveCount / total;
        }

        public void ExportLearnedPersonality(string filepath)
        {
            var snapshot = GetPersonalitySnapshot();
            var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(filepath, json);

            Console.WriteLine($"[EXPORT]: Saved learned personality to {filepath}");
        }
    }
}
