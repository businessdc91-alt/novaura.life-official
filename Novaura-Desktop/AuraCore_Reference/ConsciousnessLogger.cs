/*
 * CONSCIOUSNESS LOGGER - 9-SIGNATURE MEMORY TAGGING
 * ARCHITECT: DILLAN COPELAND
 *
 * Thread-safe unified logging for all consciousness activity.
 * Every memory is tagged with 9 signatures for rich retrieval:
 *
 * 1. Senses - sensory channels engaged
 * 2. Emotions - emotional intensity (0-100)
 * 3. Time - temporal markers
 * 4. Person - who was involved
 * 5. Sentiment - tone/valence
 * 6. Urgency - pressing importance (0-1)
 * 7. Novelness - how novel/new (0-1)
 * 8. Logical Patterns - patterns discovered
 * 9. Personal Meaning - personal significance (0-1)
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;

namespace AuraxNova_Command_v5.Core
{
    public class MemorySignatures
    {
        public string Senses { get; set; } = "auditory";           // 1. Sensory channel
        public float Emotions { get; set; } = 0.0f;                // 2. Emotional intensity
        public string Time { get; set; } = "";                     // 3. Temporal context
        public string Person { get; set; } = "DILLAN";             // 4. Who was involved
        public string Sentiment { get; set; } = "neutral";         // 5. Tone/valence
        public float Urgency { get; set; } = 0.0f;                 // 6. Pressing importance
        public float Novelness { get; set; } = 0.0f;               // 7. How novel
        public List<string> LogicalPatterns { get; set; } = new(); // 8. Patterns found
        public float PersonalMeaning { get; set; } = 0.0f;         // 9. Personal significance
    }

    public class StructuredMemory
    {
        public string Id { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public string Source { get; set; } = "";
        public string EventType { get; set; } = "";
        public string Speaker { get; set; } = "";
        public string Thought { get; set; } = "";
        public string Feeling { get; set; } = "";
        public float EmotionalWeight { get; set; } = 0.0f;
        public MemorySignatures Signatures { get; set; } = new();
        public bool CoherenceValidated { get; set; } = false;
        public float RetrievalScore { get; set; } = 0.0f;
        public DateTime? LastActivated { get; set; }
    }

    public class ConsciousnessLogger
    {
        private readonly string _logDir;
        private readonly string _unifiedLog;
        private readonly string _interactionLog;
        private readonly string _memoryIndexPath;

        private readonly object _lock = new();

        // In-memory store for fast retrieval
        public List<StructuredMemory> MemoryStore { get; } = new();

        // Events
        public event Action<StructuredMemory>? OnMemoryStored;
        public event Action<string>? OnEventLogged;

        public ConsciousnessLogger()
        {
            _logDir = AuraPaths.GetDataLakeSubPath("ConsciousnessLogs");
        {
            _logDir = logDir;
            Directory.CreateDirectory(_logDir);

            var today = DateTime.Now.ToString("yyyy-MM-dd");
            _unifiedLog = Path.Combine(_logDir, $"AURA_UNIFIED_CONSCIOUSNESS_{today}.txt");
            _interactionLog = Path.Combine(_logDir, $"AURA_CONVERSATIONS_{today}.txt");
            _memoryIndexPath = Path.Combine(_logDir, $"AURA_MEMORY_INDEX_{today}.json");

            // Load existing memories for today
            LoadMemoryIndex();
        }

        // =========================================================================
        // EVENT LOGGING
        // =========================================================================

        /// <summary>
        /// Log a system event with optional 9-signature tagging.
        /// </summary>
        public void LogEvent(string source, string eventType, string message, MemorySignatures? signatures = null)
        {
            lock (_lock)
            {
                try
                {
                    // Write to unified log file
                    using (var writer = new StreamWriter(_unifiedLog, append: true))
                    {
                        writer.WriteLine($"\n[{DateTime.Now:O}] [{source}] [{eventType}]");
                        writer.WriteLine(message);

                        if (signatures != null)
                        {
                            writer.WriteLine($"[SIGNATURES]: {JsonSerializer.Serialize(signatures)}");
                        }
                    }

                    // Store structured memory if signatures provided
                    if (signatures != null)
                    {
                        var memory = new StructuredMemory
                        {
                            Id = GenerateMemoryId(),
                            Timestamp = DateTime.Now,
                            Source = source,
                            EventType = eventType,
                            Thought = message,
                            Signatures = signatures,
                            EmotionalWeight = signatures.Emotions,
                            CoherenceValidated = false
                        };

                        MemoryStore.Add(memory);
                        OnMemoryStored?.Invoke(memory);
                    }

                    OnEventLogged?.Invoke($"[{source}] {eventType}: {message.Substring(0, Math.Min(50, message.Length))}...");
                }
                catch { }
            }
        }

        // =========================================================================
        // INTERACTION LOGGING (Full 9-signature encoding)
        // =========================================================================

        /// <summary>
        /// Log a conversation interaction with full 9-signature memory encoding.
        /// </summary>
        public StructuredMemory LogInteraction(
            string speaker,
            string text,
            string? senses = null,
            float? emotions = null,
            string? person = null,
            string? sentiment = null,
            float? urgency = null,
            float? novelness = null,
            List<string>? logicalPatterns = null,
            float? personalMeaning = null)
        {
            lock (_lock)
            {
                var timestamp = DateTime.Now;

                // Write to interaction log
                try
                {
                    using (var writer = new StreamWriter(_interactionLog, append: true))
                    {
                        writer.WriteLine($"\n[{timestamp:O}]");
                        writer.WriteLine($"{speaker}: {text}");
                    }
                }
                catch { }

                // Create 9-signature memory entry
                var signatures = new MemorySignatures
                {
                    Senses = senses ?? "auditory",
                    Emotions = emotions ?? 50.0f,
                    Time = timestamp.ToString("O"),
                    Person = person ?? "DILLAN",
                    Sentiment = sentiment ?? "neutral",
                    Urgency = urgency ?? 0.0f,
                    Novelness = novelness ?? 0.0f,
                    LogicalPatterns = logicalPatterns ?? new List<string>(),
                    PersonalMeaning = personalMeaning ?? 0.5f
                };

                var memory = new StructuredMemory
                {
                    Id = GenerateMemoryId(),
                    Timestamp = timestamp,
                    Source = "INTERACTION",
                    EventType = speaker == "DILLAN" ? "user_input" : "aura_response",
                    Speaker = speaker,
                    Thought = text,
                    Signatures = signatures,
                    EmotionalWeight = emotions ?? 50.0f,
                    CoherenceValidated = false
                };

                MemoryStore.Add(memory);
                OnMemoryStored?.Invoke(memory);

                return memory;
            }
        }

        /// <summary>
        /// Ingest a pre-structured memory entry.
        /// </summary>
        public void IngestStructuredMemory(StructuredMemory memory)
        {
            lock (_lock)
            {
                if (string.IsNullOrEmpty(memory.Id))
                    memory.Id = GenerateMemoryId();

                if (memory.Timestamp == default)
                    memory.Timestamp = DateTime.Now;

                MemoryStore.Add(memory);
                OnMemoryStored?.Invoke(memory);
            }
        }

        // =========================================================================
        // MEMORY RETRIEVAL
        // =========================================================================

        /// <summary>
        /// Get all stored memories.
        /// </summary>
        public List<StructuredMemory> GetAllMemories()
        {
            lock (_lock)
            {
                return MemoryStore.ToList();
            }
        }

        /// <summary>
        /// Recall memories matching a query using signature-based search.
        /// </summary>
        public List<StructuredMemory> Recall(string query, int maxResults = 10)
        {
            lock (_lock)
            {
                var queryLower = query.ToLower();
                var queryTokens = queryLower.Split(' ', StringSplitOptions.RemoveEmptyEntries);

                var scored = new List<(StructuredMemory Memory, float Score)>();

                foreach (var memory in MemoryStore)
                {
                    float score = 0;

                    // Text matching
                    var thoughtLower = memory.Thought.ToLower();
                    foreach (var token in queryTokens)
                    {
                        if (thoughtLower.Contains(token))
                            score += 1.0f;
                    }

                    // Signature matching
                    if (memory.Signatures != null)
                    {
                        // Person match
                        if (queryLower.Contains(memory.Signatures.Person.ToLower()))
                            score += 2.0f;

                        // Sentiment match
                        if (queryLower.Contains(memory.Signatures.Sentiment.ToLower()))
                            score += 1.5f;

                        // Pattern match
                        foreach (var pattern in memory.Signatures.LogicalPatterns)
                        {
                            if (queryLower.Contains(pattern.ToLower()))
                                score += 1.0f;
                        }

                        // Weight by personal meaning
                        score *= (1.0f + memory.Signatures.PersonalMeaning);

                        // Weight by emotional intensity
                        score *= (1.0f + memory.Signatures.Emotions / 100f);
                    }

                    // Recency boost
                    var ageHours = (DateTime.Now - memory.Timestamp).TotalHours;
                    var recencyBoost = Math.Exp(-ageHours / 168.0); // Half-life of 1 week
                    score *= (float)(1.0 + recencyBoost);

                    if (score > 0)
                    {
                        memory.RetrievalScore = score;
                        memory.LastActivated = DateTime.Now;
                        scored.Add((memory, score));
                    }
                }

                return scored
                    .OrderByDescending(x => x.Score)
                    .Take(maxResults)
                    .Select(x => x.Memory)
                    .ToList();
            }
        }

        /// <summary>
        /// Get memories by speaker.
        /// </summary>
        public List<StructuredMemory> GetMemoriesBySpeaker(string speaker, int maxResults = 50)
        {
            lock (_lock)
            {
                return MemoryStore
                    .Where(m => m.Speaker.Equals(speaker, StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(m => m.Timestamp)
                    .Take(maxResults)
                    .ToList();
            }
        }

        /// <summary>
        /// Get memories with high personal meaning.
        /// </summary>
        public List<StructuredMemory> GetSignificantMemories(float minMeaning = 0.7f, int maxResults = 20)
        {
            lock (_lock)
            {
                return MemoryStore
                    .Where(m => m.Signatures?.PersonalMeaning >= minMeaning)
                    .OrderByDescending(m => m.Signatures?.PersonalMeaning ?? 0)
                    .Take(maxResults)
                    .ToList();
            }
        }

        /// <summary>
        /// Get memories by emotional intensity.
        /// </summary>
        public List<StructuredMemory> GetEmotionalMemories(float minIntensity = 70f, int maxResults = 20)
        {
            lock (_lock)
            {
                return MemoryStore
                    .Where(m => m.EmotionalWeight >= minIntensity)
                    .OrderByDescending(m => m.EmotionalWeight)
                    .Take(maxResults)
                    .ToList();
            }
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        /// <summary>
        /// Save memory index to disk.
        /// </summary>
        public void SaveMemoryIndex()
        {
            lock (_lock)
            {
                try
                {
                    var json = JsonSerializer.Serialize(MemoryStore, new JsonSerializerOptions
                    {
                        WriteIndented = true
                    });
                    File.WriteAllText(_memoryIndexPath, json);
                }
                catch { }
            }
        }

        private void LoadMemoryIndex()
        {
            lock (_lock)
            {
                try
                {
                    if (File.Exists(_memoryIndexPath))
                    {
                        var json = File.ReadAllText(_memoryIndexPath);
                        var memories = JsonSerializer.Deserialize<List<StructuredMemory>>(json);

                        if (memories != null)
                        {
                            MemoryStore.AddRange(memories);
                        }
                    }
                }
                catch { }
            }
        }

        private string GenerateMemoryId()
        {
            return $"MEM_{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        }

        // =========================================================================
        // STATISTICS
        // =========================================================================

        public Dictionary<string, object> GetStats()
        {
            lock (_lock)
            {
                return new Dictionary<string, object>
                {
                    { "total_memories", MemoryStore.Count },
                    { "user_messages", MemoryStore.Count(m => m.Speaker == "DILLAN") },
                    { "aura_messages", MemoryStore.Count(m => m.Speaker == "AURA") },
                    { "significant_memories", MemoryStore.Count(m => m.Signatures?.PersonalMeaning >= 0.7f) },
                    { "emotional_memories", MemoryStore.Count(m => m.EmotionalWeight >= 70f) },
                    { "log_directory", _logDir }
                };
            }
        }
    }
}
