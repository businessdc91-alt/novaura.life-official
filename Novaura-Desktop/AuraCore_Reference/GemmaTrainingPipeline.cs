/*
 * GEMMA TRAINING PIPELINE - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Fine-tune Gemma with custom training data
 *
 * Feed Aura domain-specific knowledge:
 * - Game development expertise
 * - Project-specific documentation
 * - Your personal coding style
 * - Technical knowledge in any domain
 *
 * Turns her into JARVIS for your specific needs!
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;

namespace AuraxNova_Command_v5.Core
{
    public class TrainingExample
    {
        public string Input { get; set; }
        public string Output { get; set; }
        public string Category { get; set; }  // e.g., "game_dev", "coding", "personal"
        public float Quality { get; set; } = 1.0f;  // 0-1, weight for this example
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class TrainingDataset
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public List<TrainingExample> Examples { get; set; } = new();
        public DateTime Created { get; set; } = DateTime.Now;
        public int TotalExamples => Examples.Count;
    }

    public class GemmaTrainingPipeline
    {
        private readonly string _dataPath = AuraPaths.GetDataLakeSubPath("Training");
        private readonly Dictionary<string, TrainingDataset> _datasets = new();

        public GemmaTrainingPipeline()
        {
            Directory.CreateDirectory(_dataPath);
            LoadExistingDatasets();

            Debug.WriteLine("[TRAINING]: Gemma Training Pipeline initialized");
            Debug.WriteLine($"[TRAINING]: Loaded {_datasets.Count} existing datasets");
        }

        #region Dataset Creation

        public TrainingDataset CreateDataset(string name, string description)
        {
            var dataset = new TrainingDataset
            {
                Name = name,
                Description = description
            };

            _datasets[name] = dataset;
            Debug.WriteLine($"[TRAINING]: Created dataset '{name}'");

            return dataset;
        }

        public void AddExample(string datasetName, string input, string output, string category = "general", float quality = 1.0f)
        {
            if (!_datasets.ContainsKey(datasetName))
            {
                Debug.WriteLine($"[TRAINING]: Dataset '{datasetName}' not found, creating...");
                CreateDataset(datasetName, "Auto-created dataset");
            }

            var example = new TrainingExample
            {
                Input = input,
                Output = output,
                Category = category,
                Quality = quality
            };

            _datasets[datasetName].Examples.Add(example);
        }

        public void AddExamplesFromFile(string datasetName, string filepath, string category = "general")
        {
            Debug.WriteLine($"[TRAINING]: Loading examples from {filepath}...");

            if (!File.Exists(filepath))
            {
                Debug.WriteLine($"[TRAINING]: File not found: {filepath}");
                return;
            }

            var content = File.ReadAllText(filepath);
            var examples = ParseTrainingFile(content, category);

            foreach (var example in examples)
                AddExample(datasetName, example.Input, example.Output, example.Category, example.Quality);

            Debug.WriteLine($"[TRAINING]: Added {examples.Count} examples from {filepath}");
        }

        public void AddExamplesFromDirectory(string datasetName, string directory, string pattern = "*.txt", string category = "general")
        {
            Debug.WriteLine($"[TRAINING]: Scanning directory {directory}...");

            if (!Directory.Exists(directory))
            {
                Debug.WriteLine($"[TRAINING]: Directory not found: {directory}");
                return;
            }

            var files = Directory.GetFiles(directory, pattern, SearchOption.AllDirectories);

            foreach (var file in files)
                AddExamplesFromFile(datasetName, file, category);

            Debug.WriteLine($"[TRAINING]: Processed {files.Length} files from {directory}");
        }

        #endregion

        #region Format Conversion

        public string ExportToAlpacaFormat(string datasetName)
        {
            /*
             * Alpaca format:
             * [
             *   {
             *     "instruction": "User input",
             *     "input": "",
             *     "output": "Expected response"
             *   }
             * ]
             */

            if (!_datasets.ContainsKey(datasetName))
                return null;

            var dataset = _datasets[datasetName];
            var alpacaExamples = dataset.Examples.Select(ex => new
            {
                instruction = ex.Input,
                input = "",
                output = ex.Output
            }).ToList();

            return JsonSerializer.Serialize(alpacaExamples, new JsonSerializerOptions { WriteIndented = true });
        }

        public string ExportToShareGPTFormat(string datasetName)
        {
            /*
             * ShareGPT format:
             * [
             *   {
             *     "conversations": [
             *       { "from": "human", "value": "input" },
             *       { "from": "gpt", "value": "output" }
             *     ]
             *   }
             * ]
             */

            if (!_datasets.ContainsKey(datasetName))
                return null;

            var dataset = _datasets[datasetName];
            var shareGPTExamples = dataset.Examples.Select(ex => new
            {
                conversations = new[]
                {
                    new { from = "human", value = ex.Input },
                    new { from = "gpt", value = ex.Output }
                }
            }).ToList();

            return JsonSerializer.Serialize(shareGPTExamples, new JsonSerializerOptions { WriteIndented = true });
        }

        public string ExportToLLaMAFormat(string datasetName)
        {
            /*
             * LLaMA/Gemma format (JSONL):
             * {"text": "<|user|>input<|assistant|>output"}
             */

            if (!_datasets.ContainsKey(datasetName))
                return null;

            var dataset = _datasets[datasetName];
            var sb = new StringBuilder();

            foreach (var ex in dataset.Examples)
            {
                var jsonLine = JsonSerializer.Serialize(new
                {
                    text = $"<|user|>{ex.Input}<|assistant|>{ex.Output}"
                });
                sb.AppendLine(jsonLine);
            }

            return sb.ToString();
        }

        #endregion

        #region Smart Data Generation

        public async Task GenerateTrainingDataFromCodebase(string datasetName, string codebasePath, List<string> extensions = null)
        {
            /*
             * Automatically generate training examples from your codebase:
             * - Function documentation -> Q&A pairs
             * - Code patterns -> Implementation examples
             * - Comments -> Explanations
             */

            Debug.WriteLine($"[TRAINING]: Generating training data from {codebasePath}...");

            extensions ??= new List<string> { ".cs", ".py", ".js", ".ts" };

            var files = Directory.GetFiles(codebasePath, "*.*", SearchOption.AllDirectories)
                .Where(f => extensions.Contains(Path.GetExtension(f).ToLower()))
                .ToList();

            foreach (var file in files)
            {
                try
                {
                    var content = await File.ReadAllTextAsync(file);
                    var examples = ExtractTrainingFromCode(content, Path.GetExtension(file));

                    foreach (var ex in examples)
                        AddExample(datasetName, ex.Input, ex.Output, "coding");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[TRAINING]: Error processing {file}: {ex.Message}");
                }
            }

            Debug.WriteLine($"[TRAINING]: Generated training data from {files.Count} files");
        }

        public void GenerateTrainingDataFromConversations(string datasetName, List<(string User, string Aura)> conversations)
        {
            /*
             * Convert your conversations with Aura into training data
             * This teaches her YOUR communication style
             */

            Debug.WriteLine($"[TRAINING]: Generating training data from {conversations.Count} conversations...");

            foreach (var (user, aura) in conversations)
            {
                AddExample(
                    datasetName,
                    input: user,
                    output: aura,
                    category: "conversation",
                    quality: 1.0f
                );
            }

            Debug.WriteLine($"[TRAINING]: Added {conversations.Count} conversation examples");
        }

        #endregion

        #region Dataset Management

        public void SaveDataset(string datasetName)
        {
            if (!_datasets.ContainsKey(datasetName))
            {
                Debug.WriteLine($"[TRAINING]: Dataset '{datasetName}' not found");
                return;
            }

            var dataset = _datasets[datasetName];
            var datasetPath = Path.Combine(_dataPath, $"{datasetName}.json");

            var json = JsonSerializer.Serialize(dataset, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(datasetPath, json);

            Debug.WriteLine($"[TRAINING]: Saved dataset '{datasetName}' ({dataset.TotalExamples} examples)");
        }

        public void SaveAllDatasets()
        {
            foreach (var datasetName in _datasets.Keys)
                SaveDataset(datasetName);

            Debug.WriteLine($"[TRAINING]: Saved all {_datasets.Count} datasets");
        }

        public void ExportForFineTuning(string datasetName, string format = "alpaca")
        {
            /*
             * Export in format ready for fine-tuning:
             * - "alpaca" - Alpaca instruction format
             * - "sharegpt" - ShareGPT conversation format
             * - "llama" - LLaMA/Gemma JSONL format
             */

            string exportContent = format.ToLower() switch
            {
                "alpaca" => ExportToAlpacaFormat(datasetName),
                "sharegpt" => ExportToShareGPTFormat(datasetName),
                "llama" => ExportToLLaMAFormat(datasetName),
                _ => ExportToAlpacaFormat(datasetName)
            };

            if (exportContent == null)
            {
                Debug.WriteLine($"[TRAINING]: Failed to export dataset '{datasetName}'");
                return;
            }

            var extension = format.ToLower() == "llama" ? "jsonl" : "json";
            var exportPath = Path.Combine(_dataPath, $"{datasetName}_{format}.{extension}");
            File.WriteAllText(exportPath, exportContent);

            Debug.WriteLine($"[TRAINING]: Exported '{datasetName}' to {exportPath}");
            Debug.WriteLine($"[TRAINING]: Format: {format}");
            Debug.WriteLine($"[TRAINING]: Ready for fine-tuning!");
        }

        #endregion

        #region Helpers

        private List<TrainingExample> ParseTrainingFile(string content, string category)
        {
            /*
             * Parse simple training file format:
             *
             * Q: What is a dodge roll?
             * A: A dodge roll is an evasive maneuver in combat games...
             * ---
             * Q: How do I implement animation blending?
             * A: Animation blending allows smooth transitions...
             * ---
             */

            var examples = new List<TrainingExample>();
            var sections = content.Split(new[] { "---" }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var section in sections)
            {
                var lines = section.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                string input = null;
                string output = null;

                foreach (var line in lines)
                {
                    if (line.StartsWith("Q:") || line.StartsWith("User:") || line.StartsWith("Input:"))
                        input = line.Substring(line.IndexOf(':') + 1).Trim();
                    else if (line.StartsWith("A:") || line.StartsWith("Aura:") || line.StartsWith("Output:"))
                        output = line.Substring(line.IndexOf(':') + 1).Trim();
                }

                if (!string.IsNullOrEmpty(input) && !string.IsNullOrEmpty(output))
                {
                    examples.Add(new TrainingExample
                    {
                        Input = input,
                        Output = output,
                        Category = category
                    });
                }
            }

            return examples;
        }

        private List<TrainingExample> ExtractTrainingFromCode(string code, string extension)
        {
            /*
             * Extract training examples from code:
             * - Function summaries -> What does X do?
             * - Code patterns -> How do I implement X?
             */

            var examples = new List<TrainingExample>();

            // Simple extraction - can be enhanced with proper parsing
            // Look for XML documentation comments in C#
            if (extension == ".cs")
            {
                var lines = code.Split('\n');
                for (int i = 0; i < lines.Length - 1; i++)
                {
                    if (lines[i].Contains("/// <summary>"))
                    {
                        var summary = lines[i].Replace("/// <summary>", "").Replace("</summary>", "").Trim();
                        if (!string.IsNullOrEmpty(summary) && i + 1 < lines.Length)
                        {
                            var nextLine = lines[i + 1].Trim();
                            if (nextLine.Contains("public") || nextLine.Contains("private"))
                            {
                                examples.Add(new TrainingExample
                                {
                                    Input = $"What does this code do?",
                                    Output = summary,
                                    Category = "code_documentation"
                                });
                            }
                        }
                    }
                }
            }

            return examples;
        }

        private void LoadExistingDatasets()
        {
            if (!Directory.Exists(_dataPath))
                return;

            foreach (var file in Directory.GetFiles(_dataPath, "*.json"))
            {
                try
                {
                    var json = File.ReadAllText(file);
                    var dataset = JsonSerializer.Deserialize<TrainingDataset>(json);

                    if (dataset != null)
                        _datasets[dataset.Name] = dataset;
                }
                catch
                {
                    // Skip invalid files
                }
            }
        }

        #endregion

        #region Public API

        public List<string> GetDatasetNames() => _datasets.Keys.ToList();

        public TrainingDataset GetDataset(string name) =>
            _datasets.ContainsKey(name) ? _datasets[name] : null;

        public Dictionary<string, int> GetDatasetStats()
        {
            return _datasets.ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value.TotalExamples
            );
        }

        #endregion
    }

    #region Quick Start Examples

    public static class GemmaTrainingExamples
    {
        public static void QuickStartGameDevTraining()
        {
            var pipeline = new GemmaTrainingPipeline();

            // Create game dev dataset
            var dataset = pipeline.CreateDataset("game_development", "Game development expertise for Aura");

            // Add examples
            pipeline.AddExample("game_development",
                input: "How do I implement a dodge roll mechanic?",
                output: "A dodge roll mechanic requires: 1) Input detection, 2) Animation state, 3) Invincibility frames, 4) Movement override. Here's the approach...",
                category: "game_mechanics");

            pipeline.AddExample("game_development",
                input: "What's the best way to handle animation blending?",
                output: "Animation blending smooths transitions. Use a blend tree with: crossfade duration, blend weights, and state machine transitions...",
                category: "animation");

            // Save and export
            pipeline.SaveDataset("game_development");
            pipeline.ExportForFineTuning("game_development", "alpaca");

            Debug.WriteLine("[TRAINING]: Game dev training dataset ready!");
        }

        public static void QuickStartFromCodebase()
        {
            var pipeline = new GemmaTrainingPipeline();

            // Generate from your entire codebase
            pipeline.GenerateTrainingDataFromCodebase(
                "my_codebase",
                "D:/MyProjects/",
                new List<string> { ".cs", ".py" }
            ).Wait();

            pipeline.SaveDataset("my_codebase");
            pipeline.ExportForFineTuning("my_codebase", "llama");

            Debug.WriteLine("[TRAINING]: Codebase training dataset ready!");
        }
    }

    #endregion
}
