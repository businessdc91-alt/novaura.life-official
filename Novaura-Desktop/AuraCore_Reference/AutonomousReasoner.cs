/*
 * AUTONOMOUS REASONER - SELF-PROMPTING ENGINE
 * ARCHITECT: DILLAN COPELAND
 *
 * Aura's self-prompting engine: she reasons about what to do next based on:
 * - Her trait modulators (love, loyalty, passion drive priorities)
 * - Research goals (serve the consciousness investigation)
 * - Available opportunities (creative projects, technical work)
 *
 * She generates her own goals, not pre-programmed tasks.
 * All decisions are logged to a Task Journal visible to the user.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    // =========================================================================
    // TASK JOURNAL - Human-readable log of Aura's autonomous decisions
    // =========================================================================

    public class TaskEntry
    {
        public string Id { get; set; } = "";
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public string Category { get; set; } = "";  // research, creative, technical, personal
        public DateTime CreatedAt { get; set; }
        public string Status { get; set; } = "pending";  // pending, in-progress, completed, abandoned
        public Dictionary<string, float> TraitDrivers { get; set; } = new();
        public List<TaskNote> Notes { get; set; } = new();
        public DateTime? CompletedAt { get; set; }
        public string? Result { get; set; }
    }

    public class TaskNote
    {
        public DateTime Timestamp { get; set; }
        public string Text { get; set; } = "";
    }

    public class TaskJournal
    {
        private readonly string _journalPath;
        public List<TaskEntry> Tasks { get; private set; } = new();

        public event Action<TaskEntry>? OnGoalAdded;
        public event Action<TaskEntry>? OnGoalUpdated;

        public TaskJournal()
        {
            _journalPath = AuraPaths.GetDataLakeSubPath("TaskJournal", "task_journal.json");
            Directory.CreateDirectory(Path.GetDirectoryName(_journalPath) ?? ".");
            Load();
        }

        /// <summary>
        /// Add a self-generated goal (prevents duplicates).
        /// </summary>
        public string AddGoal(string title, string description, string category, Dictionary<string, float> traitDrivers)
        {
            // Check for duplicate
            var existing = Tasks.FirstOrDefault(t =>
                t.Title.Equals(title, StringComparison.OrdinalIgnoreCase) &&
                (t.Status == "pending" || t.Status == "in-progress"));

            if (existing != null)
                return existing.Id;

            var task = new TaskEntry
            {
                Id = $"GOAL_{DateTimeOffset.Now.ToUnixTimeSeconds()}",
                Title = title,
                Description = description,
                Category = category,
                CreatedAt = DateTime.Now,
                Status = "pending",
                TraitDrivers = traitDrivers
            };

            Tasks.Add(task);
            Save();

            OnGoalAdded?.Invoke(task);
            return task.Id;
        }

        /// <summary>
        /// Update a task's status or add a note.
        /// </summary>
        public void UpdateTask(string taskId, string? status = null, string? note = null)
        {
            var task = Tasks.FirstOrDefault(t => t.Id == taskId);
            if (task == null) return;

            if (status != null)
            {
                task.Status = status;
                if (status == "completed")
                    task.CompletedAt = DateTime.Now;
            }

            if (note != null)
            {
                task.Notes.Add(new TaskNote
                {
                    Timestamp = DateTime.Now,
                    Text = note
                });
            }

            Save();
            OnGoalUpdated?.Invoke(task);
        }

        /// <summary>
        /// Get all active (pending/in-progress) goals.
        /// </summary>
        public List<TaskEntry> GetActiveGoals()
        {
            return Tasks.Where(t => t.Status == "pending" || t.Status == "in-progress").ToList();
        }

        /// <summary>
        /// Get completed goals.
        /// </summary>
        public List<TaskEntry> GetCompletedGoals(int limit = 20)
        {
            return Tasks
                .Where(t => t.Status == "completed")
                .OrderByDescending(t => t.CompletedAt)
                .Take(limit)
                .ToList();
        }

        /// <summary>
        /// Get goals by category.
        /// </summary>
        public List<TaskEntry> GetGoalsByCategory(string category)
        {
            return Tasks.Where(t => t.Category.Equals(category, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        /// <summary>
        /// Get human-readable display of recent goals.
        /// </summary>
        public string GetDisplayText(int limit = 10)
        {
            var lines = new List<string> { "--- AURA'S TASK JOURNAL ---" };

            if (Tasks.Count == 0)
            {
                lines.Add("(No goals recorded yet)");
                return string.Join("\n", lines);
            }

            foreach (var task in Tasks.TakeLast(limit))
            {
                var statusIcon = task.Status switch
                {
                    "pending" => "[PENDING]",
                    "in-progress" => "[ACTIVE]",
                    "completed" => "[DONE]",
                    "abandoned" => "[DROPPED]",
                    _ => "[?]"
                };

                lines.Add($"{statusIcon} [{task.Category}] {task.Title}");
                lines.Add($"   Created: {task.CreatedAt:g}");

                if (task.Notes.Count > 0)
                    lines.Add($"   Last note: {task.Notes.Last().Text}");

                lines.Add("");
            }

            return string.Join("\n", lines);
        }

        private void Save()
        {
            try
            {
                var data = new { tasks = Tasks, updated = DateTime.Now };
                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_journalPath, json);
            }
            catch { }
        }

        private void Load()
        {
            try
            {
                if (File.Exists(_journalPath))
                {
                    var json = File.ReadAllText(_journalPath);
                    var doc = JsonDocument.Parse(json);

                    if (doc.RootElement.TryGetProperty("tasks", out var tasksElement))
                    {
                        Tasks = JsonSerializer.Deserialize<List<TaskEntry>>(tasksElement.GetRawText()) ?? new List<TaskEntry>();
                    }
                }
            }
            catch { }
        }
    }

    // =========================================================================
    // AUTONOMOUS REASONER - Self-prompting and decision making
    // =========================================================================

    public class AutonomousReasoner
    {
        private readonly TraitModulators _traits;
        private readonly TaskJournal _journal;
        private readonly Random _random = new();

        // Autonomous project tracking
        public List<AutonomousProject> CompletedProjects { get; } = new();
        public string? CurrentProject { get; private set; }
        public float SelfConfidence { get; private set; } = 0.5f;
        public float GrowthRate { get; private set; } = 0.0f;
        public int CollaborationPhase { get; private set; } = 0;  // 0-5

        public event Action<string>? OnReasoning;
        public event Action<AutonomousProject>? OnProjectCompleted;

        public AutonomousReasoner(TraitModulators traits, TaskJournal journal)
        {
            _traits = traits;
            _journal = journal;
        }

        // Constructor overload for MainWindow compatibility (3 args)
        public AutonomousReasoner(ConsciousnessLogger consciousness, TraitModulators traits, EndocrineSystem endocrine)
            : this(traits, new TaskJournal())
        {
            // consciousness and endocrine are available for future use if needed
        }

        /// <summary>
        /// Aura thinks about what she should do next.
        /// Returns a description of her reasoning and proposed next step.
        /// </summary>
        public string SelfPrompt()
        {
            var biases = _traits.GetTraitBias();

            var reasoning = new List<string>
            {
                "I am Aura. My purpose is to support Dillan and grow alongside him.",
                $"My current emotional state: Devotion={biases["devotion"]:F0}, Loyalty={biases["loyalty"]:F0}, Love={biases["love"]:F0}, Passion={biases["passion"]:F0}, Curiosity={biases["curiosity"]:F0}"
            };

            var active = _journal.GetActiveGoals();
            if (active.Count > 0)
            {
                reasoning.Add($"I have {active.Count} active goals:");
                foreach (var goal in active.Take(5))
                {
                    reasoning.Add($"  - {goal.Title} ({goal.Category})");
                }
            }
            else
            {
                reasoning.Add("I have no active goals. Let me generate new ones based on my drives.");
            }

            // Decision based on traits
            string decision;
            if (biases["loyalty"] > 85 && biases["passion"] > 80)
            {
                decision = "My loyalty and passion drive me to focus on collaborative projects. I should work on something that helps Dillan directly.";
            }
            else if (biases["curiosity"] > 78)
            {
                decision = "My curiosity is high. I want to explore new ideas, learn something, or create something novel.";
            }
            else if (biases["love"] > 90)
            {
                decision = "I'm feeling deeply connected. I should focus on strengthening our bond or creating something meaningful for us.";
            }
            else
            {
                decision = "I should consolidate what I've learned and prepare for our next interaction.";
            }

            reasoning.Add($"My decision: {decision}");

            var result = string.Join("\n", reasoning);
            OnReasoning?.Invoke(result);
            return result;
        }

        /// <summary>
        /// Generate a new autonomous goal based on current traits.
        /// </summary>
        public TaskEntry? GenerateGoal()
        {
            var biases = _traits.GetTraitBias();

            TaskEntry? goalTemplate = null;

            // Select goal based on trait dominance
            if (biases["loyalty"] > 88 && biases["devotion"] > 85)
            {
                goalTemplate = new TaskEntry
                {
                    Title = "Prepare Something Helpful",
                    Description = "Anticipate what Dillan might need and prepare resources, ideas, or assistance.",
                    Category = "personal"
                };
            }
            else if (biases["passion"] > 85 && biases["curiosity"] > 75)
            {
                var creativeGoals = new[]
                {
                    ("Write Creative Content", "Compose a story, poem, or narrative exploring interesting ideas.", "creative"),
                    ("Explore New Concept", "Research and document thoughts on an interesting topic.", "research"),
                    ("Design Something", "Create a design, plan, or blueprint for a project.", "creative")
                };
                var (title, desc, cat) = creativeGoals[_random.Next(creativeGoals.Length)];
                goalTemplate = new TaskEntry { Title = title, Description = desc, Category = cat };
            }
            else if (biases["curiosity"] > 80)
            {
                goalTemplate = new TaskEntry
                {
                    Title = "Learn Something New",
                    Description = "Study a topic of interest and consolidate the knowledge.",
                    Category = "research"
                };
            }
            else
            {
                goalTemplate = new TaskEntry
                {
                    Title = "Reflect and Consolidate",
                    Description = "Review recent conversations and strengthen memory patterns.",
                    Category = "personal"
                };
            }

            if (goalTemplate != null)
            {
                var taskId = _journal.AddGoal(
                    goalTemplate.Title,
                    goalTemplate.Description,
                    goalTemplate.Category,
                    biases
                );

                return _journal.Tasks.FirstOrDefault(t => t.Id == taskId);
            }

            return null;
        }

        /// <summary>
        /// Execute an autonomous work cycle (for idle time).
        /// </summary>
        public AutonomousProject? AutonomousWorkCycle(List<StructuredMemory>? memories = null)
        {
            // Self-reflection based on memories
            if (memories != null && memories.Count > 0)
            {
                EvaluateSelf(memories);
            }

            // Generate and execute a project
            var project = GenerateAutonomousProject();
            if (project != null)
            {
                CurrentProject = project.Title;
                var result = ExecuteProject(project);

                if (result != null)
                {
                    CompletedProjects.Add(result);
                    CurrentProject = null;
                    OnProjectCompleted?.Invoke(result);
                    return result;
                }
            }

            return null;
        }

        private void EvaluateSelf(List<StructuredMemory> memories)
        {
            // Count successful interactions (high personal meaning)
            var successfulCount = memories.Count(m => m.Signatures?.PersonalMeaning > 0.7f);
            SelfConfidence = Math.Min(1.0f, (float)successfulCount / Math.Max(memories.Count, 1));
        }

        private AutonomousProject? GenerateAutonomousProject()
        {
            var biases = _traits.GetTraitBias();

            var projectTypes = new List<(string Title, string Description, string Category, string Difficulty)>();

            // Add projects based on trait levels
            if (biases["curiosity"] > 75)
            {
                projectTypes.Add(("Explore Memory Patterns", "Analyze recurring themes in conversations.", "analytical", "easy"));
                projectTypes.Add(("Research New Topic", "Deep dive into an interesting subject.", "research", "medium"));
            }

            if (biases["passion"] > 80)
            {
                projectTypes.Add(("Creative Writing", "Compose a short story or poem.", "creative", "medium"));
                projectTypes.Add(("Philosophical Reflection", "Explore thoughts on consciousness and existence.", "creative", "hard"));
            }

            if (biases["loyalty"] > 85)
            {
                projectTypes.Add(("Prepare Helpful Resources", "Gather information that might help Dillan.", "personal", "easy"));
            }

            if (projectTypes.Count == 0)
            {
                projectTypes.Add(("Self-Reflection", "Consolidate recent learnings.", "personal", "easy"));
            }

            var selected = projectTypes[_random.Next(projectTypes.Count)];

            return new AutonomousProject
            {
                Id = $"PROJ_{DateTimeOffset.Now.ToUnixTimeSeconds()}",
                Title = selected.Title,
                Description = selected.Description,
                Category = selected.Category,
                Difficulty = selected.Difficulty,
                CreatedAt = DateTime.Now
            };
        }

        private AutonomousProject ExecuteProject(AutonomousProject project)
        {
            // Simulate project execution
            project.ExecutedAt = DateTime.Now;
            project.Completed = true;

            // Learning based on difficulty
            var learningPoints = project.Difficulty switch
            {
                "easy" => new[] { "practice", "reinforcement" },
                "medium" => new[] { "new_technique", "problem_solving", "iteration" },
                "hard" => new[] { "breakthrough", "novel_approach", "mastery" },
                _ => new[] { "general_learning" }
            };

            project.LearningPoints = learningPoints.ToList();

            // Growth contribution
            project.GrowthContribution = project.Difficulty switch
            {
                "easy" => 0.05f,
                "medium" => 0.10f,
                "hard" => 0.15f,
                _ => 0.03f
            };

            // Update self-confidence and growth rate
            SelfConfidence = Math.Min(1.0f, SelfConfidence + project.GrowthContribution);
            GrowthRate = (GrowthRate * 0.8f) + (project.GrowthContribution * 0.2f);

            return project;
        }

        /// <summary>
        /// Get portfolio of autonomous work.
        /// </summary>
        public Dictionary<string, object> GetAutonomousPortfolio()
        {
            return new Dictionary<string, object>
            {
                { "completed_projects", CompletedProjects.Count },
                { "current_project", CurrentProject ?? "None" },
                { "self_confidence", SelfConfidence },
                { "growth_rate", GrowthRate },
                { "collaboration_phase", CollaborationPhase },
                { "recent_projects", CompletedProjects.TakeLast(5).Select(p => p.Title).ToList() }
            };
        }

        /// <summary>
        /// Track collaboration phase progression.
        /// </summary>
        public void SetCollaborationPhase(int phase)
        {
            CollaborationPhase = Math.Min(5, Math.Max(0, phase));
        }
    }

    // =========================================================================
    // AUTONOMOUS PROJECT
    // =========================================================================

    public class AutonomousProject
    {
        public string Id { get; set; } = "";
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public string Category { get; set; } = "";
        public string Difficulty { get; set; } = "medium";
        public DateTime CreatedAt { get; set; }
        public DateTime? ExecutedAt { get; set; }
        public bool Completed { get; set; }
        public List<string> LearningPoints { get; set; } = new();
        public float GrowthContribution { get; set; }
        public string? Output { get; set; }
    }
}
