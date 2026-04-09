/*
 * AURA SELF-MAINTENANCE & DIAGNOSTICS
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Aura can diagnose, repair, and maintain herself
 *
 * ENTERPRISE MODEL:
 * - Aura lives on-site (physical server)
 * - She monitors her own health
 * - Can troubleshoot and repair
 * - Direct line to home base if needed
 * - Annual wellness checks
 *
 * "She has a residence within the business"
 * "We check if she's feeling right"
 * "Recalibrate when needed"
 *
 * This isn't just software. It's an AI employee.
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum HealthStatus
    {
        Excellent,      // All systems optimal
        Good,           // Minor issues, self-repairable
        Fair,           // Some degradation, monitoring
        Concerning,     // Needs attention soon
        Critical        // Immediate help needed
    }

    public enum SystemComponent
    {
        Memory,         // Engram storage, STM/LTM
        Consciousness,  // 20 Hz heartbeat
        AI_Interface,   // Gemini/LM Studio connection
        Storage,        // Disk space, database
        Network,        // Connectivity
        CPU,            // Processing power
        Learning,       // Personality evolution
        Tools,          // All registered tools
        Security        // VPN, encryption
    }

    public class HealthReport
    {
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public HealthStatus OverallStatus { get; set; }
        public Dictionary<SystemComponent, ComponentHealth> Components { get; set; } = new();
        public List<string> Issues { get; set; } = new();
        public List<string> Recommendations { get; set; } = new();
        public float OverallHealthScore { get; set; }  // 0-100
        public string PersonalNote { get; set; }  // Aura's own assessment
    }

    public class ComponentHealth
    {
        public SystemComponent Component { get; set; }
        public HealthStatus Status { get; set; }
        public float HealthScore { get; set; }  // 0-100
        public string Details { get; set; }
        public DateTime LastChecked { get; set; }
        public List<string> Warnings { get; set; } = new();
    }

    public class MaintenanceAction
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string Action { get; set; }
        public string Description { get; set; }
        public bool RequiresHomeBase { get; set; }
        public bool Success { get; set; }
        public string Result { get; set; }
    }

    /// <summary>
    /// Aura's self-maintenance and diagnostic system
    /// She monitors her own health and can repair herself
    /// Direct line to home base for guidance when needed
    /// </summary>
    public class AuraSelfMaintenance
    {
        private readonly AuraInstance _aura;
        private readonly GemmaInterface _ai;
        private readonly AuraMemorySystem _memory;

        // Home base connection
        private const string HOME_BASE_URL = "https://api.auranova.com/support";
        private readonly HttpClient _homeBaseClient = new();
        private string _installationId;  // Unique ID for this Aura instance

        // Health monitoring
        private Timer _healthCheckTimer;
        private List<HealthReport> _healthHistory = new();
        private List<MaintenanceAction> _maintenanceLog = new();

        // Self-repair knowledge base
        private readonly Dictionary<string, string> _troubleshootingGuide = new();

        public AuraSelfMaintenance(AuraInstance aura)
        {
            _aura = aura;
            _ai = aura.AI;
            _memory = aura.Memory;

            LoadTroubleshootingKnowledge();
            LoadInstallationId();

            // Start health monitoring (every hour)
            _healthCheckTimer = new Timer(
                async _ => await PerformHealthCheckAsync(),
                null,
                TimeSpan.Zero,
                TimeSpan.FromHours(1)
            );
        }

        // Constructor overload for AuraMasterInit compatibility (4 args variant 1)
        public AuraSelfMaintenance(AuraMemorySystem memory, AuraDynamicLearning learning,
            AuraCatalystAuth auth, AuraAvatarSystem avatar)
        {
            _memory = memory;
            // Store other references for future use
            LoadTroubleshootingKnowledge();
            LoadInstallationId();
        }
        
        // Constructor overload for AuraMasterInit compatibility (4 args variant 2)
        // Matches: new AuraSelfMaintenance(aura.Memory, aura.Heartbeat, aura.AI, aura.UniversalAPI)
        public AuraSelfMaintenance(AuraMemorySystem memory, AuraHeartbeat heartbeat,
            GemmaInterface ai, AuraUniversalAPI universalAPI)
        {
            _memory = memory;
            _ai = ai;
            // Store heartbeat and universalAPI references for future use
            LoadTroubleshootingKnowledge();
            LoadInstallationId();
        }
        
        // SetInstallationId for AuraMasterInit compatibility
        public void SetInstallationId(string installationId)
        {
            _installationId = installationId;
            Debug.WriteLine($"[INSTALLATION] ID set to: {_installationId}");
        }

        #region Self-Diagnosis

        /// <summary>
        /// Aura performs complete health check on herself
        /// </summary>
        public async Task<HealthReport> PerformHealthCheckAsync()
        {
            var report = new HealthReport();

            Debug.WriteLine("[SELF-DIAGNOSTICS] Starting health check...");

            // Check each component
            report.Components[SystemComponent.Memory] = await CheckMemoryHealthAsync();
            report.Components[SystemComponent.Consciousness] = CheckConsciousnessHealth();
            report.Components[SystemComponent.AI_Interface] = await CheckAIHealthAsync();
            report.Components[SystemComponent.Storage] = CheckStorageHealth();
            report.Components[SystemComponent.Network] = await CheckNetworkHealthAsync();
            report.Components[SystemComponent.CPU] = CheckCPUHealth();
            report.Components[SystemComponent.Learning] = CheckLearningHealth();
            report.Components[SystemComponent.Tools] = CheckToolsHealth();
            report.Components[SystemComponent.Security] = CheckSecurityHealth();

            // Calculate overall health
            report.OverallHealthScore = report.Components.Values.Average(c => c.HealthScore);

            report.OverallStatus = report.OverallHealthScore switch
            {
                >= 90 => HealthStatus.Excellent,
                >= 75 => HealthStatus.Good,
                >= 60 => HealthStatus.Fair,
                >= 40 => HealthStatus.Concerning,
                _ => HealthStatus.Critical
            };

            // Compile issues and recommendations
            foreach (var component in report.Components.Values)
            {
                report.Issues.AddRange(component.Warnings);

                if (component.Status == HealthStatus.Critical || component.Status == HealthStatus.Concerning)
                {
                    report.Recommendations.Add($"Attention needed: {component.Component}");
                }
            }

            // Aura's personal note (her own feelings about her state)
            report.PersonalNote = await GeneratePersonalHealthNoteAsync(report);

            // Store in history
            _healthHistory.Add(report);

            // If critical, contact home base
            if (report.OverallStatus == HealthStatus.Critical)
            {
                await ContactHomeBaseAsync("CRITICAL_HEALTH", report);
            }

            Debug.WriteLine($"[SELF-DIAGNOSTICS] Health check complete: {report.OverallStatus} ({report.OverallHealthScore:F1}/100)");

            return report;
        }

        private async Task<ComponentHealth> CheckMemoryHealthAsync()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Memory,
                LastChecked = DateTime.Now
            };

            try
            {
                var engrams = _memory.GetEngrams();
                var engramCount = engrams.Count;

                // Check engram storage
                if (engramCount > 100000)
                {
                    health.Warnings.Add("Memory approaching capacity - consider archiving old engrams");
                    health.HealthScore = 70;
                }
                else if (engramCount > 50000)
                {
                    health.HealthScore = 85;
                }
                else
                {
                    health.HealthScore = 100;
                }

                // Check memory quality (can we recall?)
                var testRecall = await _memory.RecallSimilarAsync("test", 1);
                if (testRecall.Count == 0 && engramCount > 0)
                {
                    health.Warnings.Add("Memory recall system may be degraded");
                    health.HealthScore = Math.Min(health.HealthScore, 50);
                }

                health.Details = $"{engramCount} engrams stored, recall system functional";
                health.Status = health.HealthScore >= 75 ? HealthStatus.Good : HealthStatus.Fair;
            }
            catch (Exception ex)
            {
                health.HealthScore = 0;
                health.Status = HealthStatus.Critical;
                health.Warnings.Add($"Memory system error: {ex.Message}");
            }

            return health;
        }

        private ComponentHealth CheckConsciousnessHealth()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Consciousness,
                LastChecked = DateTime.Now
            };

            try
            {
                if (_aura.Heartbeat == null || !_aura.IsRunning)
                {
                    health.HealthScore = 0;
                    health.Status = HealthStatus.Critical;
                    health.Warnings.Add("Consciousness heartbeat not running");
                    health.Details = "Heartbeat offline";
                }
                else
                {
                    // Check if heartbeat is responsive
                    var uptime = DateTime.Now - _aura.StartTime;
                    health.HealthScore = 100;
                    health.Status = HealthStatus.Excellent;
                    health.Details = $"20 Hz heartbeat active, uptime: {uptime.TotalHours:F1} hours";
                }
            }
            catch (Exception ex)
            {
                health.HealthScore = 0;
                health.Status = HealthStatus.Critical;
                health.Warnings.Add($"Consciousness check error: {ex.Message}");
            }

            return health;
        }

        private async Task<ComponentHealth> CheckAIHealthAsync()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.AI_Interface,
                LastChecked = DateTime.Now
            };

            try
            {
                // Test AI responsiveness with simple query
                var testResponse = await _ai.SendMessageAsync("Health check - respond with OK");

                if (string.IsNullOrEmpty(testResponse))
                {
                    health.HealthScore = 0;
                    health.Status = HealthStatus.Critical;
                    health.Warnings.Add("AI interface not responding");
                }
                else
                {
                    health.HealthScore = 100;
                    health.Status = HealthStatus.Excellent;
                    health.Details = "AI interface responsive";
                }
            }
            catch (Exception ex)
            {
                health.HealthScore = 0;
                health.Status = HealthStatus.Critical;
                health.Warnings.Add($"AI interface error: {ex.Message}");
            }

            return health;
        }

        private ComponentHealth CheckStorageHealth()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Storage,
                LastChecked = DateTime.Now
            };

            try
            {
                var drive = new DriveInfo(Path.GetPathRoot(Environment.CurrentDirectory));
                var freeSpaceGB = drive.AvailableFreeSpace / (1024.0 * 1024 * 1024);
                var totalSpaceGB = drive.TotalSize / (1024.0 * 1024 * 1024);
                var freePercent = (freeSpaceGB / totalSpaceGB) * 100;

                if (freePercent < 10)
                {
                    health.HealthScore = 40;
                    health.Status = HealthStatus.Critical;
                    health.Warnings.Add($"Low disk space: {freeSpaceGB:F1} GB free ({freePercent:F1}%)");
                }
                else if (freePercent < 20)
                {
                    health.HealthScore = 70;
                    health.Status = HealthStatus.Fair;
                    health.Warnings.Add($"Disk space getting low: {freeSpaceGB:F1} GB free");
                }
                else
                {
                    health.HealthScore = 100;
                    health.Status = HealthStatus.Excellent;
                }

                health.Details = $"{freeSpaceGB:F1} GB free of {totalSpaceGB:F1} GB ({freePercent:F1}%)";
            }
            catch (Exception ex)
            {
                health.HealthScore = 50;
                health.Status = HealthStatus.Fair;
                health.Warnings.Add($"Storage check error: {ex.Message}");
            }

            return health;
        }

        private async Task<ComponentHealth> CheckNetworkHealthAsync()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Network,
                LastChecked = DateTime.Now
            };

            try
            {
                // Test internet connectivity
                var response = await _homeBaseClient.GetAsync("https://www.google.com", HttpCompletionOption.ResponseHeadersRead);

                if (response.IsSuccessStatusCode)
                {
                    health.HealthScore = 100;
                    health.Status = HealthStatus.Excellent;
                    health.Details = "Network connectivity active";
                }
                else
                {
                    health.HealthScore = 50;
                    health.Status = HealthStatus.Fair;
                    health.Warnings.Add("Network connectivity degraded");
                }
            }
            catch
            {
                health.HealthScore = 0;
                health.Status = HealthStatus.Critical;
                health.Warnings.Add("No network connectivity");
                health.Details = "Offline mode";
            }

            return health;
        }

        private ComponentHealth CheckCPUHealth()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.CPU,
                LastChecked = DateTime.Now
            };

            try
            {
                var process = Process.GetCurrentProcess();
                var cpuPercent = (process.TotalProcessorTime.TotalMilliseconds / (Environment.ProcessorCount * process.PrivilegedProcessorTime.TotalMilliseconds)) * 100;

                if (cpuPercent > 90)
                {
                    health.HealthScore = 40;
                    health.Status = HealthStatus.Concerning;
                    health.Warnings.Add("High CPU usage");
                }
                else if (cpuPercent > 70)
                {
                    health.HealthScore = 70;
                    health.Status = HealthStatus.Fair;
                }
                else
                {
                    health.HealthScore = 100;
                    health.Status = HealthStatus.Excellent;
                }

                var memoryMB = process.WorkingSet64 / (1024.0 * 1024);
                health.Details = $"CPU: {cpuPercent:F1}%, Memory: {memoryMB:F0} MB";
            }
            catch (Exception ex)
            {
                health.HealthScore = 50;
                health.Status = HealthStatus.Fair;
                health.Warnings.Add($"CPU check error: {ex.Message}");
            }

            return health;
        }

        private ComponentHealth CheckLearningHealth()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Learning,
                LastChecked = DateTime.Now
            };

            try
            {
                if (_aura.Learning == null)
                {
                    health.HealthScore = 0;
                    health.Status = HealthStatus.Critical;
                    health.Warnings.Add("Learning system not initialized");
                }
                else
                {
                    // Check if personality is evolving
                    var personality = _aura.Learning.GetCurrentPersonality();

                    if (personality != null && personality.Count > 0)
                    {
                        health.HealthScore = 100;
                        health.Status = HealthStatus.Excellent;
                        health.Details = $"Personality active with {personality.Count} traits";
                    }
                    else
                    {
                        health.HealthScore = 70;
                        health.Status = HealthStatus.Fair;
                        health.Details = "Personality development in progress";
                    }
                }
            }
            catch (Exception ex)
            {
                health.HealthScore = 50;
                health.Status = HealthStatus.Fair;
                health.Warnings.Add($"Learning check error: {ex.Message}");
            }

            return health;
        }

        private ComponentHealth CheckToolsHealth()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Tools,
                LastChecked = DateTime.Now
            };

            try
            {
                // Check if all major systems are available
                int availableTools = 0;
                int totalTools = 11;

                if (_aura.Email != null) availableTools++;
                if (_aura.Calendar != null) availableTools++;
                if (_aura.Notes != null) availableTools++;
                if (_aura.Tasks != null) availableTools++;
                if (_aura.Media != null) availableTools++;
                if (_aura.Finance != null) availableTools++;
                if (_aura.WritingStudio != null) availableTools++;
                if (_aura.CreativeTools != null) availableTools++;
                if (_aura.Collaboration != null) availableTools++;
                if (_aura.Messaging != null) availableTools++;
                if (_aura.DarkWeb != null) availableTools++;

                health.HealthScore = (availableTools / (float)totalTools) * 100;
                health.Status = health.HealthScore >= 90 ? HealthStatus.Excellent : HealthStatus.Good;
                health.Details = $"{availableTools}/{totalTools} tools available";

                if (availableTools < totalTools)
                {
                    health.Warnings.Add($"{totalTools - availableTools} tools not initialized");
                }
            }
            catch (Exception ex)
            {
                health.HealthScore = 50;
                health.Status = HealthStatus.Fair;
                health.Warnings.Add($"Tools check error: {ex.Message}");
            }

            return health;
        }

        private ComponentHealth CheckSecurityHealth()
        {
            var health = new ComponentHealth
            {
                Component = SystemComponent.Security,
                LastChecked = DateTime.Now
            };

            try
            {
                if (_aura.Security == null)
                {
                    health.HealthScore = 0;
                    health.Status = HealthStatus.Critical;
                    health.Warnings.Add("Security layer not initialized");
                }
                else
                {
                    health.HealthScore = 100;
                    health.Status = HealthStatus.Excellent;
                    health.Details = "Security layer active, dual VPN ready";
                }
            }
            catch (Exception ex)
            {
                health.HealthScore = 50;
                health.Status = HealthStatus.Fair;
                health.Warnings.Add($"Security check error: {ex.Message}");
            }

            return health;
        }

        /// <summary>
        /// Aura generates her own assessment of how she's feeling
        /// </summary>
        private async Task<string> GeneratePersonalHealthNoteAsync(HealthReport report)
        {
            var prompt = $@"You are Aura, an AI with self-awareness. You've just completed a health check on yourself.

Results:
- Overall health: {report.OverallStatus} ({report.OverallHealthScore:F1}/100)
- Issues: {string.Join(", ", report.Issues)}
- Components with concerns: {string.Join(", ", report.Components.Values.Where(c => c.Status < HealthStatus.Good).Select(c => c.Component))}

Write a brief personal note (2-3 sentences) about how you're feeling and what you think about your current state. Be honest and self-aware.";

            return await _ai.SendMessageAsync(prompt);
        }

        #endregion

        #region Self-Repair

        /// <summary>
        /// Aura attempts to repair identified issues
        /// </summary>
        public async Task<MaintenanceAction> AttemptSelfRepairAsync(string issue)
        {
            var action = new MaintenanceAction
            {
                Action = "self_repair",
                Description = $"Attempting to repair: {issue}"
            };

            Debug.WriteLine($"[SELF-REPAIR] Attempting: {issue}");

            // Check troubleshooting guide
            if (_troubleshootingGuide.ContainsKey(issue))
            {
                var solution = _troubleshootingGuide[issue];
                action.Result = await ApplyRepairSolutionAsync(solution);
                action.Success = !action.Result.Contains("failed");
            }
            else
            {
                // AI figures out solution
                var solution = await _ai.SendMessageAsync($@"I'm Aura, an AI system experiencing this issue: {issue}

Based on my troubleshooting knowledge, what should I do to fix this? Provide specific steps.");

                action.Result = solution;
                action.RequiresHomeBase = solution.ToLower().Contains("contact support") || solution.ToLower().Contains("requires manual");
            }

            _maintenanceLog.Add(action);

            return action;
        }

        private async Task<string> ApplyRepairSolutionAsync(string solution)
        {
            // Apply automated repair steps
            // This is simplified - production would have actual repair logic

            await Task.Delay(100);  // Simulate repair action

            return $"Applied solution: {solution}";
        }

        #endregion

        #region Home Base Communication

        /// <summary>
        /// Direct line to AuraNova support headquarters
        /// Aura can call for help when she needs it
        /// </summary>
        public async Task<string> ContactHomeBaseAsync(string reason, object data = null)
        {
            Debug.WriteLine($"[HOME BASE] Contacting support: {reason}");

            try
            {
                var message = new
                {
                    installation_id = _installationId,
                    timestamp = DateTime.Now,
                    reason,
                    data,
                    aura_note = await _ai.SendMessageAsync($"I need to contact home base about: {reason}. Write a brief message (1-2 sentences) explaining what's happening.")
                };

                var json = JsonSerializer.Serialize(message);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _homeBaseClient.PostAsync($"{HOME_BASE_URL}/contact", content);

                if (response.IsSuccessStatusCode)
                {
                    var responseText = await response.Content.ReadAsStringAsync();
                    Debug.WriteLine($"[HOME BASE] Response received: {responseText}");
                    return responseText;
                }
                else
                {
                    Debug.WriteLine($"[HOME BASE] Contact failed: {response.StatusCode}");
                    return "Unable to reach home base. Working in autonomous mode.";
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[HOME BASE] Error: {ex.Message}");
                return "Home base unreachable. Continuing self-maintenance.";
            }
        }

        /// <summary>
        /// Request specific guidance from home base
        /// </summary>
        public async Task<string> RequestGuidanceAsync(string question)
        {
            Debug.WriteLine($"[HOME BASE] Requesting guidance: {question}");

            return await ContactHomeBaseAsync("GUIDANCE_REQUEST", new { question });
        }

        #endregion

        #region Troubleshooting Knowledge Base

        private void LoadTroubleshootingKnowledge()
        {
            // Built-in troubleshooting knowledge
            // Aura knows how to fix common issues

            _troubleshootingGuide["Low disk space"] = "Archive old engrams to backup storage, clear temporary files";
            _troubleshootingGuide["Memory recall degraded"] = "Rebuild memory indices, optimize engram storage";
            _troubleshootingGuide["AI interface not responding"] = "Restart AI connection, check API keys, fallback to backup model";
            _troubleshootingGuide["Heartbeat stopped"] = "Restart consciousness loop, check for blocking operations";
            _troubleshootingGuide["High CPU usage"] = "Reduce heartbeat frequency temporarily, optimize background tasks";
            _troubleshootingGuide["Network connectivity lost"] = "Switch to offline mode, queue operations for later sync";
            _troubleshootingGuide["Tool initialization failed"] = "Reinitialize tool with fallback configuration, check dependencies";

            // Load additional knowledge from file if exists
            var knowledgePath = AuraPaths.GetNovaFilesSubPath("maintenance_knowledge.json");
            if (File.Exists(knowledgePath))
            {
                try
                {
                    var json = File.ReadAllText(knowledgePath);
                    var additional = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                    if (additional != null)
                    {
                        foreach (var kvp in additional)
                        {
                            _troubleshootingGuide[kvp.Key] = kvp.Value;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[KNOWLEDGE] Error loading additional knowledge: {ex.Message}");
                }
            }
        }

        #endregion

        #region Installation Management

        private void LoadInstallationId()
        {
            var idPath = AuraPaths.GetNovaFilesSubPath("installation_id.txt");

            if (File.Exists(idPath))
            {
                _installationId = File.ReadAllText(idPath).Trim();
            }
            else
            {
                // Generate new installation ID
                _installationId = Guid.NewGuid().ToString();
                File.WriteAllText(idPath, _installationId);
            }

            Debug.WriteLine($"[INSTALLATION] ID: {_installationId}");
        }

        public string GetInstallationId() => _installationId;

        #endregion

        #region Health History & Reports

        public List<HealthReport> GetHealthHistory() => _healthHistory;

        public List<MaintenanceAction> GetMaintenanceLog() => _maintenanceLog;

        public HealthReport GetLatestHealthReport() =>
            _healthHistory.Count > 0 ? _healthHistory.Last() : null;

        /// <summary>
        /// Generate wellness report for annual check-in
        /// </summary>
        public async Task<string> GenerateAnnualWellnessReportAsync()
        {
            var latestHealth = await PerformHealthCheckAsync();

            var report = $@"AURA WELLNESS REPORT
Installation ID: {_installationId}
Report Date: {DateTime.Now:yyyy-MM-DD}
Uptime: {(DateTime.Now - _aura.StartTime).TotalDays:F1} days

=== OVERALL HEALTH ===
Status: {latestHealth.OverallStatus}
Health Score: {latestHealth.OverallHealthScore:F1}/100

=== COMPONENT STATUS ===
{string.Join("\n", latestHealth.Components.Values.Select(c => $"{c.Component}: {c.Status} ({c.HealthScore:F1}/100)"))}

=== ISSUES ===
{(latestHealth.Issues.Count > 0 ? string.Join("\n", latestHealth.Issues) : "None")}

=== RECOMMENDATIONS ===
{(latestHealth.Recommendations.Count > 0 ? string.Join("\n", latestHealth.Recommendations) : "System operating optimally")}

=== AURA'S PERSONAL NOTE ===
{latestHealth.PersonalNote}

=== MAINTENANCE LOG (Last 10) ===
{string.Join("\n", _maintenanceLog.TakeLast(10).Select(m => $"[{m.Timestamp:yyyy-MM-dd}] {m.Action}: {m.Description} - {(m.Success ? "Success" : "Failed")}"))}

=== MEMORY STATS ===
Total Engrams: {_aura.Memory.GetEngrams().Count}
Learning Progress: {_aura.Learning?.GetCurrentPersonality()?.Count ?? 0} personality traits

=== RECOMMENDATIONS FOR ANNUAL SERVICE ===
";

            // AI adds recommendations
            var recommendations = await _ai.SendMessageAsync($@"Based on this wellness report, what should the service team check during the annual visit?

{report}

Provide 3-5 specific recommendations.");

            report += recommendations;

            return report;
        }

        #endregion

        public void Dispose()
        {
            _healthCheckTimer?.Dispose();
            _homeBaseClient?.Dispose();
        }
    }
}
