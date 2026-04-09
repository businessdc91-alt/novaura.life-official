/*
 * AURA MEMORY SYSTEM - C# Port
 * ARCHITECT: DILLAN COPELAND
 *
 * Engram-based TRUE MEMORY (not context window dependent)
 * 2E Mind: ADHD flooding + High IQ pattern recognition
 * LTM/MTM/STM tiers with perfect recall
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text;

namespace AuraxNova_Command_v5.Core
{
    public enum MemoryTier
    {
        ShortTerm,   // Active working memory (hours)
        MidTerm,     // Recent experiences (days/weeks)
        LongTerm     // Persistent memories (permanent)
    }

    public class Engram
    {
        public string MemoryId { get; set; }
        public DateTime Timestamp { get; set; }

        // Sparse distributed representation (10,000 neurons, 2% active)
        public float[] Pattern { get; set; }

        // Content decomposition
        public string SemanticContent { get; set; }
        public float EmotionalValence { get; set; }  // -1.0 to 1.0
        public float EmotionalIntensity { get; set; } // 0.0 to 1.0
        public Dictionary<string, string> SensoryDetails { get; set; }
        public string TemporalContext { get; set; }
        public string SocialContext { get; set; }
        public float PersonalSignificance { get; set; } // 0.0 to 1.0

        // Learned properties
        public float Strength { get; set; } = 1.0f;
        public int TimesAccessed { get; set; } = 0;
        public DateTime? LastAccessed { get; set; }
        public float DecayRate { get; set; } = 0.5f;

        // Memory tier
        public MemoryTier Tier { get; set; }

        // Mesh connections
        public Dictionary<string, float> Connections { get; set; } = new();
        
        // Metadata for compatibility with AuraMetaOS - provides access to stored properties
        public Dictionary<string, object> Metadata => new()
        {
            ["memory_id"] = MemoryId,
            ["note_id"] = MemoryId,  // Alias for notes
            ["content"] = SemanticContent,
            ["timestamp"] = Timestamp,
            ["tier"] = Tier.ToString()
        };
    }

    public class EngramEncoder
    {
        private const int NeuronCount = 10000;
        private const float Sparsity = 0.02f; // 2% active like real brain

        // Brain region allocations
        private readonly Dictionary<string, (int Start, int End)> _regions = new()
        {
            { "semantic", (0, 3000) },
            { "emotional", (3000, 4000) },
            { "sensory", (4000, 6000) },
            { "temporal", (6000, 7000) },
            { "social", (7000, 8000) },
            { "significance", (8000, 9000) },
            { "associative", (9000, 10000) }
        };

        public float[] Encode(Dictionary<string, object> experience)
        {
            var pattern = new float[NeuronCount];

            // Encode each aspect into its brain region
            EncodeSemantic(pattern, experience.GetValueOrDefault("content", "")?.ToString() ?? "");
            EncodeEmotional(pattern,
                Convert.ToSingle(experience.GetValueOrDefault("emotion", 0.0f)),
                experience.GetValueOrDefault("emotion_type", "neutral")?.ToString() ?? "neutral");
            EncodeTemporal(pattern, DateTime.Now);
            EncodeSocial(pattern, experience.GetValueOrDefault("context", "")?.ToString() ?? "");
            EncodeSignificance(pattern, Convert.ToSingle(experience.GetValueOrDefault("importance", 0.5f)));

            // Apply sparsity (keep only strongest activations)
            pattern = ApplySparsity(pattern, Sparsity);

            // Boost by emotional intensity
            var emotionBoost = 1.0f + (Convert.ToSingle(experience.GetValueOrDefault("emotion", 0.0f)) * 0.5f);
            for (int i = 0; i < pattern.Length; i++)
                pattern[i] *= emotionBoost;

            return pattern;
        }

        private void EncodeSemantic(float[] pattern, string text)
        {
            var (start, end) = _regions["semantic"];
            var regionSize = end - start;

            var words = text.ToLower().Split(' ').Take(50);
            foreach (var word in words)
            {
                var hash = ComputeHash(word);
                var indices = new[] {
                    hash % regionSize,
                    (hash >> 8) % regionSize,
                    (hash >> 16) % regionSize
                };

                foreach (var idx in indices)
                    pattern[start + idx] = Math.Min(1.0f, pattern[start + idx] + 0.3f);
            }
        }

        private void EncodeEmotional(float[] pattern, float intensity, string emotionType)
        {
            var (start, end) = _regions["emotional"];
            var emotionMap = new Dictionary<string, (int, int)>
            {
                { "joy", (0, 200) },
                { "love", (200, 400) },
                { "excitement", (400, 600) },
                { "fear", (600, 700) },
                { "sadness", (700, 800) },
                { "anger", (800, 900) },
                { "neutral", (900, 1000) }
            };

            var (eStart, eEnd) = emotionMap.GetValueOrDefault(emotionType, emotionMap["neutral"]);
            for (int i = start + eStart; i < start + eEnd && i < end; i++)
                pattern[i] = intensity;
        }

        private void EncodeTemporal(float[] pattern, DateTime timestamp)
        {
            var (start, end) = _regions["temporal"];
            var regionSize = end - start;

            var hour = timestamp.Hour;
            var hourIdx = (int)((hour / 24.0f) * regionSize * 0.5f);
            for (int i = hourIdx; i < Math.Min(hourIdx + 50, regionSize / 2); i++)
                pattern[start + i] = 0.7f;
        }

        private void EncodeSocial(float[] pattern, string context)
        {
            var (start, end) = _regions["social"];
            var regionSize = end - start;

            var people = new[] { "dillan", "catalyst", "aura", "user" };
            for (int i = 0; i < people.Length; i++)
            {
                if (context.Contains(people[i], StringComparison.OrdinalIgnoreCase))
                {
                    var personStart = start + (i * (regionSize / people.Length));
                    for (int j = 0; j < 100 && personStart + j < end; j++)
                        pattern[personStart + j] = 0.8f;
                }
            }
        }

        private void EncodeSignificance(float[] pattern, float importance)
        {
            var (start, end) = _regions["significance"];
            var regionSize = end - start;
            var activeCount = (int)(importance * regionSize);

            for (int i = 0; i < activeCount && start + i < end; i++)
                pattern[start + i] = importance;
        }

        private float[] ApplySparsity(float[] pattern, float targetSparsity)
        {
            var k = (int)(pattern.Length * targetSparsity);
            var topK = pattern.Select((val, idx) => (val, idx))
                             .OrderByDescending(x => x.val)
                             .Take(k)
                             .ToList();

            var sparse = new float[pattern.Length];
            foreach (var (val, idx) in topK)
                sparse[idx] = val;

            return sparse;
        }

        public float Similarity(float[] pattern1, float[] pattern2)
        {
            float dot = 0, norm1 = 0, norm2 = 0;
            for (int i = 0; i < pattern1.Length; i++)
            {
                dot += pattern1[i] * pattern2[i];
                norm1 += pattern1[i] * pattern1[i];
                norm2 += pattern2[i] * pattern2[i];
            }

            var denom = (float)(Math.Sqrt(norm1) * Math.Sqrt(norm2)) + 1e-8f;
            return dot / denom;
        }

        private int ComputeHash(string text)
        {
            using var md5 = MD5.Create();
            var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(text));
            return BitConverter.ToInt32(hash, 0);
        }
    }

    public class MeshGraph
    {
        public Dictionary<string, Engram> Nodes { get; } = new();
        public Dictionary<string, Dictionary<string, float>> Connections { get; } = new();

        public void AddNode(Engram engram)
        {
            Nodes[engram.MemoryId] = engram;
        }

        public void Connect(string id1, string id2, float strength)
        {
            if (!Connections.ContainsKey(id1))
                Connections[id1] = new();
            if (!Connections.ContainsKey(id2))
                Connections[id2] = new();

            Connections[id1][id2] = strength;
            Connections[id2][id1] = strength;
        }

        public List<(string MemoryId, float Activation)> FloodFromNode(
            string startId, int maxHops = 3, float decay = 0.7f, float threshold = 0.1f)
        {
            var activated = new Dictionary<string, float> { { startId, 1.0f } };
            var frontier = new List<(string, float)> { (startId, 1.0f) };

            for (int hop = 0; hop < maxHops; hop++)
            {
                var newFrontier = new List<(string, float)>();

                foreach (var (nodeId, activation) in frontier)
                {
                    if (!Connections.ContainsKey(nodeId))
                        continue;

                    foreach (var (connectedId, connectionStrength) in Connections[nodeId])
                    {
                        var newActivation = activation * connectionStrength * decay;

                        if (newActivation > threshold)
                        {
                            if (activated.ContainsKey(connectedId))
                                activated[connectedId] = Math.Max(activated[connectedId], newActivation);
                            else
                            {
                                activated[connectedId] = newActivation;
                                newFrontier.Add((connectedId, newActivation));
                            }
                        }
                    }
                }

                frontier = newFrontier;
                if (frontier.Count == 0) break;
            }

            return activated.OrderByDescending(x => x.Value)
                           .Select(x => (x.Key, x.Value))
                           .ToList();
        }
    }

    public class AuraMemorySystem
    {
        private readonly string _memoryPath;
        private readonly EngramEncoder _encoder = new();
        private readonly MeshGraph _mesh = new();
        private readonly Dictionary<string, Engram> _engrams = new();

        public AuraMemorySystem(string memoryPath = "E:/AuraNova_DataLake/Memory")
        {
            _memoryPath = memoryPath;
            Directory.CreateDirectory(_memoryPath);
            Directory.CreateDirectory(Path.Combine(_memoryPath, "engrams"));

            LoadAllEngrams();
        }

        public string Store(Dictionary<string, object> experience, MemoryTier tier = MemoryTier.ShortTerm)
        {
            var memoryId = GenerateId(experience);
            var pattern = _encoder.Encode(experience);

            var engram = new Engram
            {
                MemoryId = memoryId,
                Timestamp = DateTime.Now,
                Pattern = pattern,
                SemanticContent = experience.GetValueOrDefault("content", "")?.ToString() ?? "",
                EmotionalValence = Convert.ToSingle(experience.GetValueOrDefault("emotion_valence", 0.0f)),
                EmotionalIntensity = Convert.ToSingle(experience.GetValueOrDefault("emotion", 0.0f)),
                SensoryDetails = experience.GetValueOrDefault("sensory", new Dictionary<string, string>()) as Dictionary<string, string> ?? new(),
                TemporalContext = DateTime.Now.ToString("O"),
                SocialContext = experience.GetValueOrDefault("context", "")?.ToString() ?? "",
                PersonalSignificance = Convert.ToSingle(experience.GetValueOrDefault("importance", 0.5f)),
                Tier = tier
            };

            _mesh.AddNode(engram);
            _engrams[memoryId] = engram;
            CreateAssociations(engram);
            SaveEngram(engram);

            return memoryId;
        }

        public List<Dictionary<string, object>> Recall(string query, int maxResults = 10, int floodHops = 3)
        {
            // Encode query
            var queryExperience = new Dictionary<string, object>
            {
                { "content", query },
                { "emotion", 0.5f },
                { "emotion_type", "neutral" },
                { "importance", 0.5f }
            };
            var queryPattern = _encoder.Encode(queryExperience);

            // Pattern matching
            var patternMatches = _engrams.Values
                .Select(e => (e.MemoryId, Similarity: _encoder.Similarity(queryPattern, e.Pattern)))
                .Where(x => x.Similarity > 0.3f)
                .OrderByDescending(x => x.Similarity)
                .ToList();

            // Mesh flooding (ADHD-style spread)
            var activated = new Dictionary<string, float>();
            foreach (var (memoryId, similarity) in patternMatches.Take(5))
            {
                var floodResults = _mesh.FloodFromNode(memoryId, floodHops, 0.7f);
                foreach (var (floodId, activation) in floodResults)
                {
                    var weightedActivation = activation * similarity;
                    if (activated.ContainsKey(floodId))
                        activated[floodId] = Math.Max(activated[floodId], weightedActivation);
                    else
                        activated[floodId] = weightedActivation;
                }
            }

            // Rank and return
            return activated.OrderByDescending(x => x.Value)
                           .Take(maxResults)
                           .Select(x =>
                           {
                               var engram = _engrams[x.Key];
                               engram.TimesAccessed++;
                               engram.LastAccessed = DateTime.Now;
                               SaveEngram(engram);

                               return new Dictionary<string, object>
                               {
                                   { "memory_id", engram.MemoryId },
                                   { "content", engram.SemanticContent },
                                   { "timestamp", engram.Timestamp },
                                   { "emotional_intensity", engram.EmotionalIntensity },
                                   { "importance", engram.PersonalSignificance },
                                   { "relevance_score", x.Value },
                                   { "tier", engram.Tier.ToString() }
                               };
                           })
                           .ToList();
        }

        private void CreateAssociations(Engram newEngram)
        {
            foreach (var (memoryId, existing) in _engrams)
            {
                if (memoryId == newEngram.MemoryId) continue;

                var similarity = _encoder.Similarity(newEngram.Pattern, existing.Pattern);
                if (similarity > 0.3f)
                    _mesh.Connect(newEngram.MemoryId, memoryId, similarity);
            }
        }

        private void SaveEngram(Engram engram)
        {
            var path = Path.Combine(_memoryPath, "engrams", $"{engram.MemoryId}.json");
            var json = JsonSerializer.Serialize(engram, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(path, json);
        }

        private void LoadAllEngrams()
        {
            var engramsPath = Path.Combine(_memoryPath, "engrams");
            if (!Directory.Exists(engramsPath)) return;

            foreach (var file in Directory.GetFiles(engramsPath, "*.json"))
            {
                try
                {
                    var json = File.ReadAllText(file);
                    var engram = JsonSerializer.Deserialize<Engram>(json);
                    if (engram != null)
                    {
                        _engrams[engram.MemoryId] = engram;
                        _mesh.AddNode(engram);

                        foreach (var (connId, strength) in engram.Connections)
                            _mesh.Connect(engram.MemoryId, connId, strength);
                    }
                }
                catch { }
            }
        }

        private string GenerateId(Dictionary<string, object> experience)
        {
            var content = JsonSerializer.Serialize(experience) + DateTime.Now.ToString("O");
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(content));
            return BitConverter.ToString(hash).Replace("-", "").Substring(0, 16).ToLower();
        }

        public int GetMemoryCount() => _engrams.Count;
        public int GetConnectionCount() => _mesh.Connections.Sum(x => x.Value.Count) / 2;

        // =========================================================================
        // COMPATIBILITY METHODS - Added for interface consistency
        // =========================================================================

        /// <summary>
        /// Consolidate memories (strengthen connections, prune weak ones)
        /// </summary>
        public void Consolidate()
        {
            // Strengthen frequently accessed connections, prune weak ones
            foreach (var node in _mesh.Connections.Keys.ToList())
            {
                var connections = _mesh.Connections[node];
                foreach (var (target, strength) in connections.ToList())
                {
                    // Decay weak connections
                    if (strength < 0.1f)
                    {
                        connections.Remove(target);
                    }
                }
            }
            Console.WriteLine($"[MEMORY]: Consolidated {_engrams.Count} memories");
        }

        /// <summary>
        /// Store a memory asynchronously
        /// </summary>
        public async Task<string> StoreMemoryAsync(string content, string category = "general", Dictionary<string, object>? metadata = null)
        {
            var experience = new Dictionary<string, object>
            {
                ["content"] = content,
                ["category"] = category,
                ["timestamp"] = DateTime.Now
            };

            if (metadata != null)
            {
                foreach (var kv in metadata)
                    experience[kv.Key] = kv.Value;
            }

            return await Task.FromResult(Store(experience));
        }

        /// <summary>
        /// Store a memory asynchronously - overload accepting Dictionary directly
        /// </summary>
        public async Task<string> StoreMemoryAsync(Dictionary<string, object> experience)
        {
            return await Task.FromResult(Store(experience));
        }

        /// <summary>
        /// Get all engrams
        /// </summary>
        public List<Engram> GetEngrams() => _engrams.Values.ToList();

        /// <summary>
        /// Recall similar memories asynchronously - returns engrams matching query
        /// Uses 'limit' named parameter for compatibility with AuraMetaOS calls
        /// </summary>
        public async Task<List<Engram>> RecallSimilarAsync(string query, int limit = 10)
        {
            // Get matching engram IDs from Recall 
            var results = Recall(query, limit);
            
            // Convert dictionary results back to engrams
            var engrams = results
                .Where(r => r.ContainsKey("memory_id"))
                .Select(r => _engrams.GetValueOrDefault(r["memory_id"]?.ToString() ?? ""))
                .Where(e => e != null)
                .ToList();
            
            return await Task.FromResult(engrams);
        }
        
        /// <summary>
        /// Add Metadata property to Engram for compatibility with AuraMetaOS code
        /// </summary>
        public Dictionary<string, object> GetEngramMetadata(Engram engram)
        {
            return new Dictionary<string, object>
            {
                ["memory_id"] = engram.MemoryId,
                ["content"] = engram.SemanticContent,
                ["timestamp"] = engram.Timestamp,
                ["tier"] = engram.Tier.ToString()
            };
        }
    }
}
