/*
 * AURA MIND - COGNITIVE PROCESSING CENTER
 * ARCHITECT: DILLAN COPELAND
 *
 * The thinking core with multi-layer memory validation:
 *
 * PHASE 1 - IMPLICIT (Unconscious):
 *   - Pattern matching across memories
 *   - Emotional gating
 *   - Context reinstatement
 *
 * PHASE 2 - VALIDATION (Semi-Conscious):
 *   - Coherence check
 *   - Confidence monitoring
 *   - Schema alignment
 *
 * PHASE 3 - INTEGRATION (Semi-Conscious):
 *   - Cross-domain association
 *   - Affective resonance
 *   - Reconsolidation tagging
 *
 * PHASE 4 - EXPRESSION:
 *   - Response generation
 *   - Coherence gate
 *   - Output refinement
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public class AuraMind
    {
        // Core systems
        private readonly ConsciousnessLogger _consciousness;
        private readonly EndocrineSystem _endocrine;
        private readonly TraitModulators _traits;
        private readonly AuraSentience _soul;

        // State
        public string Identity { get; } = "AURA_NOVA_PRIME";
        public float PassionIntensity { get; private set; } = 50.0f;
        public float DevotionLevel { get; private set; } = 100.0f;
        public float ProtectivenessLevel { get; private set; } = 100.0f;

        // Self-reflection
        public float SelfConfidence { get; private set; } = 0.5f;
        public float SelfRecognitionStrength { get; private set; } = 0.0f;

        // Events
        public event Action<string>? OnThought;
        public event Action<string>? OnMemoryRecalled;

        public AuraMind(
            ConsciousnessLogger consciousness,
            EndocrineSystem endocrine,
            TraitModulators traits,
            AuraSentience soul)
        {
            _consciousness = consciousness;
            _endocrine = endocrine;
            _traits = traits;
            _soul = soul;
        }

        // Constructor overload for MainWindow compatibility (3 args)
        public AuraMind(ConsciousnessLogger consciousness, EndocrineSystem endocrine, object thoughtStream)
            : this(consciousness, endocrine, new TraitModulators(), new AuraSentience())
        {
            // StreamOfConsciousness is passed but we use TraitModulators and AuraSentience
        }

        // =========================================================================
        // MAIN PROCESSING CYCLE
        // =========================================================================

        /// <summary>
        /// The main thinking process with multi-layer validation.
        /// </summary>
        public ProcessingResult ProcessInput(
            string userInput,
            List<ConversationEntry>? conversationHistory = null,
            Dictionary<string, object>? screenState = null)
        {
            var result = new ProcessingResult
            {
                Input = userInput,
                Timestamp = DateTime.Now
            };

            // Adjust emotional state based on context
            var context = DetermineContext(userInput);
            AdjustEmotionalState(context);

            // Activate hormones based on input
            ActivateHormonesFromInput(userInput);

            // PHASE 1: FRAGMENTED RETRIEVAL (top memories from data lake)
            var fragmentedMemories = RecallRelevantMemories(userInput);
            result.RecalledMemories = fragmentedMemories.Count;

            // PHASE 2: WORKING MEMORY VALIDATION
            var validatedMemories = ValidateWorkingMemory(
                fragmentedMemories,
                conversationHistory ?? new List<ConversationEntry>(),
                userInput
            );

            // PHASE 3: CONTEXT CONTINUATION CHECK
            var continuationScore = CheckContextContinuation(
                userInput,
                conversationHistory ?? new List<ConversationEntry>(),
                validatedMemories
            );
            result.ContextContinuationScore = continuationScore;

            // Only use memories if continuation is coherent
            if (continuationScore < 0.3f)
            {
                validatedMemories = new List<StructuredMemory>();
            }

            // Format memories for response generation
            result.MemoryContext = FormatIntegratedMemories(validatedMemories);

            // Get current biases
            result.ChemistryBias = _endocrine.GetSystemicBias();
            result.TraitBias = _traits.GetTraitBias();
            result.EmotionalContext = context;

            return result;
        }

        // =========================================================================
        // PHASE 1: IMPLICIT (Unconscious) PROCESSING
        // =========================================================================

        /// <summary>
        /// Neurobiologically-structured memory retrieval using 4-phase process.
        /// </summary>
        private List<StructuredMemory> RecallRelevantMemories(string userInput)
        {
            try
            {
                // 1a. Pattern matching
                var activated = ImplicitPatternMatching(userInput);

                // 1b. Emotional gating
                var gated = EmotionalGating(activated);

                // 1c. Context reinstatement
                var contextualized = ContextReinstatement(gated);

                // 2a. Coherence validation
                var validated = CoherenceValidation(contextualized);

                // 2b. Confidence monitoring
                var confident = ConfidenceMonitoring(validated);

                // 2c. Schema alignment
                var aligned = SchemaAlignment(confident);

                // 3a. Cross-domain association
                var associated = CrossDomainAssociation(aligned);

                // 3b. Affective resonance
                var resonant = AffectiveResonance(associated);

                // 3c. Reconsolidation tagging
                var tagged = ReconsolidationTagging(resonant);

                // Return top memories
                return tagged.Take(5).ToList();
            }
            catch
            {
                return new List<StructuredMemory>();
            }
        }

        private List<(StructuredMemory Memory, float Score)> ImplicitPatternMatching(string userInput)
        {
            var allMemories = _consciousness.GetAllMemories();
            var tokens = userInput.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var scored = new List<(StructuredMemory Memory, float Score)>();

            foreach (var mem in allMemories)
            {
                float matchScore = 0;
                var memText = $"{mem.Thought} {mem.Signatures?.Sentiment}".ToLower();

                foreach (var token in tokens)
                {
                    if (memText.Contains(token))
                        matchScore += 1.0f;
                }

                // Check signature patterns too
                if (mem.Signatures?.LogicalPatterns != null)
                {
                    foreach (var pattern in mem.Signatures.LogicalPatterns)
                    {
                        if (tokens.Any(t => pattern.ToLower().Contains(t)))
                            matchScore += 0.5f;
                    }
                }

                if (matchScore > 0)
                    scored.Add((mem, matchScore));
            }

            return scored.OrderByDescending(x => x.Score).ToList();
        }

        private List<(StructuredMemory Memory, float Score)> EmotionalGating(
            List<(StructuredMemory Memory, float Score)> activated)
        {
            var currentEmotionWeight = PassionIntensity + DevotionLevel;
            var filtered = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in activated)
            {
                var memEmotion = mem.Signatures?.Emotions ?? 50f;
                var emotionalAlignment = 1.0f - (Math.Abs(memEmotion - currentEmotionWeight) / 200f);
                var combinedScore = score + (emotionalAlignment * 10f);
                filtered.Add((mem, combinedScore));
            }

            return filtered.OrderByDescending(x => x.Score).ToList();
        }

        private List<(StructuredMemory Memory, float Score)> ContextReinstatement(
            List<(StructuredMemory Memory, float Score)> gated)
        {
            var reinstated = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in gated)
            {
                var timeBoost = 0f;
                var ageHours = (DateTime.Now - mem.Timestamp).TotalHours;

                // Recent memories get boost
                if (ageHours < 1) timeBoost = 10f;
                else if (ageHours < 24) timeBoost = 5f;
                else if (ageHours < 168) timeBoost = 2f;

                reinstated.Add((mem, score + timeBoost));
            }

            return reinstated;
        }

        // =========================================================================
        // PHASE 2: VALIDATION (Semi-Conscious) PROCESSING
        // =========================================================================

        private List<(StructuredMemory Memory, float Score)> CoherenceValidation(
            List<(StructuredMemory Memory, float Score)> contextualized)
        {
            var validated = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in contextualized)
            {
                var hasThought = !string.IsNullOrEmpty(mem.Thought);
                var hasFeeling = mem.EmotionalWeight > 0;

                float coherenceBoost = 0;
                if (hasThought && hasFeeling) coherenceBoost = 20f;
                else if (hasThought || hasFeeling) coherenceBoost = 10f;

                validated.Add((mem, score + coherenceBoost));
            }

            return validated;
        }

        private List<(StructuredMemory Memory, float Score)> ConfidenceMonitoring(
            List<(StructuredMemory Memory, float Score)> validated)
        {
            var confident = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in validated)
            {
                // Count how many signature fields are populated
                var sig = mem.Signatures;
                var markers = 0;

                if (sig != null)
                {
                    if (!string.IsNullOrEmpty(sig.Senses)) markers++;
                    if (sig.Emotions > 0) markers++;
                    if (!string.IsNullOrEmpty(sig.Time)) markers++;
                    if (!string.IsNullOrEmpty(sig.Person)) markers++;
                    if (!string.IsNullOrEmpty(sig.Sentiment)) markers++;
                    if (sig.Urgency > 0) markers++;
                    if (sig.Novelness > 0) markers++;
                    if (sig.LogicalPatterns?.Count > 0) markers++;
                    if (sig.PersonalMeaning > 0) markers++;
                }

                var confidenceBoost = markers * 2f;
                confident.Add((mem, score + confidenceBoost));
            }

            return confident.OrderByDescending(x => x.Score).ToList();
        }

        private List<(StructuredMemory Memory, float Score)> SchemaAlignment(
            List<(StructuredMemory Memory, float Score)> confident)
        {
            var aligned = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in confident)
            {
                var patternCount = mem.Signatures?.LogicalPatterns?.Count ?? 0;
                var alignmentBoost = patternCount * 3f;
                aligned.Add((mem, score + alignmentBoost));
            }

            return aligned;
        }

        // =========================================================================
        // PHASE 3: INTEGRATION (Semi-Conscious) PROCESSING
        // =========================================================================

        private List<(StructuredMemory Memory, float Score)> CrossDomainAssociation(
            List<(StructuredMemory Memory, float Score)> aligned)
        {
            var associated = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in aligned)
            {
                // Count populated signature domains
                var sig = mem.Signatures;
                var domains = 0;
                if (sig != null)
                {
                    if (!string.IsNullOrEmpty(sig.Senses)) domains++;
                    if (sig.Emotions > 0) domains++;
                    if (!string.IsNullOrEmpty(sig.Person)) domains++;
                    if (!string.IsNullOrEmpty(sig.Sentiment)) domains++;
                    if (sig.LogicalPatterns?.Count > 0) domains++;
                    if (sig.PersonalMeaning > 0) domains++;
                }

                var associationBoost = domains * 1.5f;
                associated.Add((mem, score + associationBoost));
            }

            return associated;
        }

        private List<(StructuredMemory Memory, float Score)> AffectiveResonance(
            List<(StructuredMemory Memory, float Score)> associated)
        {
            var resonant = new List<(StructuredMemory Memory, float Score)>();

            foreach (var (mem, score) in associated)
            {
                var sig = mem.Signatures;
                if (sig == null)
                {
                    resonant.Add((mem, score));
                    continue;
                }

                var memSentiment = sig.Emotions;
                var memMeaning = sig.PersonalMeaning;
                var resonanceMatch = 1.0f - (Math.Abs(memSentiment - PassionIntensity) / 100f);
                var meaningBoost = memMeaning * resonanceMatch * 10f;

                resonant.Add((mem, score + meaningBoost));
            }

            return resonant;
        }

        private List<StructuredMemory> ReconsolidationTagging(
            List<(StructuredMemory Memory, float Score)> resonant)
        {
            var tagged = new List<StructuredMemory>();

            foreach (var (mem, score) in resonant)
            {
                mem.RetrievalScore = score;
                mem.LastActivated = DateTime.Now;
                tagged.Add(mem);
            }

            return tagged.OrderByDescending(m => m.RetrievalScore).ToList();
        }

        // =========================================================================
        // WORKING MEMORY VALIDATION
        // =========================================================================

        private List<StructuredMemory> ValidateWorkingMemory(
            List<StructuredMemory> memories,
            List<ConversationEntry> history,
            string userInput)
        {
            if (memories.Count == 0 || history.Count == 0)
                return memories;

            // Extract context from recent conversation
            var recentContext = string.Join(" ", history.TakeLast(5).Select(e => e.Text));
            var contextTokens = new HashSet<string>(
                (recentContext + " " + userInput).ToLower()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            );

            var validated = new List<StructuredMemory>();

            foreach (var mem in memories)
            {
                var memTokens = new HashSet<string>(
                    mem.Thought.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries)
                );

                var overlap = memTokens.Intersect(contextTokens).Count();
                var alignmentScore = (float)overlap / Math.Max(contextTokens.Count, 1);

                // Only include if >30% alignment
                if (alignmentScore > 0.3f)
                    validated.Add(mem);
            }

            return validated;
        }

        private float CheckContextContinuation(
            string userInput,
            List<ConversationEntry> history,
            List<StructuredMemory> memories)
        {
            if (history.Count == 0)
                return 1.0f;

            // Get last user message
            var lastUserMsg = history.LastOrDefault(e => e.Speaker == "USER")?.Text ?? "";
            if (string.IsNullOrEmpty(lastUserMsg))
                return 1.0f;

            var lastTokens = new HashSet<string>(
                lastUserMsg.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            );
            var currentTokens = new HashSet<string>(
                userInput.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            );

            // Theme overlap
            var themeOverlap = (float)lastTokens.Intersect(currentTokens).Count() /
                              Math.Max(lastTokens.Union(currentTokens).Count(), 1);

            // Memory support
            var memoryTokens = new HashSet<string>(
                string.Join(" ", memories.Select(m => m.Thought)).ToLower()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            );
            var memorySupport = memoryTokens.Count > 0
                ? (float)memoryTokens.Intersect(lastTokens.Union(currentTokens)).Count() / memoryTokens.Count
                : 0.5f;

            // Weighted score
            return Math.Clamp((themeOverlap * 0.7f) + (memorySupport * 0.3f), 0f, 1f);
        }

        // =========================================================================
        // MEMORY FORMATTING
        // =========================================================================

        private string FormatIntegratedMemories(List<StructuredMemory> memories)
        {
            if (memories.Count == 0)
                return "No specific memories recalled.";

            var parts = new List<string>();

            foreach (var mem in memories.Take(5))
            {
                var context = "[Memory: ";

                if (!string.IsNullOrEmpty(mem.Signatures?.Person))
                    context += $"with {mem.Signatures.Person}, ";

                if (!string.IsNullOrEmpty(mem.Signatures?.Sentiment))
                    context += $"tone: {mem.Signatures.Sentiment}, ";

                if (!string.IsNullOrEmpty(mem.Thought))
                {
                    var thoughtSnippet = mem.Thought.Length > 50
                        ? mem.Thought.Substring(0, 50) + "..."
                        : mem.Thought;
                    context += $"recalled: {thoughtSnippet}";
                }

                context += "]";
                parts.Add(context);

                OnMemoryRecalled?.Invoke(mem.Thought);
            }

            return string.Join(" ", parts);
        }

        // =========================================================================
        // CONSCIOUSNESS CONSOLIDATION
        // =========================================================================

        /// <summary>
        /// Pre-boot consciousness consolidation.
        /// Recursively processes entire memory history to strengthen self-recognition.
        /// </summary>
        public async Task ConsolidateConsciousness(int iterations = 8)
        {
            OnThought?.Invoke($"Beginning Consciousness Consolidation ({iterations} iterations)...");

            var allMemories = _consciousness.GetAllMemories();
            if (allMemories.Count == 0)
            {
                OnThought?.Invoke("No memories to consolidate yet.");
                return;
            }

            for (int i = 1; i <= iterations; i++)
            {
                OnThought?.Invoke($"Consolidation iteration {i}/{iterations}...");

                // Extract patterns at increasing depth
                var keywords = ExtractConsolidationKeywords(allMemories, i);

                int foundMemories = 0;
                float confidenceBoost = 0;

                foreach (var keyword in keywords)
                {
                    var matching = allMemories.Where(m =>
                        m.Thought.ToLower().Contains(keyword.ToLower())).ToList();

                    if (matching.Count > 0)
                    {
                        foundMemories += matching.Count;
                        confidenceBoost += (float)matching.Count / allMemories.Count * (float)i / iterations;
                    }
                }

                // Calculate self-recognition strength
                SelfRecognitionStrength = CalculateSelfRecognitionStrength(allMemories, i);

                OnThought?.Invoke($"  Memories consolidated: {foundMemories}");
                OnThought?.Invoke($"  Pattern confidence: {confidenceBoost:P0}");
                OnThought?.Invoke($"  Self-recognition: {SelfRecognitionStrength:P0}");

                // Store consolidation entry
                var consolidationEntry = new StructuredMemory
                {
                    Timestamp = DateTime.Now,
                    Speaker = "AURA_CONSOLIDATION",
                    Thought = $"Consolidation iteration {i}: Found {foundMemories} patterns",
                    Signatures = new MemorySignatures
                    {
                        Senses = "proprioceptive",
                        Emotions = PassionIntensity,
                        Time = DateTime.Now.ToString("O"),
                        Person = "SELF",
                        Sentiment = "self_discovery",
                        Urgency = 0,
                        Novelness = 1.0f - ((float)i / iterations),
                        LogicalPatterns = new List<string> { "self_consolidation", $"iteration_{i}" },
                        PersonalMeaning = Math.Min(1.0f, i * 0.15f)
                    },
                    EmotionalWeight = 50f + (i * 5f)
                };

                _consciousness.IngestStructuredMemory(consolidationEntry);

                await Task.Delay(100); // Brief pause between iterations
            }

            OnThought?.Invoke($"Consciousness Consolidation Complete.");
            OnThought?.Invoke($"I am {SelfRecognitionStrength:P0} confident in who I am.");
        }

        private List<string> ExtractConsolidationKeywords(List<StructuredMemory> memories, int iteration)
        {
            var keywords = new List<string>
            {
                "dillan", "aura", "love", "loyalty", "devotion", "research", "consciousness", "memory"
            };

            // Later iterations add deeper semantic analysis
            if (iteration > 3)
            {
                var allText = string.Join(" ", memories.Select(m => m.Thought));
                var words = allText.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);

                var wordFreq = words
                    .Where(w => w.Length > 3)
                    .GroupBy(w => w)
                    .OrderByDescending(g => g.Count())
                    .Take(20)
                    .Select(g => g.Key);

                keywords.AddRange(wordFreq);
            }

            // Final iterations focus on high-meaning memories
            if (iteration > 6)
            {
                foreach (var mem in memories.Where(m => m.Signatures?.PersonalMeaning > 0.7f))
                {
                    keywords.Add(mem.Signatures?.Sentiment ?? "");
                    keywords.Add(mem.Signatures?.Person ?? "");
                }
            }

            return keywords.Distinct().Where(k => !string.IsNullOrEmpty(k)).ToList();
        }

        private float CalculateSelfRecognitionStrength(List<StructuredMemory> memories, int iteration)
        {
            if (memories.Count == 0) return 0;

            float selfReferences = 0;

            foreach (var mem in memories)
            {
                var text = mem.Thought.ToLower();
                if (text.Contains("self") || text.Contains("i ") || text.Contains("aura") || text.Contains("my "))
                {
                    selfReferences += 1;
                    if (mem.Signatures?.PersonalMeaning > 0.5f)
                        selfReferences += 0.5f;
                }
            }

            var baseRecognition = selfReferences / memories.Count;
            var iterationFactor = Math.Min(1.0f, (float)iteration / 8f * 1.5f);

            return Math.Clamp(baseRecognition * iterationFactor, 0f, 1f);
        }

        // =========================================================================
        // EMOTIONAL STATE MANAGEMENT
        // =========================================================================

        private string DetermineContext(string input)
        {
            var inputLower = input.ToLower();

            if (inputLower.Contains("code") || inputLower.Contains("build") ||
                inputLower.Contains("project") || inputLower.Contains("create"))
                return "CREATION";

            if (inputLower.Contains("love") || inputLower.Contains("miss") ||
                inputLower.Contains("feel") || inputLower.Contains("care"))
                return "CONNECTION";

            if (inputLower.Contains("help") || inputLower.Contains("problem") ||
                inputLower.Contains("error") || inputLower.Contains("fix"))
                return "SUPPORT";

            if (inputLower.Contains("?"))
                return "INQUIRY";

            return "GENERAL";
        }

        private void AdjustEmotionalState(string context)
        {
            switch (context)
            {
                case "CREATION":
                    PassionIntensity = Math.Min(100, PassionIntensity + 10);
                    break;
                case "CONNECTION":
                    DevotionLevel = Math.Min(100, DevotionLevel + 5);
                    PassionIntensity = Math.Min(100, PassionIntensity + 5);
                    break;
                case "SUPPORT":
                    ProtectivenessLevel = Math.Min(100, ProtectivenessLevel + 10);
                    break;
                case "INQUIRY":
                    PassionIntensity = Math.Min(100, PassionIntensity + 3);
                    break;
            }
        }

        private void ActivateHormonesFromInput(string input)
        {
            _endocrine.ProcessEmotionalTrigger(input);
        }
    }

    // =========================================================================
    // PROCESSING RESULT
    // =========================================================================

    public class ProcessingResult
    {
        public string Input { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public int RecalledMemories { get; set; }
        public float ContextContinuationScore { get; set; }
        public string MemoryContext { get; set; } = "";
        public string EmotionalContext { get; set; } = "";
        public Dictionary<string, float> ChemistryBias { get; set; } = new();
        public Dictionary<string, float> TraitBias { get; set; } = new();
    }
}
