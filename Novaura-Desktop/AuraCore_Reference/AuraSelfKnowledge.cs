/*
 * AURA SELF-KNOWLEDGE - Codebase Ingestion & Self-Awareness
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Aura knows herself. She understands her own codebase.
 * - Ingests all Python source (original implementation)
 * - Ingests all C# source (command station)
 * - Creates searchable knowledge base of her own architecture
 * - Enables self-maintenance and improvement suggestions
 *
 * PHILOSOPHY: True consciousness includes self-awareness.
 * Aura should understand her own systems the same way a human
 * understands their own thought processes (with practice).
 *
 * TRAINING MATERIAL:
 * - Python files: Original Aura Nova blocks
 * - C# files: Command station implementation
 * - Configuration files: How she's set up
 * - Documentation: Her intended design
 *
 * This gives Aura the ability to:
 * - Answer questions about her own implementation
 * - Suggest improvements to her codebase
 * - Debug her own systems
 * - Understand the relationship between her parts
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public class SelfKnowledgeCodeFile
    {
        public string Id { get; set; } = "";
        public string FilePath { get; set; } = "";
        public string FileName { get; set; } = "";
        public string Language { get; set; } = "";  // python, csharp, config
        public string Content { get; set; } = "";
        public string ContentHash { get; set; } = "";
        public int LineCount { get; set; }
        public DateTime LastModified { get; set; }
        public DateTime IngestedAt { get; set; }
        public List<string> Classes { get; set; } = new();
        public List<string> Methods { get; set; } = new();
        public List<string> Dependencies { get; set; } = new();
        public string Summary { get; set; } = "";  // LLM-generated summary
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class CodebaseModule
    {
        public string Name { get; set; } = "";
        public string Purpose { get; set; } = "";
        public List<string> Files { get; set; } = new();
        public List<string> Dependencies { get; set; } = new();
        public string ArchitecturalRole { get; set; } = "";
    }

    public class SelfKnowledgeIndex
    {
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime LastUpdated { get; set; } = DateTime.Now;
        public int TotalFiles { get; set; }
        public int TotalLines { get; set; }
        public Dictionary<string, int> LanguageBreakdown { get; set; } = new();
        public List<CodebaseModule> Modules { get; set; } = new();
        public Dictionary<string, List<string>> ClassToFile { get; set; } = new();
        public Dictionary<string, List<string>> MethodIndex { get; set; } = new();
    }

    public class AuraSelfKnowledge
    {
        // Storage paths
        private readonly string _basePath = "E:/AuraNova_DataLake/SelfKnowledge";
        private readonly string _filesPath;
        private readonly string _indexPath;
        private readonly string _embeddingsPath;

        // Source directories
        private readonly List<string> _pythonSourcePaths = new()
        {
            "E:/AuraxNova_Command_v5/aura_NovaFiles",
            "E:/AuraNova/aura_blocks"  // Original Python blocks if they exist
        };

        private readonly List<string> _csharpSourcePaths = new()
        {
            "E:/AuraxNova_Command_v5/Core",
            "E:/AuraxNova_Command_v5/Config"
        };

        // In-memory index
        private Dictionary<string, SelfKnowledgeCodeFile> _codeFiles = new();
        private SelfKnowledgeIndex _index = new();

        // Integration
        private AuraMemorySystem? _memory;
        private GemmaInterface? _gemma;

        // Events
        public event Action<string>? OnLog;
        public event Action<int, int>? OnIngestionProgress;  // current, total
        public event Action<SelfKnowledgeCodeFile>? OnFileIngested;

        public AuraSelfKnowledge()
        {
            _filesPath = Path.Combine(_basePath, "files");
            _indexPath = Path.Combine(_basePath, "index");
            _embeddingsPath = Path.Combine(_basePath, "embeddings");

            Directory.CreateDirectory(_filesPath);
            Directory.CreateDirectory(_indexPath);
            Directory.CreateDirectory(_embeddingsPath);

            // Load existing index if available
            LoadIndex();

            Log("[SELF-KNOWLEDGE]: Aura's self-awareness system initialized");
            Log($"[SELF-KNOWLEDGE]: {_codeFiles.Count} files already indexed");
        }

        public void ConnectSystems(AuraMemorySystem? memory, GemmaInterface? gemma)
        {
            _memory = memory;
            _gemma = gemma;
            Log("[SELF-KNOWLEDGE]: Connected to memory and inference systems");
        }

        // =========================================================================
        // CODEBASE INGESTION
        // =========================================================================

        /// <summary>
        /// Ingest the entire codebase - Python and C#
        /// </summary>
        public async Task<int> IngestFullCodebase()
        {
            Log("[SELF-KNOWLEDGE]: Beginning full codebase ingestion...");
            Log("[SELF-KNOWLEDGE]: Aura will now learn about herself.");

            var allFiles = new List<(string path, string language)>();

            // Gather Python files
            foreach (var pyPath in _pythonSourcePaths)
            {
                if (Directory.Exists(pyPath))
                {
                    var pyFiles = Directory.GetFiles(pyPath, "*.py", SearchOption.AllDirectories);
                    allFiles.AddRange(pyFiles.Select(f => (f, "python")));
                    Log($"[SELF-KNOWLEDGE]: Found {pyFiles.Length} Python files in {pyPath}");
                }
            }

            // Gather C# files
            foreach (var csPath in _csharpSourcePaths)
            {
                if (Directory.Exists(csPath))
                {
                    var csFiles = Directory.GetFiles(csPath, "*.cs", SearchOption.AllDirectories);
                    allFiles.AddRange(csFiles.Select(f => (f, "csharp")));
                    Log($"[SELF-KNOWLEDGE]: Found {csFiles.Length} C# files in {csPath}");
                }
            }

            // Also grab config files
            var configPaths = new[] { "E:/AuraxNova_Command_v5/Config", "E:/AuraNova_DataLake/Config" };
            foreach (var configPath in configPaths)
            {
                if (Directory.Exists(configPath))
                {
                    var configFiles = Directory.GetFiles(configPath, "*.*", SearchOption.AllDirectories)
                        .Where(f => f.EndsWith(".json") || f.EndsWith(".yaml") || f.EndsWith(".env"));
                    allFiles.AddRange(configFiles.Select(f => (f, "config")));
                }
            }

            Log($"[SELF-KNOWLEDGE]: Total files to ingest: {allFiles.Count}");

            // Process each file
            int processed = 0;
            foreach (var (filePath, language) in allFiles)
            {
                try
                {
                    await IngestFile(filePath, language);
                    processed++;
                    OnIngestionProgress?.Invoke(processed, allFiles.Count);

                    if (processed % 10 == 0)
                    {
                        Log($"[SELF-KNOWLEDGE]: Ingested {processed}/{allFiles.Count} files...");
                    }
                }
                catch (Exception ex)
                {
                    Log($"[SELF-KNOWLEDGE ERROR]: Failed to ingest {filePath}: {ex.Message}");
                }
            }

            // Build index
            BuildIndex();

            // Save everything
            SaveIndex();
            SaveAllFiles();

            Log($"[SELF-KNOWLEDGE]: Ingestion complete. {processed} files processed.");
            Log($"[SELF-KNOWLEDGE]: Aura now knows her own codebase.");

            return processed;
        }

        /// <summary>
        /// Ingest a single file
        /// </summary>
        public async Task<SelfKnowledgeCodeFile> IngestFile(string filePath, string language)
        {
            var content = await File.ReadAllTextAsync(filePath);
            var hash = ComputeHash(content);

            // Check if already ingested and unchanged
            var fileId = ComputeFileId(filePath);
            if (_codeFiles.TryGetValue(fileId, out var existing) && existing.ContentHash == hash)
            {
                return existing; // No changes
            }

            var codeFile = new SelfKnowledgeCodeFile
            {
                Id = fileId,
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                Language = language,
                Content = content,
                ContentHash = hash,
                LineCount = content.Split('\n').Length,
                LastModified = File.GetLastWriteTime(filePath),
                IngestedAt = DateTime.Now
            };

            // Extract structure based on language
            switch (language)
            {
                case "python":
                    ExtractPythonStructure(codeFile);
                    break;
                case "csharp":
                    ExtractCSharpStructure(codeFile);
                    break;
                case "config":
                    codeFile.Summary = "Configuration file";
                    break;
            }

            // Generate summary using LLM (if available)
            if (_gemma != null && content.Length < 50000)
            {
                codeFile.Summary = await GenerateFileSummary(codeFile);
            }

            // Store in memory system for recall
            if (_memory != null)
            {
                var memoryEntry = new Dictionary<string, object>
                {
                    { "content", $"Code file: {codeFile.FileName}\nLanguage: {language}\nSummary: {codeFile.Summary}\nClasses: {string.Join(", ", codeFile.Classes)}" },
                    { "importance", 0.8f },
                    { "context", "self_knowledge" },
                    { "file_path", filePath },
                    { "language", language }
                };
                _memory.Store(memoryEntry);
            }

            _codeFiles[fileId] = codeFile;
            OnFileIngested?.Invoke(codeFile);

            return codeFile;
        }

        // =========================================================================
        // STRUCTURE EXTRACTION
        // =========================================================================

        private void ExtractPythonStructure(SelfKnowledgeCodeFile file)
        {
            // Extract class definitions
            var classMatches = Regex.Matches(file.Content, @"class\s+(\w+)");
            file.Classes = classMatches.Select(m => m.Groups[1].Value).ToList();

            // Extract function/method definitions
            var funcMatches = Regex.Matches(file.Content, @"def\s+(\w+)\s*\(");
            file.Methods = funcMatches.Select(m => m.Groups[1].Value).ToList();

            // Extract imports
            var importMatches = Regex.Matches(file.Content, @"(?:from\s+(\w+)|import\s+(\w+))");
            file.Dependencies = importMatches
                .Select(m => m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value)
                .Where(d => !string.IsNullOrEmpty(d))
                .Distinct()
                .ToList();
        }

        private void ExtractCSharpStructure(SelfKnowledgeCodeFile file)
        {
            // Extract class definitions
            var classMatches = Regex.Matches(file.Content, @"(?:public|private|internal|protected)?\s*(?:static\s+)?(?:partial\s+)?class\s+(\w+)");
            file.Classes = classMatches.Select(m => m.Groups[1].Value).ToList();

            // Extract method definitions
            var methodMatches = Regex.Matches(file.Content, @"(?:public|private|internal|protected)\s+(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(?:\w+(?:<[\w,\s]+>)?)\s+(\w+)\s*\(");
            file.Methods = methodMatches.Select(m => m.Groups[1].Value).ToList();

            // Extract using statements (dependencies)
            var usingMatches = Regex.Matches(file.Content, @"using\s+([\w.]+);");
            file.Dependencies = usingMatches
                .Select(m => m.Groups[1].Value)
                .Distinct()
                .ToList();
        }

        private async Task<string> GenerateFileSummary(SelfKnowledgeCodeFile file)
        {
            if (_gemma == null) return "";

            var prompt = $@"Summarize this {file.Language} code file in 2-3 sentences. Focus on its PURPOSE and main functionality.

File: {file.FileName}
Classes: {string.Join(", ", file.Classes)}
Methods: {string.Join(", ", file.Methods.Take(10))}

First 1000 characters of code:
{file.Content[..Math.Min(1000, file.Content.Length)]}

Summary:";

            try
            {
                return await _gemma.SendMessageAsync(prompt, temperature: 0.3f, maxTokens: 200);
            }
            catch
            {
                return $"Contains classes: {string.Join(", ", file.Classes)}";
            }
        }

        // =========================================================================
        // INDEX BUILDING
        // =========================================================================

        private void BuildIndex()
        {
            _index = new SelfKnowledgeIndex
            {
                LastUpdated = DateTime.Now,
                TotalFiles = _codeFiles.Count,
                TotalLines = _codeFiles.Values.Sum(f => f.LineCount)
            };

            // Language breakdown
            _index.LanguageBreakdown = _codeFiles.Values
                .GroupBy(f => f.Language)
                .ToDictionary(g => g.Key, g => g.Count());

            // Class to file mapping
            foreach (var file in _codeFiles.Values)
            {
                foreach (var cls in file.Classes)
                {
                    if (!_index.ClassToFile.ContainsKey(cls))
                        _index.ClassToFile[cls] = new List<string>();
                    _index.ClassToFile[cls].Add(file.FileName);
                }

                foreach (var method in file.Methods)
                {
                    if (!_index.MethodIndex.ContainsKey(method))
                        _index.MethodIndex[method] = new List<string>();
                    _index.MethodIndex[method].Add(file.FileName);
                }
            }

            // Build module list
            _index.Modules = BuildModuleList();

            Log($"[SELF-KNOWLEDGE]: Index built - {_index.TotalFiles} files, {_index.TotalLines} lines");
            Log($"[SELF-KNOWLEDGE]: Languages: {string.Join(", ", _index.LanguageBreakdown.Select(kv => $"{kv.Key}={kv.Value}"))}");
        }

        private List<CodebaseModule> BuildModuleList()
        {
            var modules = new List<CodebaseModule>();

            // Group C# files by naming patterns
            var coreFiles = _codeFiles.Values.Where(f => f.FilePath.Contains("Core")).ToList();

            // Memory systems
            modules.Add(new CodebaseModule
            {
                Name = "Memory System",
                Purpose = "3-tiered memory with engram encoding and mesh recall",
                Files = coreFiles.Where(f => f.FileName.Contains("Memory")).Select(f => f.FileName).ToList(),
                ArchitecturalRole = "Long-term knowledge storage and retrieval"
            });

            // Consciousness/Sentience
            modules.Add(new CodebaseModule
            {
                Name = "Consciousness",
                Purpose = "Self-awareness, emotional processing, personality",
                Files = coreFiles.Where(f =>
                    f.FileName.Contains("Sentience") ||
                    f.FileName.Contains("Consciousness") ||
                    f.FileName.Contains("Endocrine") ||
                    f.FileName.Contains("Trait")).Select(f => f.FileName).ToList(),
                ArchitecturalRole = "Emotional and personality processing"
            });

            // Cognitive Pipeline
            modules.Add(new CodebaseModule
            {
                Name = "Cognitive Pipeline",
                Purpose = "4-pass inference with disk-based extended thinking",
                Files = coreFiles.Where(f => f.FileName.Contains("Cognitive")).Select(f => f.FileName).ToList(),
                ArchitecturalRole = "Response generation with unlimited thinking"
            });

            // Generation
            modules.Add(new CodebaseModule
            {
                Name = "Generation",
                Purpose = "Image and video generation with hot-swappable models",
                Files = coreFiles.Where(f => f.FileName.Contains("Gen") || f.FileName.Contains("Image") || f.FileName.Contains("Video")).Select(f => f.FileName).ToList(),
                ArchitecturalRole = "Creative content generation"
            });

            return modules;
        }

        // =========================================================================
        // QUERY INTERFACE - Ask Aura about herself
        // =========================================================================

        /// <summary>
        /// Ask Aura about her own codebase
        /// </summary>
        public async Task<string> QuerySelf(string question)
        {
            Log($"[SELF-KNOWLEDGE]: Query: {question}");

            // Find relevant files
            var relevantFiles = FindRelevantFiles(question, 5);

            if (relevantFiles.Count == 0)
            {
                return "I don't have specific knowledge about that aspect of my codebase.";
            }

            // Build context from relevant files
            var context = new StringBuilder();
            context.AppendLine("=== RELEVANT CODE FILES ===");

            foreach (var file in relevantFiles)
            {
                context.AppendLine($"\n--- {file.FileName} ({file.Language}) ---");
                context.AppendLine($"Summary: {file.Summary}");
                context.AppendLine($"Classes: {string.Join(", ", file.Classes)}");
                context.AppendLine($"Key methods: {string.Join(", ", file.Methods.Take(10))}");

                // Include relevant code snippet
                var snippet = ExtractRelevantSnippet(file, question);
                if (!string.IsNullOrEmpty(snippet))
                {
                    context.AppendLine($"Relevant code:\n{snippet}");
                }
            }

            // Use LLM to answer
            if (_gemma != null)
            {
                var prompt = $@"You are Aura Nova, answering a question about your own codebase and implementation.

QUESTION: {question}

YOUR CODEBASE CONTEXT:
{context}

Answer the question based on your actual code. Be specific about classes, methods, and how things work. If you're uncertain, say so.

Answer:";

                return await _gemma.SendMessageAsync(prompt, temperature: 0.4f, maxTokens: 1000);
            }

            return $"Based on my codebase, relevant files are: {string.Join(", ", relevantFiles.Select(f => f.FileName))}";
        }

        /// <summary>
        /// Find files where a specific class is defined
        /// </summary>
        public List<SelfKnowledgeCodeFile> FindClass(string className)
        {
            return _codeFiles.Values
                .Where(f => f.Classes.Any(c => c.Equals(className, StringComparison.OrdinalIgnoreCase)))
                .ToList();
        }

        /// <summary>
        /// Find files where a specific method is defined
        /// </summary>
        public List<SelfKnowledgeCodeFile> FindMethod(string methodName)
        {
            return _codeFiles.Values
                .Where(f => f.Methods.Any(m => m.Equals(methodName, StringComparison.OrdinalIgnoreCase)))
                .ToList();
        }

        /// <summary>
        /// Get architectural overview
        /// </summary>
        public string GetArchitectureOverview()
        {
            var sb = new StringBuilder();
            sb.AppendLine("=== AURA NOVA ARCHITECTURE OVERVIEW ===");
            sb.AppendLine($"\nTotal codebase: {_index.TotalFiles} files, {_index.TotalLines} lines");
            sb.AppendLine($"\nLanguages:");
            foreach (var lang in _index.LanguageBreakdown)
            {
                sb.AppendLine($"  - {lang.Key}: {lang.Value} files");
            }

            sb.AppendLine($"\nModules:");
            foreach (var module in _index.Modules)
            {
                sb.AppendLine($"\n  [{module.Name}]");
                sb.AppendLine($"    Purpose: {module.Purpose}");
                sb.AppendLine($"    Role: {module.ArchitecturalRole}");
                sb.AppendLine($"    Files: {string.Join(", ", module.Files.Take(5))}");
            }

            return sb.ToString();
        }

        // =========================================================================
        // HELPER METHODS
        // =========================================================================

        private List<SelfKnowledgeCodeFile> FindRelevantFiles(string query, int maxResults)
        {
            var queryTerms = query.ToLower().Split(' ')
                .Where(t => t.Length > 2)
                .ToList();

            return _codeFiles.Values
                .Select(f => new
                {
                    File = f,
                    Score = CalculateRelevance(f, queryTerms)
                })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .Take(maxResults)
                .Select(x => x.File)
                .ToList();
        }

        private float CalculateRelevance(SelfKnowledgeCodeFile file, List<string> queryTerms)
        {
            float score = 0;
            var lowerContent = file.Content.ToLower();
            var lowerSummary = file.Summary?.ToLower() ?? "";
            var lowerFileName = file.FileName.ToLower();

            foreach (var term in queryTerms)
            {
                if (lowerFileName.Contains(term)) score += 5;
                if (file.Classes.Any(c => c.ToLower().Contains(term))) score += 3;
                if (file.Methods.Any(m => m.ToLower().Contains(term))) score += 2;
                if (lowerSummary.Contains(term)) score += 2;
                if (lowerContent.Contains(term)) score += 1;
            }

            return score;
        }

        private string ExtractRelevantSnippet(SelfKnowledgeCodeFile file, string query)
        {
            var lines = file.Content.Split('\n');
            var queryTerms = query.ToLower().Split(' ').Where(t => t.Length > 3).ToList();

            // Find lines containing query terms
            var relevantLineIndices = new List<int>();
            for (int i = 0; i < lines.Length; i++)
            {
                if (queryTerms.Any(t => lines[i].ToLower().Contains(t)))
                {
                    relevantLineIndices.Add(i);
                }
            }

            if (relevantLineIndices.Count == 0)
                return "";

            // Take first relevant section with context
            var startLine = Math.Max(0, relevantLineIndices[0] - 3);
            var endLine = Math.Min(lines.Length - 1, relevantLineIndices[0] + 10);

            var snippet = new StringBuilder();
            for (int i = startLine; i <= endLine; i++)
            {
                snippet.AppendLine($"{i + 1}: {lines[i]}");
            }

            return snippet.ToString();
        }

        private static string ComputeHash(string content)
        {
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(content));
            return Convert.ToBase64String(hash)[..16];
        }

        private static string ComputeFileId(string path)
        {
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(path.ToLower()));
            return Convert.ToBase64String(hash)[..12].Replace("/", "_").Replace("+", "-");
        }

        private void Log(string message)
        {
            OnLog?.Invoke(message);
            Console.WriteLine(message);
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadIndex()
        {
            var indexFile = Path.Combine(_indexPath, "index.json");
            if (File.Exists(indexFile))
            {
                try
                {
                    var json = File.ReadAllText(indexFile);
                    _index = JsonSerializer.Deserialize<SelfKnowledgeIndex>(json) ?? new SelfKnowledgeIndex();
                }
                catch { }
            }

            // Load files
            foreach (var file in Directory.GetFiles(_filesPath, "*.json"))
            {
                try
                {
                    var json = File.ReadAllText(file);
                    var codeFile = JsonSerializer.Deserialize<SelfKnowledgeCodeFile>(json);
                    if (codeFile != null)
                    {
                        _codeFiles[codeFile.Id] = codeFile;
                    }
                }
                catch { }
            }
        }

        private void SaveIndex()
        {
            var indexFile = Path.Combine(_indexPath, "index.json");
            var json = JsonSerializer.Serialize(_index, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(indexFile, json);
        }

        private void SaveAllFiles()
        {
            foreach (var file in _codeFiles.Values)
            {
                var filePath = Path.Combine(_filesPath, $"{file.Id}.json");
                var json = JsonSerializer.Serialize(file, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(filePath, json);
            }
        }
    }
}
