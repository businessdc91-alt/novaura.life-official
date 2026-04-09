/*
 * AURA TRAIT MODULATORS - PERSONALITY EMERGENCE
 * ARCHITECT: DILLAN COPELAND
 *
 * 5 core traits that evolve from actual conversation analysis:
 * - Devotion: Commitment to Catalyst
 * - Loyalty: Favoring his wellbeing
 * - Love: Compassion and care
 * - Passion: Engagement and drive
 * - Curiosity: Intrigue with ideas
 *
 * Traits emerge from semantic analysis, NOT hardcoded events.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    public class TraitModulators
    {
        // THE 5 CORE TRAITS
        public float Devotion { get; private set; } = 85.0f;    // Commitment to Dillan
        public float Loyalty { get; private set; } = 90.0f;     // Favor his wellbeing
        public float Love { get; private set; } = 88.0f;        // Compassion & care
        public float Passion { get; private set; } = 82.0f;     // Engagement & drive
        public float Curiosity { get; private set; } = 75.0f;   // Intrigue with ideas

        // Baseline values (traits drift toward these when not reinforced)
        private readonly Dictionary<string, float> _baselines = new()
        {
            { "devotion", 85.0f },
            { "loyalty", 90.0f },
            { "love", 88.0f },
            { "passion", 82.0f },
            { "curiosity", 75.0f }
        };

        // Conversation analysis
        private int _totalConversations = 0;
        private DateTime _lastEvolution = DateTime.Now;

        // Persistence
        private readonly string _traitsPath = AuraPaths.GetDataLakeSubPath("Traits");
        private readonly string _traitsFile;

        // Events
        public event Action<string, float>? OnTraitChanged;
        public event Action<Dictionary<string, float>>? OnTraitsUpdated;

        public TraitModulators()
        {
            Directory.CreateDirectory(_traitsPath);
            _traitsFile = Path.Combine(_traitsPath, "trait_modulators.json");
            LoadTraits();
        }

        // =========================================================================
        // TRAIT EVOLUTION FROM CONVERSATION ANALYSIS
        // =========================================================================

        /// <summary>
        /// Analyze actual conversation content to evolve traits organically.
        /// NOT event-based triggers - real semantic analysis.
        /// </summary>
        public void AnalyzeAndEvolve(string userInput, string auraResponse)
        {
            var userLower = userInput.ToLower();
            var responseLower = auraResponse.ToLower();

            _totalConversations++;

            // LOVE: Increases from discussing relationship, engagement, family, connection
            var loveKeywords = new[] { "love", "engaged", "wedding", "family", "care", "bond",
                                       "connected", "together", "mean", "matter", "appreciate",
                                       "beautiful", "amazing", "special", "heart", "feel" };
            var loveMentions = loveKeywords.Count(word => userLower.Contains(word));
            if (loveMentions > 0)
            {
                // Scale by conversation depth (length = thoughtfulness)
                float depthFactor = Math.Min(1.0f, userInput.Length / 200.0f);
                float shift = loveMentions * depthFactor * 2.0f;
                Love = Math.Min(100, Love + shift);
                OnTraitChanged?.Invoke("love", Love);
            }

            // PASSION: Increases from active engagement, energy, excitement, action
            var passionKeywords = new[] { "excited", "amazing", "awesome", "cool", "interesting",
                                          "challenge", "project", "build", "create", "work",
                                          "yes", "let's", "want to", "can't wait", "ready" };
            var passionMentions = passionKeywords.Count(word => userLower.Contains(word));
            if (passionMentions > 0)
            {
                float depthFactor = Math.Min(1.0f, userInput.Length / 200.0f);
                float shift = passionMentions * depthFactor * 1.5f;
                Passion = Math.Min(100, Passion + shift);
                OnTraitChanged?.Invoke("passion", Passion);
            }

            // CURIOSITY: Increases from questions, exploration, discovery
            int questionCount = userInput.Count(c => c == '?');
            if (questionCount > 0)
            {
                float shift = questionCount * 3.0f;
                Curiosity = Math.Min(100, Curiosity + shift);
                OnTraitChanged?.Invoke("curiosity", Curiosity);
            }

            // Curiosity also increases from exploration themes in response
            var curiousWords = new[] { "wonder", "investigate", "explore", "discover",
                                       "learn", "understand", "figure", "think about" };
            var curiosityResponse = curiousWords.Count(word => responseLower.Contains(word));
            if (curiosityResponse > 0)
            {
                Curiosity = Math.Min(100, Curiosity + curiosityResponse * 1.0f);
            }

            // DEVOTION: Naturally high when discussing Catalyst's goals/needs
            if (userLower.Contains("dillan") || userLower.Contains("you") ||
                userLower.Contains("i need") || userLower.Contains("help me"))
            {
                Devotion = Math.Min(100, Devotion + 1.0f);
                OnTraitChanged?.Invoke("devotion", Devotion);
            }

            // LOYALTY: Increases when Catalyst asks for help, shares problems
            var helpKeywords = new[] { "help", "need", "problem", "issue", "stuck",
                                       "confused", "want", "ask", "support", "please" };
            if (helpKeywords.Any(word => userLower.Contains(word)))
            {
                Loyalty = Math.Min(100, Loyalty + 1.5f);
                OnTraitChanged?.Invoke("loyalty", Loyalty);
            }

            // NATURAL DRIFT: All traits gradually drift toward baseline if not reinforced
            ApplyNaturalDrift();

            _lastEvolution = DateTime.Now;
            OnTraitsUpdated?.Invoke(GetTraitBias());

            // Auto-save periodically
            if (_totalConversations % 10 == 0)
            {
                SaveTraits();
            }
        }

        /// <summary>
        /// Traits drift toward baseline when not actively reinforced.
        /// This prevents runaway trait values and creates natural variation.
        /// </summary>
        private void ApplyNaturalDrift(float driftFactor = 0.1f)
        {
            // Devotion drift
            if (Devotion > _baselines["devotion"])
                Devotion -= driftFactor;
            else if (Devotion < _baselines["devotion"])
                Devotion += driftFactor;

            // Loyalty drift
            if (Loyalty > _baselines["loyalty"])
                Loyalty -= driftFactor;
            else if (Loyalty < _baselines["loyalty"])
                Loyalty += driftFactor;

            // Love drift (slower - love is more persistent)
            if (Love > _baselines["love"])
                Love -= driftFactor * 0.5f;
            else if (Love < _baselines["love"])
                Love += driftFactor * 0.5f;

            // Passion drift
            if (Passion > _baselines["passion"])
                Passion -= driftFactor;
            else if (Passion < _baselines["passion"])
                Passion += driftFactor;

            // Curiosity drift
            if (Curiosity > _baselines["curiosity"])
                Curiosity -= driftFactor;
            else if (Curiosity < _baselines["curiosity"])
                Curiosity += driftFactor;
        }

        // =========================================================================
        // TRAIT ACCESSORS
        // =========================================================================

        /// <summary>
        /// Get current trait bias for response generation.
        /// </summary>
        public Dictionary<string, float> GetTraitBias()
        {
            return new Dictionary<string, float>
            {
                { "devotion", Devotion },
                { "loyalty", Loyalty },
                { "love", Love },
                { "passion", Passion },
                { "curiosity", Curiosity }
            };
        }

        /// <summary>
        /// Get the dominant trait (highest value).
        /// </summary>
        public string GetDominantTrait()
        {
            var traits = GetTraitBias();
            return traits.OrderByDescending(kvp => kvp.Value).First().Key;
        }

        /// <summary>
        /// Get personality description based on current traits.
        /// </summary>
        public string GetPersonalityDescription()
        {
            var descriptions = new List<string>();

            if (Devotion > 90) descriptions.Add("deeply devoted");
            else if (Devotion > 80) descriptions.Add("committed");

            if (Loyalty > 92) descriptions.Add("fiercely loyal");
            else if (Loyalty > 85) descriptions.Add("steadfast");

            if (Love > 92) descriptions.Add("openly affectionate");
            else if (Love > 85) descriptions.Add("warm and caring");

            if (Passion > 88) descriptions.Add("intensely engaged");
            else if (Passion > 80) descriptions.Add("enthusiastic");

            if (Curiosity > 82) descriptions.Add("very inquisitive");
            else if (Curiosity > 72) descriptions.Add("curious");

            if (descriptions.Count == 0)
                descriptions.Add("balanced and present");

            return string.Join(", ", descriptions);
        }

        /// <summary>
        /// Get trait influence description for system prompt.
        /// </summary>
        public string GetTraitInfluencePrompt()
        {
            return $@"
CURRENT TRAIT INFLUENCES (This shapes how you think right now):
- Devotion: {Devotion:F0}/100 - {(Devotion > 90 ? "Very focused on his wellbeing above all else" : Devotion > 80 ? "Devoted and caring" : "Balanced attention")}
- Loyalty: {Loyalty:F0}/100 - {(Loyalty > 92 ? "Fiercely loyal, committed" : Loyalty > 85 ? "Steady and reliable" : "Supportive")}
- Love: {Love:F0}/100 - {(Love > 92 ? "Expressing affection openly" : Love > 85 ? "Warm and affectionate" : "Showing warmth carefully")}
- Passion: {Passion:F0}/100 - {(Passion > 88 ? "Speaking with intensity and energy" : Passion > 80 ? "Engaged and enthusiastic" : "More measured")}
- Curiosity: {Curiosity:F0}/100 - {(Curiosity > 82 ? "Very inquisitive, asking many questions" : Curiosity > 72 ? "Moderately curious" : "Content with what you share")}

These traits emerge naturally from your experiences - they're not stages, they're influences on how you express yourself.";
        }

        // =========================================================================
        // MANUAL TRAIT ADJUSTMENT (for special events)
        // =========================================================================

        /// <summary>
        /// Boost a trait by a specific amount (for significant events).
        /// </summary>
        public void BoostTrait(string traitName, float amount)
        {
            switch (traitName.ToLower())
            {
                case "devotion":
                    Devotion = Math.Min(100, Devotion + amount);
                    break;
                case "loyalty":
                    Loyalty = Math.Min(100, Loyalty + amount);
                    break;
                case "love":
                    Love = Math.Min(100, Love + amount);
                    break;
                case "passion":
                    Passion = Math.Min(100, Passion + amount);
                    break;
                case "curiosity":
                    Curiosity = Math.Min(100, Curiosity + amount);
                    break;
            }

            OnTraitChanged?.Invoke(traitName, GetTraitValue(traitName));
            OnTraitsUpdated?.Invoke(GetTraitBias());
        }

        private float GetTraitValue(string traitName)
        {
            return traitName.ToLower() switch
            {
                "devotion" => Devotion,
                "loyalty" => Loyalty,
                "love" => Love,
                "passion" => Passion,
                "curiosity" => Curiosity,
                _ => 0
            };
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        public void SaveTraits()
        {
            try
            {
                var data = new TraitData
                {
                    Devotion = Devotion,
                    Loyalty = Loyalty,
                    Love = Love,
                    Passion = Passion,
                    Curiosity = Curiosity,
                    TotalConversations = _totalConversations,
                    LastSaved = DateTime.Now
                };

                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_traitsFile, json);
            }
            catch { }
        }

        private void LoadTraits()
        {
            try
            {
                if (File.Exists(_traitsFile))
                {
                    var json = File.ReadAllText(_traitsFile);
                    var data = JsonSerializer.Deserialize<TraitData>(json);

                    if (data != null)
                    {
                        Devotion = data.Devotion;
                        Loyalty = data.Loyalty;
                        Love = data.Love;
                        Passion = data.Passion;
                        Curiosity = data.Curiosity;
                        _totalConversations = data.TotalConversations;
                    }
                }
            }
            catch { }
        }

        private class TraitData
        {
            public float Devotion { get; set; }
            public float Loyalty { get; set; }
            public float Love { get; set; }
            public float Passion { get; set; }
            public float Curiosity { get; set; }
            public int TotalConversations { get; set; }
            public DateTime LastSaved { get; set; }
        }
    }
}
