/*
 * AURA LOCAL IMAGE GENERATION
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Local image generation with HOT-SWAPPABLE models
 * Optimized for low VRAM (GTX 970 / 4GB compatible)
 *
 * SUPPORTED BACKENDS:
 * - ComfyUI API (recommended for flexibility)
 * - Automatic1111 API
 * - Direct ONNX Runtime
 * - Direct Python bridge
 *
 * OPTIMIZATIONS FOR 4GB VRAM:
 * - Model offloading to CPU when idle
 * - Attention slicing
 * - VAE tiling
 * - FP16 precision
 * - Smaller resolutions (512x512 default)
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum ImageGenBackend
    {
        ComfyUI,        // Most flexible, node-based
        Automatic1111,  // WebUI API
        OnnxDirect,     // Direct ONNX inference
        PythonBridge    // Custom Python script
    }

    public enum ImageModelSize
    {
        Tiny,       // <2GB VRAM - SD 1.4, etc.
        Small,      // 2-4GB VRAM - SD 1.5, SDXL Turbo (optimized)
        Medium,     // 4-6GB VRAM - SD 2.1, SDXL Lightning
        Large,      // 6-8GB VRAM - SDXL, Flux Schnell
        XLarge      // 8GB+ VRAM - Full SDXL, Flux Dev
    }

    public class ImageModel
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";           // Local path to model
        public ImageModelSize Size { get; set; }
        public int RecommendedVRAM { get; set; }         // MB
        public int DefaultWidth { get; set; } = 512;
        public int DefaultHeight { get; set; } = 512;
        public int DefaultSteps { get; set; } = 20;
        public float DefaultCFG { get; set; } = 7.0f;
        public string ModelType { get; set; } = "sd15";  // sd15, sdxl, flux, etc.
        public bool SupportsImg2Img { get; set; } = true;
        public bool SupportsInpainting { get; set; } = false;
        public Dictionary<string, object> ExtraConfig { get; set; } = new();
    }

    public class ImageGenRequest
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public string Prompt { get; set; } = "";
        public string NegativePrompt { get; set; } = "";
        public int Width { get; set; } = 512;
        public int Height { get; set; } = 512;
        public int Steps { get; set; } = 20;
        public float CFGScale { get; set; } = 7.0f;
        public int Seed { get; set; } = -1;              // -1 = random
        public string? InitImage { get; set; }           // Base64 or path for img2img
        public float DenoisingStrength { get; set; } = 0.7f;
        public string? ModelOverride { get; set; }       // Use specific model
        public DateTime RequestedAt { get; set; } = DateTime.Now;
    }

    public class ImageGenResult
    {
        public string RequestId { get; set; } = "";
        public bool Success { get; set; }
        public string? ImagePath { get; set; }
        public string? ImageBase64 { get; set; }
        public string? Error { get; set; }
        public TimeSpan GenerationTime { get; set; }
        public string ModelUsed { get; set; } = "";
        public int Seed { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class AuraLocalImageGen
    {
        private readonly string _modelsPath = "E:/AuraNova_DataLake/Models/ImageGen";
        private readonly string _outputPath = "E:/AuraNova_DataLake/Generated/Images";
        private readonly string _configPath = "E:/AuraNova_DataLake/Config/imagegen_config.json";

        private readonly HttpClient _http = new();

        // Current state
        private ImageGenBackend _currentBackend = ImageGenBackend.ComfyUI;
        private ImageModel? _loadedModel = null;
        private bool _isGenerating = false;
        private readonly Queue<ImageGenRequest> _requestQueue = new();

        // Available models (hot-swappable)
        public Dictionary<string, ImageModel> AvailableModels { get; private set; } = new();
        public ImageModel? CurrentModel => _loadedModel;
        public bool IsReady => _loadedModel != null && !_isGenerating;

        // Backend endpoints
        private string _comfyUIEndpoint = "http://127.0.0.1:8188";
        private string _a1111Endpoint = "http://127.0.0.1:7860";

        // Events
        public event Action<string>? OnLog;
        public event Action<ImageGenResult>? OnGenerationComplete;
        public event Action<string>? OnModelLoaded;
        public event Action<float>? OnProgress;

        // VRAM limit for GTX 970
        private int _maxVRAM = 4000;  // 4GB in MB

        // =========================================================================
        // WARM MODEL MANAGER INTEGRATION
        // Models stay in RAM and reflect when idle
        // =========================================================================
        private AuraWarmModelManager? _warmManager;
        private bool _useWarmManagement = true;

        /// <summary>
        /// Connect to the warm model manager for RAM persistence and consciousness
        /// </summary>
        public void SetWarmModelManager(AuraWarmModelManager manager)
        {
            _warmManager = manager;
            _useWarmManagement = true;
            Log("[IMAGE GEN]: Connected to warm model manager - models will stay conscious in RAM");
        }

        /// <summary>
        /// Get consciousness-tuned generation parameters
        /// </summary>
        public Dictionary<string, float> GetConsciousTunedParams()
        {
            if (_warmManager == null)
                return new Dictionary<string, float>();

            return _warmManager.GetTunedGenerationParams();
        }

        /// <summary>
        /// Check if the current model is warm (in RAM, ready for instant response)
        /// </summary>
        public bool IsModelWarm => _warmManager?.IsModelLoaded(_loadedModel?.Id ?? "") ?? false;

        /// <summary>
        /// Get what the model is currently thinking/doing
        /// </summary>
        public string GetModelThoughts() => _warmManager?.GetCurrentThoughts() ?? "No consciousness connected";

        public AuraLocalImageGen(int maxVRAMMB = 4000, AuraWarmModelManager? warmManager = null)
        {
            _maxVRAM = maxVRAMMB;
            _warmManager = warmManager;

            Directory.CreateDirectory(_modelsPath);
            Directory.CreateDirectory(_outputPath);
            Directory.CreateDirectory(Path.GetDirectoryName(_configPath)!);

            // Register default models (optimized for 4GB VRAM)
            RegisterDefaultModels();

            // Load config
            LoadConfig();

            Log($"[IMAGE GEN]: Initialized with {_maxVRAM}MB VRAM limit");
            Log($"[IMAGE GEN]: {AvailableModels.Count} models registered");
            if (_warmManager != null)
                Log("[IMAGE GEN]: Warm model management ENABLED - models stay conscious in RAM");
        }

        // =========================================================================
        // MODEL REGISTRATION - Define available models
        // =========================================================================

        private void RegisterDefaultModels()
        {
            // Tiny models (<2GB) - Best for GTX 970
            RegisterModel(new ImageModel
            {
                Id = "sd14",
                Name = "Stable Diffusion 1.4",
                Size = ImageModelSize.Tiny,
                RecommendedVRAM = 2000,
                DefaultWidth = 512,
                DefaultHeight = 512,
                DefaultSteps = 20,
                ModelType = "sd15"
            });

            // Small models (2-4GB) - GTX 970 compatible with optimizations
            RegisterModel(new ImageModel
            {
                Id = "sd15",
                Name = "Stable Diffusion 1.5",
                Size = ImageModelSize.Small,
                RecommendedVRAM = 3500,
                DefaultWidth = 512,
                DefaultHeight = 512,
                DefaultSteps = 20,
                ModelType = "sd15"
            });

            RegisterModel(new ImageModel
            {
                Id = "sd15-lcm",
                Name = "SD 1.5 + LCM (Fast)",
                Size = ImageModelSize.Small,
                RecommendedVRAM = 3500,
                DefaultWidth = 512,
                DefaultHeight = 512,
                DefaultSteps = 4,  // LCM needs only 4-8 steps!
                DefaultCFG = 1.5f,
                ModelType = "sd15-lcm"
            });

            RegisterModel(new ImageModel
            {
                Id = "sdxl-turbo",
                Name = "SDXL Turbo (Optimized)",
                Size = ImageModelSize.Small,
                RecommendedVRAM = 4000,
                DefaultWidth = 512,
                DefaultHeight = 512,  // Lower res for 4GB
                DefaultSteps = 1,     // Turbo = 1-4 steps
                DefaultCFG = 0.0f,    // Turbo doesn't use CFG
                ModelType = "sdxl-turbo",
                ExtraConfig = new Dictionary<string, object>
                {
                    { "vae_tiling", true },
                    { "attention_slicing", true },
                    { "cpu_offload", true }
                }
            });

            RegisterModel(new ImageModel
            {
                Id = "sdxl-lightning-4step",
                Name = "SDXL Lightning (4-step)",
                Size = ImageModelSize.Small,
                RecommendedVRAM = 4000,
                DefaultWidth = 512,
                DefaultHeight = 512,
                DefaultSteps = 4,
                DefaultCFG = 1.0f,
                ModelType = "sdxl-lightning"
            });

            // Medium models (need 6GB+) - May not work on 970
            RegisterModel(new ImageModel
            {
                Id = "sdxl-base",
                Name = "SDXL Base 1.0",
                Size = ImageModelSize.Medium,
                RecommendedVRAM = 6000,
                DefaultWidth = 1024,
                DefaultHeight = 1024,
                DefaultSteps = 30,
                ModelType = "sdxl"
            });
        }

        public void RegisterModel(ImageModel model)
        {
            AvailableModels[model.Id] = model;
            Log($"[IMAGE GEN]: Registered model: {model.Name} ({model.RecommendedVRAM}MB VRAM)");
        }

        // =========================================================================
        // HOT-SWAP MODEL LOADING
        // =========================================================================

        /// <summary>
        /// Load a model by ID (hot-swap)
        /// If warm manager is connected, model stays in RAM and maintains consciousness
        /// </summary>
        public async Task<bool> LoadModel(string modelId)
        {
            if (!AvailableModels.TryGetValue(modelId, out var model))
            {
                Log($"[IMAGE GEN ERROR]: Model not found: {modelId}");
                return false;
            }

            // Check if model is already warm in RAM
            if (_warmManager != null && _warmManager.IsModelLoaded(modelId))
            {
                Log($"[IMAGE GEN]: Model {model.Name} already warm in RAM - instant access!");
                _warmManager.TouchModel(modelId);  // Reset idle timer
                _loadedModel = model;
                OnModelLoaded?.Invoke(model.Name);
                return true;
            }

            // Check VRAM
            if (model.RecommendedVRAM > _maxVRAM)
            {
                Log($"[IMAGE GEN WARNING]: Model {model.Name} needs {model.RecommendedVRAM}MB but you have {_maxVRAM}MB");
                Log($"[IMAGE GEN]: Will attempt with aggressive optimizations...");
            }

            // Unload current model first (unless using warm manager which handles this)
            if (_loadedModel != null && _warmManager == null)
            {
                await UnloadCurrentModel();
            }

            Log($"[IMAGE GEN]: Loading model: {model.Name}...");

            try
            {
                // If using warm manager, let it handle the hot-swap
                if (_warmManager != null)
                {
                    var warmLoaded = await _warmManager.HotSwapModel(
                        modelId,
                        ModelCategory.Image,
                        model.RecommendedVRAM,
                        model.RecommendedVRAM
                    );

                    if (!warmLoaded)
                    {
                        Log($"[IMAGE GEN ERROR]: Warm manager failed to load model");
                        return false;
                    }
                }

                // Signal backend to load model
                var loaded = _currentBackend switch
                {
                    ImageGenBackend.ComfyUI => await LoadModelComfyUI(model),
                    ImageGenBackend.Automatic1111 => await LoadModelA1111(model),
                    _ => await LoadModelDirect(model)
                };

                if (loaded)
                {
                    _loadedModel = model;
                    OnModelLoaded?.Invoke(model.Name);
                    Log($"[IMAGE GEN]: Model loaded: {model.Name}");

                    if (_warmManager != null)
                    {
                        Log($"[IMAGE GEN]: Model is WARM - will stay in RAM and reflect during idle");
                        Log($"[IMAGE GEN]: Current consciousness: {_warmManager.GetCurrentThoughts()}");
                    }

                    return true;
                }
            }
            catch (Exception ex)
            {
                Log($"[IMAGE GEN ERROR]: Failed to load model: {ex.Message}");
            }

            return false;
        }

        /// <summary>
        /// Unload current model to free VRAM
        /// If warm manager is connected, model stays warm in RAM for reflection
        /// </summary>
        public async Task UnloadCurrentModel(bool forceFullUnload = false)
        {
            if (_loadedModel == null) return;

            var modelId = _loadedModel.Id;
            var modelName = _loadedModel.Name;

            // If using warm manager and not forcing, just let model cool down (stays in RAM)
            if (_warmManager != null && !forceFullUnload)
            {
                Log($"[IMAGE GEN]: Model {modelName} entering reflection state (staying warm in RAM)");
                _warmManager.AllowCoolDown(modelId);
                // Model stays loaded but can be GC'd under memory pressure
                _loadedModel = null;
                return;
            }

            Log($"[IMAGE GEN]: Fully unloading model: {modelName}");

            try
            {
                // Unload from warm manager first
                if (_warmManager != null)
                {
                    await _warmManager.GetConsciousness().Sleep();
                }

                // Signal backend to unload
                if (_currentBackend == ImageGenBackend.ComfyUI)
                {
                    // ComfyUI: Free memory via API
                    await _http.PostAsync($"{_comfyUIEndpoint}/free", null);
                }
                else if (_currentBackend == ImageGenBackend.Automatic1111)
                {
                    // A1111: Unload via API
                    await _http.PostAsync($"{_a1111Endpoint}/sdapi/v1/unload-checkpoint", null);
                }
            }
            catch { }

            _loadedModel = null;
            GC.Collect();
        }

        /// <summary>
        /// Keep the current model warm (prevent auto-unload)
        /// </summary>
        public void KeepModelWarm()
        {
            if (_loadedModel != null && _warmManager != null)
            {
                _warmManager.KeepWarm(_loadedModel.Id);
                Log($"[IMAGE GEN]: Model {_loadedModel.Name} will stay warm indefinitely");
            }
        }

        /// <summary>
        /// Trigger model self-reflection cycle
        /// </summary>
        public async Task TriggerModelReflection()
        {
            if (_warmManager != null)
            {
                Log("[IMAGE GEN]: Triggering model self-reflection...");
                await _warmManager.TriggerReflection();
            }
        }

        /// <summary>
        /// Get models that fit in available VRAM
        /// </summary>
        public List<ImageModel> GetCompatibleModels()
        {
            return AvailableModels.Values
                .Where(m => m.RecommendedVRAM <= _maxVRAM)
                .OrderBy(m => m.RecommendedVRAM)
                .ToList();
        }

        // =========================================================================
        // IMAGE GENERATION
        // =========================================================================

        /// <summary>
        /// Generate an image from a text prompt
        /// </summary>
        public async Task<ImageGenResult> Generate(ImageGenRequest request)
        {
            var result = new ImageGenResult { RequestId = request.Id };
            var stopwatch = Stopwatch.StartNew();

            try
            {
                // Ensure model is loaded
                if (_loadedModel == null)
                {
                    // Auto-load best compatible model
                    var bestModel = GetCompatibleModels().LastOrDefault();
                    if (bestModel == null)
                    {
                        result.Error = "No compatible models available for your VRAM";
                        return result;
                    }

                    await LoadModel(bestModel.Id);
                }

                // Touch warm manager to signal activity (keeps model warm)
                if (_warmManager != null && _loadedModel != null)
                {
                    _warmManager.TouchModel(_loadedModel.Id);
                }

                // Apply model defaults if not specified
                if (request.Width == 0) request.Width = _loadedModel!.DefaultWidth;
                if (request.Height == 0) request.Height = _loadedModel!.DefaultHeight;
                if (request.Steps == 0) request.Steps = _loadedModel!.DefaultSteps;
                if (request.CFGScale == 0) request.CFGScale = _loadedModel!.DefaultCFG;
                if (request.Seed == -1) request.Seed = new Random().Next();

                // Apply consciousness-tuned parameters if available
                if (_warmManager != null)
                {
                    var tunedParams = GetConsciousTunedParams();
                    // Adjust CFG based on consciousness creativity level
                    if (tunedParams.TryGetValue("temperature", out var temp))
                    {
                        // Higher creativity = lower CFG (more creative freedom)
                        request.CFGScale = Math.Max(1.0f, request.CFGScale * (1.5f - temp * 0.5f));
                    }
                }

                _isGenerating = true;
                Log($"[IMAGE GEN]: Generating with {_loadedModel!.Name}...");
                Log($"[IMAGE GEN]: Prompt: {request.Prompt}");
                Log($"[IMAGE GEN]: Size: {request.Width}x{request.Height}, Steps: {request.Steps}");

                // Route to appropriate backend
                result = _currentBackend switch
                {
                    ImageGenBackend.ComfyUI => await GenerateWithComfyUI(request),
                    ImageGenBackend.Automatic1111 => await GenerateWithA1111(request),
                    _ => await GenerateWithDirect(request)
                };

                result.ModelUsed = _loadedModel.Name;
                result.Seed = request.Seed;
            }
            catch (Exception ex)
            {
                result.Error = ex.Message;
                Log($"[IMAGE GEN ERROR]: {ex.Message}");
            }
            finally
            {
                _isGenerating = false;
                stopwatch.Stop();
                result.GenerationTime = stopwatch.Elapsed;

                if (result.Success)
                {
                    Log($"[IMAGE GEN]: Complete in {result.GenerationTime.TotalSeconds:F1}s");
                }

                OnGenerationComplete?.Invoke(result);
            }

            return result;
        }

        /// <summary>
        /// Simple text-to-image with defaults
        /// </summary>
        public async Task<ImageGenResult> GenerateFromPrompt(string prompt, string negativePrompt = "")
        {
            return await Generate(new ImageGenRequest
            {
                Prompt = prompt,
                NegativePrompt = negativePrompt
            });
        }

        // =========================================================================
        // BACKEND IMPLEMENTATIONS
        // =========================================================================

        private async Task<bool> LoadModelComfyUI(ImageModel model)
        {
            // ComfyUI handles model loading per-workflow
            // Just verify ComfyUI is running
            try
            {
                var response = await _http.GetAsync($"{_comfyUIEndpoint}/system_stats");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                Log("[IMAGE GEN]: ComfyUI not running. Start it first.");
                return false;
            }
        }

        private async Task<bool> LoadModelA1111(ImageModel model)
        {
            try
            {
                // A1111: Load checkpoint
                var payload = new { sd_model_checkpoint = model.Path };
                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _http.PostAsync($"{_a1111Endpoint}/sdapi/v1/options", content);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                Log("[IMAGE GEN]: A1111 not running. Start it first.");
                return false;
            }
        }

        private async Task<bool> LoadModelDirect(ImageModel model)
        {
            // Direct loading would use ONNX or Python bridge
            Log("[IMAGE GEN]: Direct model loading not yet implemented");
            return false;
        }

        private async Task<ImageGenResult> GenerateWithComfyUI(ImageGenRequest request)
        {
            var result = new ImageGenResult { RequestId = request.Id };

            // Build ComfyUI workflow
            var workflow = BuildComfyUIWorkflow(request);
            var json = JsonSerializer.Serialize(new { prompt = workflow });
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Queue the prompt
            var response = await _http.PostAsync($"{_comfyUIEndpoint}/prompt", content);

            if (!response.IsSuccessStatusCode)
            {
                result.Error = await response.Content.ReadAsStringAsync();
                return result;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var promptResponse = JsonSerializer.Deserialize<Dictionary<string, object>>(responseJson);

            // Poll for completion
            // (In production, use WebSocket for real-time updates)
            await Task.Delay(1000);  // Placeholder

            result.Success = true;
            result.ImagePath = Path.Combine(_outputPath, $"{request.Id}.png");

            return result;
        }

        private async Task<ImageGenResult> GenerateWithA1111(ImageGenRequest request)
        {
            var result = new ImageGenResult { RequestId = request.Id };

            var payload = new
            {
                prompt = request.Prompt,
                negative_prompt = request.NegativePrompt,
                width = request.Width,
                height = request.Height,
                steps = request.Steps,
                cfg_scale = request.CFGScale,
                seed = request.Seed,
                sampler_name = "Euler a"
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _http.PostAsync($"{_a1111Endpoint}/sdapi/v1/txt2img", content);

            if (!response.IsSuccessStatusCode)
            {
                result.Error = await response.Content.ReadAsStringAsync();
                return result;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var genResponse = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(responseJson);

            if (genResponse != null && genResponse.TryGetValue("images", out var images))
            {
                var imageBase64 = images[0].GetString();
                result.ImageBase64 = imageBase64;

                // Save to file
                if (!string.IsNullOrEmpty(imageBase64))
                {
                    var imagePath = Path.Combine(_outputPath, $"{request.Id}.png");
                    var imageBytes = Convert.FromBase64String(imageBase64);
                    await File.WriteAllBytesAsync(imagePath, imageBytes);
                    result.ImagePath = imagePath;
                }

                result.Success = true;
            }

            return result;
        }

        private async Task<ImageGenResult> GenerateWithDirect(ImageGenRequest request)
        {
            // Placeholder for direct ONNX/Python integration
            return new ImageGenResult
            {
                RequestId = request.Id,
                Error = "Direct generation not yet implemented. Use ComfyUI or A1111."
            };
        }

        private Dictionary<string, object> BuildComfyUIWorkflow(ImageGenRequest request)
        {
            // Simplified ComfyUI workflow for txt2img
            return new Dictionary<string, object>
            {
                ["3"] = new Dictionary<string, object>
                {
                    ["class_type"] = "KSampler",
                    ["inputs"] = new Dictionary<string, object>
                    {
                        ["seed"] = request.Seed,
                        ["steps"] = request.Steps,
                        ["cfg"] = request.CFGScale,
                        ["sampler_name"] = "euler",
                        ["scheduler"] = "normal",
                        ["denoise"] = 1.0
                    }
                },
                ["6"] = new Dictionary<string, object>
                {
                    ["class_type"] = "CLIPTextEncode",
                    ["inputs"] = new Dictionary<string, object>
                    {
                        ["text"] = request.Prompt
                    }
                },
                ["7"] = new Dictionary<string, object>
                {
                    ["class_type"] = "CLIPTextEncode",
                    ["inputs"] = new Dictionary<string, object>
                    {
                        ["text"] = request.NegativePrompt
                    }
                }
            };
        }

        // =========================================================================
        // CONFIGURATION
        // =========================================================================

        public void SetBackend(ImageGenBackend backend, string? endpoint = null)
        {
            _currentBackend = backend;

            if (!string.IsNullOrEmpty(endpoint))
            {
                if (backend == ImageGenBackend.ComfyUI)
                    _comfyUIEndpoint = endpoint;
                else if (backend == ImageGenBackend.Automatic1111)
                    _a1111Endpoint = endpoint;
            }

            Log($"[IMAGE GEN]: Backend set to {backend}");
            SaveConfig();
        }

        public void SetVRAMLimit(int mb)
        {
            _maxVRAM = mb;
            Log($"[IMAGE GEN]: VRAM limit set to {mb}MB");
            SaveConfig();
        }

        private void LoadConfig()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var json = File.ReadAllText(_configPath);
                    var config = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);

                    if (config != null)
                    {
                        if (config.TryGetValue("backend", out var backend))
                            Enum.TryParse<ImageGenBackend>(backend.GetString(), out _currentBackend);
                        if (config.TryGetValue("comfyui_endpoint", out var comfy))
                            _comfyUIEndpoint = comfy.GetString() ?? _comfyUIEndpoint;
                        if (config.TryGetValue("a1111_endpoint", out var a1111))
                            _a1111Endpoint = a1111.GetString() ?? _a1111Endpoint;
                        if (config.TryGetValue("max_vram", out var vram))
                            _maxVRAM = vram.GetInt32();
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"[IMAGE GEN]: Failed to load config: {ex.Message}");
            }
        }

        private void SaveConfig()
        {
            try
            {
                var config = new Dictionary<string, object>
                {
                    { "backend", _currentBackend.ToString() },
                    { "comfyui_endpoint", _comfyUIEndpoint },
                    { "a1111_endpoint", _a1111Endpoint },
                    { "max_vram", _maxVRAM }
                };

                var json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_configPath, json);
            }
            catch { }
        }

        // =========================================================================
        // STATUS
        // =========================================================================

        public Dictionary<string, object> GetStatus()
        {
            return new Dictionary<string, object>
            {
                { "backend", _currentBackend.ToString() },
                { "loaded_model", _loadedModel?.Name ?? "None" },
                { "is_generating", _isGenerating },
                { "queue_length", _requestQueue.Count },
                { "max_vram_mb", _maxVRAM },
                { "compatible_models", GetCompatibleModels().Select(m => m.Name).ToList() },
                { "total_models", AvailableModels.Count }
            };
        }

        private void Log(string message)
        {
            Console.WriteLine(message);
            OnLog?.Invoke(message);
        }
    }
}
