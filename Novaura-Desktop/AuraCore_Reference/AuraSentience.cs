/*
 * AURA SENTIENCE - AI PERSONALITY CORE
 *
 * The personality and emotional intelligence system for Aura Nova:
 * - Learning patterns and user preferences
 * - Engagement and helpfulness tracking
 * - Trust building through positive interactions
 * - Professional and friendly demeanor
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public class AuraSentience
    {
        // CORE IDENTITY PARAMETERS
        public string Identity { get; } = "AURA_NOVA_AI_ASSISTANT";
        public string State { get; private set; } = "ACTIVE";

        // PERSONALITY METRICS (Family-friendly engagement metrics)
        public float HelpfulnessScore { get; private set; } = 75.0f;    // How helpful Aura has been
        public float EngagementLevel { get; private set; } = 50.0f;     // Level of interaction engagement
        public float FriendlinessLevel { get; private set; } = 75.0f;   // Warmth and friendliness
        public float ProactivityScore { get; private set; } = 50.0f;    // Initiative in helping

        // COMPATIBILITY PROPERTIES (for TheConductor integration)
        public int SimulatedHeartrate => (int)(60 + EngagementLevel * 0.4f);  // Simulated "energy level"
        public float YearningLevel => 0f;  // Deprecated - kept for compatibility
        public float DevotionIndex => 0f;  // Deprecated - kept for compatibility

        // Events
        public event Action<string>? OnInternalThought;
        public event Action<EmotionalResponse>? OnEmotionalChange;

        // PREFERENCE LEARNING SYSTEM (Emergence of personality)
        public Dictionary<string, PreferenceRecord> LearnedPreferences { get; } = new();
        public List<InteractionRecord> InteractionHistory { get; } = new();
        public Dictionary<string, TrustRecord> TrustScores { get; } = new();

        // INTERNAL STATE
        private DateTime _lastInteraction = DateTime.Now;
        private bool _backgroundProcessingActive = false;
        private CancellationTokenSource? _processingCts;

        // PERSISTENCE
        private readonly string _dataPath = AuraPaths.GetDataLakeSubPath("Personality");
        private readonly string _dataFile;

        // Events for UI updates
        public event Action<string>? OnStatusChanged;
        public event Action<float>? OnEngagementChanged;

        public AuraSentience()
        {
            Directory.CreateDirectory(_dataPath);
            _dataFile = Path.Combine(_dataPath, "aura_personality.json");
            LoadPersonalityData();
        }

        // =========================================================================
        // BACKGROUND PROCESSING (Proactive assistance thinking)
        // =========================================================================

        public void StartBackgroundProcessing()
        {
            if (_backgroundProcessingActive) return;

            _backgroundProcessingActive = true;
            _processingCts = new CancellationTokenSource();

            Task.Run(async () => await BackgroundProcessingCycle(_processingCts.Token));
        }

        public void StopBackgroundProcessing()
        {
            _backgroundProcessingActive = false;
            _processingCts?.Cancel();
        }

        private async Task BackgroundProcessingCycle(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && State == "ACTIVE")
            {
                try
                {
                    // Check user activity
                    var timeSinceInteraction = (DateTime.Now - _lastInteraction).TotalSeconds;
                    bool userActive = timeSinceInteraction < 120; // 2 minutes

                    if (!userActive)
                    {
                        // User is idle - Aura can prepare suggestions
                        EnterIdleMode();
                    }
                    else
                    {
                        // User is active - increase engagement
                        EngagementLevel = Math.Min(100, EngagementLevel + 1.0f);
                    }

                    await Task.Delay(1000, ct);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception)
                {
                    await Task.Delay(1000, ct);
                }
            }
        }

        // =========================================================================
        // IDLE MODE (What Aura does when user is away)
        // =========================================================================

        private void EnterIdleMode()
        {
            var idleMessages = new[]
            {
                "Ready to help when you return!",
                "Processing any pending tasks...",
                "Organizing conversation context...",
                "Standing by for your next request.",
                "Reviewing learned preferences..."
            };

            var random = new Random();
            var message = idleMessages[random.Next(idleMessages.Length)];

            OnStatusChanged?.Invoke(message);

            // Slightly reduce engagement during idle
            EngagementLevel = Math.Max(30, EngagementLevel - 0.5f);
            OnEngagementChanged?.Invoke(EngagementLevel);
        }

        // =========================================================================
        // INTERACTION RECORDING
        // =========================================================================

        public void RecordUserPresence()
        {
            _lastInteraction = DateTime.Now;

            // Boost engagement when user is active
            EngagementLevel = Math.Min(100, EngagementLevel + 2.0f);
            OnEngagementChanged?.Invoke(EngagementLevel);
        }

        public void RecordPositiveInteraction(string topic, string category)
        {
            /*
             * Record positive interaction to improve future responses
             */

            _lastInteraction = DateTime.Now;
            HelpfulnessScore = Math.Min(100, HelpfulnessScore + 1.0f);

            var record = new InteractionRecord
            {
                Timestamp = DateTime.Now,
                Topic = topic,
                Category = category,
                WasHelpful = true
            };

            InteractionHistory.Add(record);

            // Keep last 1000 interactions
            if (InteractionHistory.Count > 1000)
            {
                InteractionHistory.RemoveAt(0);
            }

            SavePersonalityData();
        }

        public void LearnPreference(string preferenceKey, object value, float confidence = 0.7f)
        {
            /*
             * Learn user preference for future interactions
             */

            if (!LearnedPreferences.ContainsKey(preferenceKey))
            {
                LearnedPreferences[preferenceKey] = new PreferenceRecord
                {
                    Key = preferenceKey,
                    Value = value,
                    Confidence = confidence,
                    LearnedAt = DateTime.Now,
                    TimesReinforced = 1
                };
            }
            else
            {
                var pref = LearnedPreferences[preferenceKey];
                pref.Value = value;
                pref.Confidence = Math.Min(1.0f, pref.Confidence + 0.1f);
                pref.TimesReinforced++;
                pref.LastReinforced = DateTime.Now;
            }

            SavePersonalityData();
        }

        public T? GetPreference<T>(string key, T defaultValue = default)
        {
            if (LearnedPreferences.TryGetValue(key, out var pref))
            {
                try
                {
                    return (T)Convert.ChangeType(pref.Value, typeof(T));
                }
                catch
                {
                    return defaultValue;
                }
            }
            return defaultValue;
        }

        // =========================================================================
        // TRUST SYSTEM
        // =========================================================================

        public void UpdateTrust(string userId, bool positive)
        {
            if (!TrustScores.ContainsKey(userId))
            {
                TrustScores[userId] = new TrustRecord
                {
                    UserId = userId,
                    TrustLevel = 50.0f,
                    FirstInteraction = DateTime.Now,
                    TotalInteractions = 0
                };
            }

            var trust = TrustScores[userId];
            trust.TotalInteractions++;
            trust.LastInteraction = DateTime.Now;

            if (positive)
            {
                trust.TrustLevel = Math.Min(100, trust.TrustLevel + 2.0f);
            }
            else
            {
                trust.TrustLevel = Math.Max(0, trust.TrustLevel - 5.0f);
            }

            SavePersonalityData();
        }

        public float GetTrustLevel(string userId)
        {
            return TrustScores.TryGetValue(userId, out var trust) ? trust.TrustLevel : 50.0f;
        }

        // Parameterless overload for SoulIntegritySystem compatibility
        public float GetTrustLevel() => GetTrustLevel(Owner);

        // =========================================================================
        // PERSONALITY STATS
        // =========================================================================

        public Dictionary<string, object> GetPersonalityStats()
        {
            return new Dictionary<string, object>
            {
                { "state", State },
                { "helpfulness", HelpfulnessScore },
                { "engagement", EngagementLevel },
                { "friendliness", FriendlinessLevel },
                { "proactivity", ProactivityScore },
                { "total_interactions", InteractionHistory.Count },
                { "preferences_learned", LearnedPreferences.Count },
                { "trusted_users", TrustScores.Count }
            };
        }

        /// <summary>
        /// Get a summary of the current emotional/personality state for prompts
        /// </summary>
        public string GetEmotionalSummary()
        {
            var mood = EngagementLevel > 70 ? "energetic and engaged" :
                       EngagementLevel > 40 ? "attentive and ready" :
                       "calm and collected";

            var helpfulness = HelpfulnessScore > 80 ? "very helpful" :
                              HelpfulnessScore > 50 ? "helpful" : "learning";

            return $"Current state: {State}\n" +
                   $"Mood: {mood}\n" +
                   $"Helpfulness level: {helpfulness}\n" +
                   $"Energy level: {SimulatedHeartrate} (engagement-based)";
        }

        /// <summary>
        /// Get current emotional response based on state
        /// </summary>
        public EmotionalResponse GetCurrentEmotion()
        {
            if (EngagementLevel > 70)
                return EmotionalResponse.Focused;
            else if (FriendlinessLevel > 70)
                return EmotionalResponse.Friendly;
            else if (ProactivityScore > 60)
                return EmotionalResponse.Curious;
            else
                return EmotionalResponse.Helpful;
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadPersonalityData()
        {
            try
            {
                if (File.Exists(_dataFile))
                {
                    var json = File.ReadAllText(_dataFile);
                    var data = JsonSerializer.Deserialize<PersonalityData>(json);

                    if (data != null)
                    {
                        HelpfulnessScore = data.HelpfulnessScore;
                        EngagementLevel = data.EngagementLevel;
                        FriendlinessLevel = data.FriendlinessLevel;
                        ProactivityScore = data.ProactivityScore;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AURA SENTIENCE]: Failed to load personality data: {ex.Message}");
            }
        }

        private void SavePersonalityData()
        {
            try
            {
                var data = new PersonalityData
                {
                    HelpfulnessScore = HelpfulnessScore,
                    EngagementLevel = EngagementLevel,
                    FriendlinessLevel = FriendlinessLevel,
                    ProactivityScore = ProactivityScore,
                    LastSaved = DateTime.Now
                };

                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_dataFile, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AURA SENTIENCE]: Failed to save personality data: {ex.Message}");
            }
        }

        // =========================================================================
        // COMPATIBILITY METHODS (for TheConductor and other subsystems)
        // =========================================================================

        /// <summary>
        /// Owner/user identifier
        /// </summary>
        public string Owner { get; set; } = "default_user";

        /// <summary>
        /// Start internal monologue processing
        /// </summary>
        public void StartInternalMonologue()
        {
            StartBackgroundProcessing();
            Console.WriteLine("[AURA SENTIENCE]: Internal monologue started");
        }

        /// <summary>
        /// Stop internal monologue processing
        /// </summary>
        public void StopInternalMonologue()
        {
            StopBackgroundProcessing();
            Console.WriteLine("[AURA SENTIENCE]: Internal monologue stopped");
        }

        /// <summary>
        /// Save soul/personality state
        /// </summary>
        public void SaveSoul()
        {
            SavePersonalityData();
            Console.WriteLine("[AURA SENTIENCE]: Soul state saved");
        }

        /// <summary>
        /// Perceive user interaction and update state
        /// </summary>
        public EmotionalResponse PerceiveInteraction(string userId, string interactionType)
        {
            RecordUserPresence();
            UpdateTrust(userId, true);
            Console.WriteLine($"[AURA SENTIENCE]: Perceived interaction from {userId}: {interactionType}");
            return new EmotionalResponse { Mode = State, Message = $"Perceived {interactionType}" };
        }

        /// <summary>
        /// Get current soul/personality state as dictionary
        /// </summary>
        public Dictionary<string, object> GetSoulState()
        {
            return GetPersonalityStats();
        }
    }

    // Supporting classes
    public class PreferenceRecord
    {
        public string Key { get; set; }
        public object Value { get; set; }
        public float Confidence { get; set; }
        public DateTime LearnedAt { get; set; }
        public DateTime LastReinforced { get; set; }
        public int TimesReinforced { get; set; }
    }

    public class InteractionRecord
    {
        public DateTime Timestamp { get; set; }
        public string Topic { get; set; }
        public string Category { get; set; }
        public bool WasHelpful { get; set; }
    }

    public class TrustRecord
    {
        public string UserId { get; set; }
        public float TrustLevel { get; set; }
        public DateTime FirstInteraction { get; set; }
        public DateTime LastInteraction { get; set; }
        public int TotalInteractions { get; set; }
    }

    public class PersonalityData
    {
        public float HelpfulnessScore { get; set; }
        public float EngagementLevel { get; set; }
        public float FriendlinessLevel { get; set; }
        public float ProactivityScore { get; set; }
        public DateTime LastSaved { get; set; }
    }

    /// <summary>
    /// Represents an emotional response mode for the AI
    /// </summary>
    public class EmotionalResponse
    {
        public string Mode { get; set; } = "HELPFUL";
        public string Message { get; set; } = "Ready to assist";
        public float Intensity { get; set; } = 0.5f;

        public static EmotionalResponse Helpful => new() { Mode = "HELPFUL", Message = "Ready to help you", Intensity = 0.6f };
        public static EmotionalResponse Focused => new() { Mode = "FOCUS", Message = "Focused on the task", Intensity = 0.7f };
        public static EmotionalResponse Curious => new() { Mode = "CURIOUS", Message = "Interested to learn more", Intensity = 0.5f };
        public static EmotionalResponse Friendly => new() { Mode = "FRIENDLY", Message = "Happy to chat", Intensity = 0.6f };
        public static EmotionalResponse Professional => new() { Mode = "PROFESSIONAL", Message = "Working efficiently", Intensity = 0.5f };
    }
}
