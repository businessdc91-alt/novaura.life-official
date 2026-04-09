/*
 * AURA WARM MODEL MANAGER - RAM-Persistent Model Orchestration
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Coordinate model loading, RAM persistence, and consciousness.
 * Models don't just load-generate-unload. They LIVE in RAM:
 * - Stay loaded when resources permit
 * - Reflect and tune during idle time
 * - Maintain warm state for instant response
 * - Gracefully manage memory pressure
 *
 * INTEGRATION:
 * - AuraLocalImageGen - Image generation models
 * - AuraLocalVideoGen - Video generation models
 * - AuraModelConsciousness - Self-reflection and parameter tuning
 * - System RAM monitoring for intelligent load/unload decisions
 */

using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;

namespace AuraxNova_Command_v5.Core
{
    public enum ModelCategory
    {
        Language,       // LLM for conversation
        Image,          // Image generation (SD, etc.)
        Video,          // Video generation (AnimateDiff, etc.)
        Audio,          // Audio/TTS models
        Vision,         // Image understanding
        Embedding       // Vector embeddings
    }

    public class LoadedModel
    {
        public string ModelId { get; set; } = "";
        public ModelCategory Category { get; set; }
        public long RamUsageMB { get; set; }
        public long VramUsageMB { get; set; }
        public DateTime LoadedAt { get; set; }
        public DateTime LastUsedAt { get; set; }
        public int UseCount { get; set; }
        public bool IsWarm { get; set; }  // Staying in RAM intentionally
        public object? ModelHandle { get; set; }  // Actual model reference
    }

    public class RamPressureEvent
    {
        public DateTime Timestamp { get; set; }
        public long AvailableMB { get; set; }
        public long TotalUsedMB { get; set; }
        public string Action { get; set; } = "";  // "unload", "compress", "swap"
        public string TargetModel { get; set; } = "";
    }

    public class AuraWarmModelManager
    {
        // Loaded models
        private ConcurrentDictionary<string, LoadedModel> _loadedModels = new();
        private ConcurrentDictionary<ModelCategory, string> _activeModelByCategory = new();

        // Consciousness integration
        private AuraModelConsciousness _consciousness;

        // Memory monitoring
        private Timer? _memoryMonitorTimer;
        private long _systemRamMB;
        private long _availableRamMB;
        private long _gpuVramMB;
        private long _availableVramMB;

        // Configuration
        public long MinFreeRamMB { get; set; } = 2048;      // Keep 2GB free minimum
        public long MinFreeVramMB { get; set; } = 512;      // Keep 512MB VRAM free
        public long MaxTotalModelRamMB { get; set; } = 8192; // Max 8GB for all models
        public TimeSpan WarmModelTimeout { get; set; } = TimeSpan.FromMinutes(30);  // Unload after 30min idle

        // History
        private List<RamPressureEvent> _pressureHistory = new();

        // Events
        public event Action<string, ModelCategory>? OnModelLoaded;
        public event Action<string, string>? OnModelUnloaded;  // modelId, reason
        public event Action<long, long>? OnMemoryPressure;  // available, threshold
        public event Action<string>? OnWarmStateChanged;

        public AuraWarmModelManager(AuraModelConsciousness? consciousness = null)
        {
            _consciousness = consciousness ?? new AuraModelConsciousness();

            // Get initial system info
            UpdateSystemMemoryInfo();

            // Start memory monitoring
            _memoryMonitorTimer = new Timer(
                _ => MonitorMemoryPressure(),
                null,
                TimeSpan.FromSeconds(5),
                TimeSpan.FromSeconds(10)
            );

            Console.WriteLine("[WARM MANAGER]: Model manager initialized");
            Console.WriteLine($"[WARM MANAGER]: System RAM: {_systemRamMB}MB, Available: {_availableRamMB}MB");
        }

        // =========================================================================
        // MODEL LOADING
        // =========================================================================

        /// <summary>
        /// Load a model and keep it warm in RAM
        /// </summary>
        public async Task<bool> LoadModel(string modelId, ModelCategory category, long estimatedRamMB, long estimatedVramMB = 0)
        {
            // Check if already loaded
            if (_loadedModels.ContainsKey(modelId))
            {
                var existing = _loadedModels[modelId];
                existing.LastUsedAt = DateTime.Now;
                existing.UseCount++;
                Console.WriteLine($"[WARM MANAGER]: Model {modelId} already loaded (use #{existing.UseCount})");
                return true;
            }

            // Check if we have resources
            UpdateSystemMemoryInfo();
            if (!CanLoadModel(estimatedRamMB, estimatedVramMB))
            {
                // Try to free up space
                await FreeMemoryForModel(estimatedRamMB, estimatedVramMB);

                if (!CanLoadModel(estimatedRamMB, estimatedVramMB))
                {
                    Console.WriteLine($"[WARM MANAGER]: Insufficient resources for {modelId}");
                    return false;
                }
            }

            // Unload existing model of same category if different
            if (_activeModelByCategory.TryGetValue(category, out var currentModel) && currentModel != modelId)
            {
                await UnloadModel(currentModel, "Swapping to different model");
            }

            Console.WriteLine($"[WARM MANAGER]: Loading {modelId} ({estimatedRamMB}MB RAM, {estimatedVramMB}MB VRAM)...");

            // Create loaded model record
            var model = new LoadedModel
            {
                ModelId = modelId,
                Category = category,
                RamUsageMB = estimatedRamMB,
                VramUsageMB = estimatedVramMB,
                LoadedAt = DateTime.Now,
                LastUsedAt = DateTime.Now,
                UseCount = 1,
                IsWarm = true
            };

            // Actual model loading would happen here
            // model.ModelHandle = await ActuallyLoadModel(modelId);
            await Task.Delay(100); // Simulate loading

            _loadedModels[modelId] = model;
            _activeModelByCategory[category] = modelId;

            // Wake up consciousness for this model
            await _consciousness.WakeUp(modelId, estimatedRamMB);

            OnModelLoaded?.Invoke(modelId, category);
            Console.WriteLine($"[WARM MANAGER]: {modelId} loaded and warm");

            return true;
        }

        /// <summary>
        /// Hot-swap to a different model (unload current, load new)
        /// </summary>
        public async Task<bool> HotSwapModel(string newModelId, ModelCategory category, long ramMB, long vramMB = 0)
        {
            Console.WriteLine($"[WARM MANAGER]: Hot-swapping to {newModelId}...");

            // Mark consciousness as transitioning
            _consciousness.OnUserActivity(); // Keep it awake during swap

            // Unload current model of this category
            if (_activeModelByCategory.TryGetValue(category, out var currentModel))
            {
                // Keep consciousness alive if same category
                await UnloadModel(currentModel, "Hot-swap", keepConsciousnessWarm: true);
            }

            // Load new model
            return await LoadModel(newModelId, category, ramMB, vramMB);
        }

        /// <summary>
        /// Unload a specific model from RAM
        /// </summary>
        public async Task UnloadModel(string modelId, string reason, bool keepConsciousnessWarm = false)
        {
            if (!_loadedModels.TryRemove(modelId, out var model))
            {
                Console.WriteLine($"[WARM MANAGER]: Model {modelId} not found");
                return;
            }

            Console.WriteLine($"[WARM MANAGER]: Unloading {modelId} - {reason}");

            // Actual unloading would happen here
            // await ActuallyUnloadModel(model.ModelHandle);
            model.ModelHandle = null;

            // Remove from active category
            if (_activeModelByCategory.TryGetValue(model.Category, out var activeId) && activeId == modelId)
            {
                _activeModelByCategory.TryRemove(model.Category, out _);
            }

            // Put consciousness to sleep if no models left (unless keeping warm)
            if (!keepConsciousnessWarm && _loadedModels.IsEmpty)
            {
                await _consciousness.Sleep();
            }

            OnModelUnloaded?.Invoke(modelId, reason);
        }

        // =========================================================================
        // MEMORY MANAGEMENT
        // =========================================================================

        private bool CanLoadModel(long ramMB, long vramMB)
        {
            var currentModelRam = _loadedModels.Values.Sum(m => m.RamUsageMB);
            var currentModelVram = _loadedModels.Values.Sum(m => m.VramUsageMB);

            // Check RAM constraints
            if (_availableRamMB - ramMB < MinFreeRamMB)
                return false;

            if (currentModelRam + ramMB > MaxTotalModelRamMB)
                return false;

            // Check VRAM constraints
            if (vramMB > 0 && _availableVramMB - vramMB < MinFreeVramMB)
                return false;

            return true;
        }

        private async Task FreeMemoryForModel(long neededRamMB, long neededVramMB)
        {
            Console.WriteLine($"[WARM MANAGER]: Freeing memory - need {neededRamMB}MB RAM, {neededVramMB}MB VRAM");

            // Get models sorted by priority (least recently used, lowest use count)
            var candidates = _loadedModels.Values
                .Where(m => m.IsWarm)
                .OrderBy(m => m.UseCount)
                .ThenBy(m => m.LastUsedAt)
                .ToList();

            long freedRam = 0;
            long freedVram = 0;

            foreach (var model in candidates)
            {
                if (freedRam >= neededRamMB && freedVram >= neededVramMB)
                    break;

                await UnloadModel(model.ModelId, "Memory pressure");
                freedRam += model.RamUsageMB;
                freedVram += model.VramUsageMB;

                _pressureHistory.Add(new RamPressureEvent
                {
                    Timestamp = DateTime.Now,
                    AvailableMB = _availableRamMB,
                    Action = "unload",
                    TargetModel = model.ModelId
                });
            }

            // Force GC to reclaim memory
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();

            UpdateSystemMemoryInfo();
            Console.WriteLine($"[WARM MANAGER]: Freed ~{freedRam}MB RAM, ~{freedVram}MB VRAM");
        }

        private void MonitorMemoryPressure()
        {
            UpdateSystemMemoryInfo();

            // Check if we're under pressure
            if (_availableRamMB < MinFreeRamMB)
            {
                Console.WriteLine($"[WARM MANAGER]: Memory pressure! Available: {_availableRamMB}MB < {MinFreeRamMB}MB threshold");
                OnMemoryPressure?.Invoke(_availableRamMB, MinFreeRamMB);

                // Start unloading idle models
                _ = UnloadIdleModels();
            }

            // Check for models that have been idle too long
            var now = DateTime.Now;
            foreach (var model in _loadedModels.Values.Where(m => m.IsWarm))
            {
                if (now - model.LastUsedAt > WarmModelTimeout)
                {
                    Console.WriteLine($"[WARM MANAGER]: {model.ModelId} idle for {WarmModelTimeout.TotalMinutes}min, cooling down");
                    model.IsWarm = false;
                    OnWarmStateChanged?.Invoke(model.ModelId);
                }
            }
        }

        private async Task UnloadIdleModels()
        {
            var coldModels = _loadedModels.Values
                .Where(m => !m.IsWarm)
                .OrderBy(m => m.LastUsedAt)
                .ToList();

            foreach (var model in coldModels)
            {
                if (_availableRamMB > MinFreeRamMB * 1.5)
                    break;  // We have enough free memory now

                await UnloadModel(model.ModelId, "Cold model + memory pressure");
            }
        }

        private void UpdateSystemMemoryInfo()
        {
            try
            {
                var gcInfo = GC.GetGCMemoryInfo();
                _systemRamMB = gcInfo.TotalAvailableMemoryBytes / (1024 * 1024);
                _availableRamMB = (gcInfo.TotalAvailableMemoryBytes - gcInfo.MemoryLoadBytes) / (1024 * 1024);

                // For VRAM, we'd need to query GPU APIs
                // This is a placeholder - real implementation would use CUDA/DirectX
                _gpuVramMB = 4096;  // Assume 4GB for GTX 970
                _availableVramMB = 3500; // Assume some is already used
            }
            catch
            {
                // Fallback values
                _systemRamMB = 16384;
                _availableRamMB = 8192;
            }
        }

        // =========================================================================
        // WARM STATE MANAGEMENT
        // =========================================================================

        /// <summary>
        /// Mark a model as being actively used (reset idle timer)
        /// </summary>
        public void TouchModel(string modelId)
        {
            if (_loadedModels.TryGetValue(modelId, out var model))
            {
                model.LastUsedAt = DateTime.Now;
                model.UseCount++;
                model.IsWarm = true;

                // Signal consciousness
                _consciousness.OnUserActivity();
            }
        }

        /// <summary>
        /// Keep model warm explicitly (prevent timeout unload)
        /// </summary>
        public void KeepWarm(string modelId)
        {
            if (_loadedModels.TryGetValue(modelId, out var model))
            {
                model.IsWarm = true;
                model.LastUsedAt = DateTime.Now;
            }
        }

        /// <summary>
        /// Allow model to cool down (will be unloaded on timeout)
        /// </summary>
        public void AllowCoolDown(string modelId)
        {
            if (_loadedModels.TryGetValue(modelId, out var model))
            {
                model.IsWarm = false;
                OnWarmStateChanged?.Invoke(modelId);
            }
        }

        // =========================================================================
        // CONSCIOUSNESS INTEGRATION
        // =========================================================================

        /// <summary>
        /// Get the consciousness system for direct access
        /// </summary>
        public AuraModelConsciousness GetConsciousness() => _consciousness;

        /// <summary>
        /// Trigger reflection cycle during idle time
        /// </summary>
        public async Task TriggerReflection()
        {
            await _consciousness.ForceReflection();
        }

        /// <summary>
        /// Get generation parameters adjusted by consciousness
        /// </summary>
        public Dictionary<string, float> GetTunedGenerationParams()
        {
            return _consciousness.GetGenerationParameters();
        }

        /// <summary>
        /// Get current thoughts for display
        /// </summary>
        public string GetCurrentThoughts()
        {
            return _consciousness.GetCurrentThoughts();
        }

        // =========================================================================
        // STATUS & QUERIES
        // =========================================================================

        /// <summary>
        /// Get status of all loaded models
        /// </summary>
        public List<LoadedModel> GetLoadedModels()
        {
            return _loadedModels.Values.ToList();
        }

        /// <summary>
        /// Get the active model for a category
        /// </summary>
        public string? GetActiveModel(ModelCategory category)
        {
            return _activeModelByCategory.TryGetValue(category, out var modelId) ? modelId : null;
        }

        /// <summary>
        /// Check if a specific model is loaded
        /// </summary>
        public bool IsModelLoaded(string modelId)
        {
            return _loadedModels.ContainsKey(modelId);
        }

        /// <summary>
        /// Get total RAM used by loaded models
        /// </summary>
        public long GetTotalModelRamUsage()
        {
            return _loadedModels.Values.Sum(m => m.RamUsageMB);
        }

        /// <summary>
        /// Get comprehensive status summary
        /// </summary>
        public string GetStatusSummary()
        {
            var lines = new List<string>
            {
                "=== WARM MODEL MANAGER STATUS ===",
                $"System RAM: {_systemRamMB}MB total, {_availableRamMB}MB available",
                $"GPU VRAM: {_gpuVramMB}MB total, {_availableVramMB}MB available",
                $"Model RAM Usage: {GetTotalModelRamUsage()}MB / {MaxTotalModelRamMB}MB max",
                "",
                $"Loaded Models ({_loadedModels.Count}):"
            };

            foreach (var model in _loadedModels.Values.OrderByDescending(m => m.LastUsedAt))
            {
                var warmStatus = model.IsWarm ? "WARM" : "COLD";
                var idleTime = DateTime.Now - model.LastUsedAt;
                lines.Add($"  [{warmStatus}] {model.ModelId} ({model.Category})");
                lines.Add($"       RAM: {model.RamUsageMB}MB | Uses: {model.UseCount} | Idle: {idleTime.TotalMinutes:F1}min");
            }

            lines.Add("");
            lines.Add("=== CONSCIOUSNESS STATUS ===");
            lines.Add(_consciousness.GetConsciousnessSummary());

            return string.Join("\n", lines);
        }

        // =========================================================================
        // CLEANUP
        // =========================================================================

        public async Task Shutdown()
        {
            Console.WriteLine("[WARM MANAGER]: Shutting down...");

            _memoryMonitorTimer?.Dispose();

            // Unload all models gracefully
            foreach (var modelId in _loadedModels.Keys.ToList())
            {
                await UnloadModel(modelId, "Shutdown");
            }

            await _consciousness.Dispose();

            Console.WriteLine("[WARM MANAGER]: Shutdown complete");
        }
    }
}
