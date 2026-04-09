/*
 * AURA CLOUD IMAGE GENERATION
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Cloud-based image generation for demos when local setup isn't ready
 * - Stability AI (Stable Diffusion)
 * - OpenAI DALL-E 3
 * - Replicate API
 * - Together AI
 *
 * USE CASE: Quick demos without ComfyUI/A1111 running locally
 * The local system (AuraLocalImageGen) is preferred for production
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum CloudImageProvider
    {
        HuggingFace,    // SDXL-Turbo, Flux, many free models (RECOMMENDED)
        Gemini,         // Google Gemini with Imagen 3
        VertexAI,       // Google Cloud Vertex AI (Imagen)
        StabilityAI,    // Stable Diffusion via API
        OpenAI,         // DALL-E 3
        Replicate,      // Various models
        TogetherAI,     // Flux, SD models
        Fal             // Fast inference
    }

    public class CloudImageGenConfig
    {
        public string? HuggingFaceApiKey { get; set; }  // FREE tier available!
        public string? GeminiApiKey { get; set; }       // Google AI Studio key
        public string? VertexProjectId { get; set; }   // Google Cloud project
        public string? VertexLocation { get; set; } = "us-central1";
        public string? StabilityApiKey { get; set; }
        public string? OpenAIApiKey { get; set; }
        public string? ReplicateApiKey { get; set; }
        public string? TogetherApiKey { get; set; }
        public string? FalApiKey { get; set; }
        public CloudImageProvider PreferredProvider { get; set; } = CloudImageProvider.HuggingFace;

        // Hugging Face model selection
        public string HuggingFaceModel { get; set; } = "stabilityai/sdxl-turbo";  // Fast and free!
    }

    public class AuraCloudImageGen
    {
        private readonly HttpClient _http;
        private readonly string _outputPath = "E:/AuraNova_DataLake/Generated/Images";
        private readonly string _configPath = "E:/AuraNova_DataLake/Config/cloud_imagegen.json";

        private CloudImageGenConfig _config;

        public event Action<string>? OnLog;
        public event Action<float>? OnProgress;

        public bool IsConfigured =>
            !string.IsNullOrEmpty(_config.StabilityApiKey) ||
            !string.IsNullOrEmpty(_config.OpenAIApiKey) ||
            !string.IsNullOrEmpty(_config.ReplicateApiKey) ||
            !string.IsNullOrEmpty(_config.TogetherApiKey);

        public AuraCloudImageGen()
        {
            _http = new HttpClient();
            _http.Timeout = TimeSpan.FromMinutes(5);

            Directory.CreateDirectory(_outputPath);
            Directory.CreateDirectory(Path.GetDirectoryName(_configPath)!);

            _config = LoadConfig();

            Log("[CLOUD IMAGE]: Initialized");
            Log($"[CLOUD IMAGE]: Configured providers: {GetConfiguredProviders()}");
        }

        private string GetConfiguredProviders()
        {
            var providers = new List<string>();
            if (!string.IsNullOrEmpty(_config.HuggingFaceApiKey)) providers.Add("Hugging Face (SDXL-Turbo)");
            if (!string.IsNullOrEmpty(_config.GeminiApiKey)) providers.Add("Google Gemini (Imagen 3)");
            if (!string.IsNullOrEmpty(_config.VertexProjectId)) providers.Add("Google Vertex AI");
            if (!string.IsNullOrEmpty(_config.StabilityApiKey)) providers.Add("Stability AI");
            if (!string.IsNullOrEmpty(_config.OpenAIApiKey)) providers.Add("OpenAI/DALL-E");
            if (!string.IsNullOrEmpty(_config.ReplicateApiKey)) providers.Add("Replicate");
            if (!string.IsNullOrEmpty(_config.TogetherApiKey)) providers.Add("Together AI");
            if (!string.IsNullOrEmpty(_config.FalApiKey)) providers.Add("Fal.ai");
            return providers.Count > 0 ? string.Join(", ", providers) : "NONE - Add API keys!";
        }

        // =========================================================================
        // API KEY CONFIGURATION
        // =========================================================================

        public void SetApiKey(CloudImageProvider provider, string apiKey)
        {
            switch (provider)
            {
                case CloudImageProvider.HuggingFace:
                    _config.HuggingFaceApiKey = apiKey;
                    break;
                case CloudImageProvider.Gemini:
                    _config.GeminiApiKey = apiKey;
                    break;
                case CloudImageProvider.VertexAI:
                    // For Vertex, apiKey is the project ID
                    _config.VertexProjectId = apiKey;
                    break;
                case CloudImageProvider.StabilityAI:
                    _config.StabilityApiKey = apiKey;
                    break;
                case CloudImageProvider.OpenAI:
                    _config.OpenAIApiKey = apiKey;
                    break;
                case CloudImageProvider.Replicate:
                    _config.ReplicateApiKey = apiKey;
                    break;
                case CloudImageProvider.TogetherAI:
                    _config.TogetherApiKey = apiKey;
                    break;
                case CloudImageProvider.Fal:
                    _config.FalApiKey = apiKey;
                    break;
            }
            SaveConfig();
            Log($"[CLOUD IMAGE]: {provider} API key configured");
        }

        /// <summary>
        /// Configure Google Vertex AI
        /// </summary>
        public void SetVertexConfig(string projectId, string location = "us-central1")
        {
            _config.VertexProjectId = projectId;
            _config.VertexLocation = location;
            SaveConfig();
            Log($"[CLOUD IMAGE]: Vertex AI configured for project {projectId} in {location}");
        }

        /// <summary>
        /// Set which Hugging Face model to use
        /// Popular options:
        /// - stabilityai/sdxl-turbo (FAST, 1-4 steps)
        /// - black-forest-labs/FLUX.1-dev
        /// - stabilityai/stable-diffusion-xl-base-1.0
        /// - runwayml/stable-diffusion-v1-5
        /// </summary>
        public void SetHuggingFaceModel(string modelId)
        {
            _config.HuggingFaceModel = modelId;
            SaveConfig();
            Log($"[CLOUD IMAGE]: Hugging Face model set to {modelId}");
        }

        public void SetPreferredProvider(CloudImageProvider provider)
        {
            _config.PreferredProvider = provider;
            SaveConfig();
            Log($"[CLOUD IMAGE]: Preferred provider set to {provider}");
        }

        // =========================================================================
        // UNIFIED GENERATION INTERFACE
        // =========================================================================

        /// <summary>
        /// Generate an image using the best available cloud provider
        /// </summary>
        public async Task<ImageGenResult> GenerateAsync(string prompt, int width = 1024, int height = 1024, string negativePrompt = "")
        {
            var requestId = Guid.NewGuid().ToString("N")[..8];
            var result = new ImageGenResult { RequestId = requestId };

            // Try preferred provider first, then fallback
            var providersToTry = GetProviderPriority();

            foreach (var provider in providersToTry)
            {
                if (!IsProviderConfigured(provider))
                    continue;

                Log($"[CLOUD IMAGE]: Trying {provider}...");

                try
                {
                    result = provider switch
                    {
                        CloudImageProvider.HuggingFace => await GenerateWithHuggingFace(prompt, width, height, negativePrompt, requestId),
                        CloudImageProvider.Gemini => await GenerateWithGemini(prompt, width, height, negativePrompt, requestId),
                        CloudImageProvider.VertexAI => await GenerateWithVertexImagen(prompt, width, height, negativePrompt, requestId),
                        CloudImageProvider.StabilityAI => await GenerateWithStability(prompt, width, height, negativePrompt, requestId),
                        CloudImageProvider.OpenAI => await GenerateWithOpenAI(prompt, width, height, requestId),
                        CloudImageProvider.TogetherAI => await GenerateWithTogether(prompt, width, height, negativePrompt, requestId),
                        CloudImageProvider.Replicate => await GenerateWithReplicate(prompt, width, height, negativePrompt, requestId),
                        _ => new ImageGenResult { Error = "Provider not implemented" }
                    };

                    if (result.Success)
                    {
                        Log($"[CLOUD IMAGE]: Success with {provider}!");
                        result.ModelUsed = provider.ToString();
                        return result;
                    }
                }
                catch (Exception ex)
                {
                    Log($"[CLOUD IMAGE]: {provider} failed: {ex.Message}");
                }
            }

            result.Error = "All cloud providers failed or not configured. Add API keys!";
            return result;
        }

        private List<CloudImageProvider> GetProviderPriority()
        {
            var providers = new List<CloudImageProvider>
            {
                _config.PreferredProvider,
                CloudImageProvider.HuggingFace,
                CloudImageProvider.Gemini,
                CloudImageProvider.TogetherAI,
                CloudImageProvider.StabilityAI,
                CloudImageProvider.VertexAI,
                CloudImageProvider.OpenAI,
                CloudImageProvider.Replicate,
                CloudImageProvider.Fal
            };
            return providers.Distinct().ToList();
        }

        private bool IsProviderConfigured(CloudImageProvider provider)
        {
            return provider switch
            {
                CloudImageProvider.HuggingFace => !string.IsNullOrEmpty(_config.HuggingFaceApiKey),
                CloudImageProvider.Gemini => !string.IsNullOrEmpty(_config.GeminiApiKey),
                CloudImageProvider.VertexAI => !string.IsNullOrEmpty(_config.VertexProjectId),
                CloudImageProvider.StabilityAI => !string.IsNullOrEmpty(_config.StabilityApiKey),
                CloudImageProvider.OpenAI => !string.IsNullOrEmpty(_config.OpenAIApiKey),
                CloudImageProvider.Replicate => !string.IsNullOrEmpty(_config.ReplicateApiKey),
                CloudImageProvider.TogetherAI => !string.IsNullOrEmpty(_config.TogetherApiKey),
                CloudImageProvider.Fal => !string.IsNullOrEmpty(_config.FalApiKey),
                _ => false
            };
        }

        // =========================================================================
        // HUGGING FACE (SDXL-Turbo, Flux, etc.) - FREE TIER!
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithHuggingFace(string prompt, int width, int height, string negativePrompt, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            var modelId = _config.HuggingFaceModel;
            var url = $"https://api-inference.huggingface.co/models/{modelId}";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.HuggingFaceApiKey);

            // Simple payload for most models
            var payload = new
            {
                inputs = prompt,
                parameters = new
                {
                    negative_prompt = negativePrompt,
                    width = Math.Min(width, 1024),
                    height = Math.Min(height, 1024),
                    num_inference_steps = modelId.Contains("turbo") ? 4 : 30,
                    guidance_scale = modelId.Contains("turbo") ? 0.0 : 7.5
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.3f);
            var response = await _http.SendAsync(request);
            OnProgress?.Invoke(0.7f);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                result.Error = $"Hugging Face error: {error}";
                return result;
            }

            // HF returns raw image bytes
            var imageBytes = await response.Content.ReadAsByteArrayAsync();
            var imagePath = Path.Combine(_outputPath, $"hf_{requestId}.png");
            await File.WriteAllBytesAsync(imagePath, imageBytes);

            result.Success = true;
            result.ImagePath = imagePath;
            result.ImageBase64 = Convert.ToBase64String(imageBytes);
            result.ModelUsed = modelId;

            OnProgress?.Invoke(1.0f);
            return result;
        }

        // =========================================================================
        // GOOGLE GEMINI (Imagen 3 via Gemini API)
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithGemini(string prompt, int width, int height, string negativePrompt, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            // Gemini Imagen API endpoint
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={_config.GeminiApiKey}";

            var request = new HttpRequestMessage(HttpMethod.Post, url);

            // Gemini Imagen payload
            var payload = new
            {
                instances = new[]
                {
                    new { prompt = prompt }
                },
                parameters = new
                {
                    sampleCount = 1,
                    aspectRatio = width == height ? "1:1" : (width > height ? "16:9" : "9:16"),
                    negativePrompt = negativePrompt,
                    personGeneration = "allow_adult"
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.3f);
            var response = await _http.SendAsync(request);
            OnProgress?.Invoke(0.7f);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                result.Error = $"Gemini error: {error}";
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<GeminiImageResponse>(json);

            if (data?.predictions?.Length > 0)
            {
                var imageBase64 = data.predictions[0].bytesBase64Encoded;
                var imagePath = Path.Combine(_outputPath, $"gemini_{requestId}.png");

                await File.WriteAllBytesAsync(imagePath, Convert.FromBase64String(imageBase64!));

                result.Success = true;
                result.ImagePath = imagePath;
                result.ImageBase64 = imageBase64;
                result.ModelUsed = "Imagen 3.0";
            }

            OnProgress?.Invoke(1.0f);
            return result;
        }

        private class GeminiImageResponse
        {
            public GeminiPrediction[]? predictions { get; set; }
        }

        private class GeminiPrediction
        {
            public string? bytesBase64Encoded { get; set; }
            public string? mimeType { get; set; }
        }

        // =========================================================================
        // GOOGLE VERTEX AI (Imagen)
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithVertexImagen(string prompt, int width, int height, string negativePrompt, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            var projectId = _config.VertexProjectId;
            var location = _config.VertexLocation ?? "us-central1";

            // Vertex AI endpoint for Imagen
            var url = $"https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/imagen-3.0-generate-001:predict";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            // Note: In production, use Application Default Credentials (ADC)
            // For demo, you'd need OAuth token - this is a simplified version

            var payload = new
            {
                instances = new[]
                {
                    new { prompt = prompt }
                },
                parameters = new
                {
                    sampleCount = 1,
                    aspectRatio = width == height ? "1:1" : (width > height ? "16:9" : "9:16"),
                    negativePrompt = negativePrompt
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.3f);
            var response = await _http.SendAsync(request);
            OnProgress?.Invoke(0.7f);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                result.Error = $"Vertex AI error: {error}. Note: Requires ADC authentication.";
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<VertexImageResponse>(json);

            if (data?.predictions?.Length > 0)
            {
                var imageBase64 = data.predictions[0].bytesBase64Encoded;
                var imagePath = Path.Combine(_outputPath, $"vertex_{requestId}.png");

                await File.WriteAllBytesAsync(imagePath, Convert.FromBase64String(imageBase64!));

                result.Success = true;
                result.ImagePath = imagePath;
                result.ImageBase64 = imageBase64;
                result.ModelUsed = "Vertex Imagen 3.0";
            }

            OnProgress?.Invoke(1.0f);
            return result;
        }

        private class VertexImageResponse
        {
            public VertexPrediction[]? predictions { get; set; }
        }

        private class VertexPrediction
        {
            public string? bytesBase64Encoded { get; set; }
            public string? mimeType { get; set; }
        }

        // =========================================================================
        // STABILITY AI (Stable Diffusion)
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithStability(string prompt, int width, int height, string negativePrompt, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            // Use Stability AI's latest API
            var url = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.StabilityApiKey);

            var payload = new
            {
                text_prompts = new[]
                {
                    new { text = prompt, weight = 1.0 },
                    new { text = negativePrompt, weight = -1.0 }
                },
                cfg_scale = 7,
                height = Math.Min(height, 1024),
                width = Math.Min(width, 1024),
                steps = 30,
                samples = 1
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.3f);
            var response = await _http.SendAsync(request);
            OnProgress?.Invoke(0.7f);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                result.Error = $"Stability AI error: {error}";
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<StabilityResponse>(json);

            if (data?.artifacts?.Length > 0)
            {
                var imageBase64 = data.artifacts[0].base64;
                var imagePath = Path.Combine(_outputPath, $"cloud_{requestId}.png");

                await File.WriteAllBytesAsync(imagePath, Convert.FromBase64String(imageBase64));

                result.Success = true;
                result.ImagePath = imagePath;
                result.ImageBase64 = imageBase64;
            }

            OnProgress?.Invoke(1.0f);
            return result;
        }

        private class StabilityResponse
        {
            public StabilityArtifact[]? artifacts { get; set; }
        }

        private class StabilityArtifact
        {
            public string base64 { get; set; } = "";
            public string finishReason { get; set; } = "";
        }

        // =========================================================================
        // OPENAI DALL-E 3
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithOpenAI(string prompt, int width, int height, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            var url = "https://api.openai.com/v1/images/generations";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.OpenAIApiKey);

            // DALL-E 3 only supports specific sizes
            var size = (width, height) switch
            {
                ( >= 1024, >= 1024) => "1024x1024",
                ( >= 1024, _) => "1792x1024",
                (_, >= 1024) => "1024x1792",
                _ => "1024x1024"
            };

            var payload = new
            {
                model = "dall-e-3",
                prompt = prompt,
                n = 1,
                size = size,
                quality = "standard",
                response_format = "b64_json"
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.3f);
            var response = await _http.SendAsync(request);
            OnProgress?.Invoke(0.7f);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                result.Error = $"OpenAI error: {error}";
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<OpenAIImageResponse>(json);

            if (data?.data?.Length > 0)
            {
                var imageBase64 = data.data[0].b64_json;
                var imagePath = Path.Combine(_outputPath, $"dalle_{requestId}.png");

                await File.WriteAllBytesAsync(imagePath, Convert.FromBase64String(imageBase64!));

                result.Success = true;
                result.ImagePath = imagePath;
                result.ImageBase64 = imageBase64;
            }

            OnProgress?.Invoke(1.0f);
            return result;
        }

        private class OpenAIImageResponse
        {
            public OpenAIImageData[]? data { get; set; }
        }

        private class OpenAIImageData
        {
            public string? b64_json { get; set; }
            public string? url { get; set; }
            public string? revised_prompt { get; set; }
        }

        // =========================================================================
        // TOGETHER AI (Flux, SD models)
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithTogether(string prompt, int width, int height, string negativePrompt, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            var url = "https://api.together.xyz/v1/images/generations";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.TogetherApiKey);

            var payload = new
            {
                model = "black-forest-labs/FLUX.1-schnell-Free",  // Free tier
                prompt = prompt,
                negative_prompt = negativePrompt,
                width = Math.Min(width, 1024),
                height = Math.Min(height, 1024),
                steps = 4,  // Schnell is fast
                n = 1,
                response_format = "b64_json"
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.3f);
            var response = await _http.SendAsync(request);
            OnProgress?.Invoke(0.7f);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                result.Error = $"Together AI error: {error}";
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<TogetherImageResponse>(json);

            if (data?.data?.Length > 0)
            {
                var imageBase64 = data.data[0].b64_json;
                var imagePath = Path.Combine(_outputPath, $"flux_{requestId}.png");

                await File.WriteAllBytesAsync(imagePath, Convert.FromBase64String(imageBase64!));

                result.Success = true;
                result.ImagePath = imagePath;
                result.ImageBase64 = imageBase64;
            }

            OnProgress?.Invoke(1.0f);
            return result;
        }

        private class TogetherImageResponse
        {
            public TogetherImageData[]? data { get; set; }
        }

        private class TogetherImageData
        {
            public string? b64_json { get; set; }
        }

        // =========================================================================
        // REPLICATE (Various models)
        // =========================================================================

        private async Task<ImageGenResult> GenerateWithReplicate(string prompt, int width, int height, string negativePrompt, string requestId)
        {
            var result = new ImageGenResult { RequestId = requestId };

            // Create prediction
            var url = "https://api.replicate.com/v1/predictions";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.ReplicateApiKey);

            // Use SDXL
            var payload = new
            {
                version = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",  // SDXL
                input = new
                {
                    prompt = prompt,
                    negative_prompt = negativePrompt,
                    width = Math.Min(width, 1024),
                    height = Math.Min(height, 1024)
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            OnProgress?.Invoke(0.2f);
            var createResponse = await _http.SendAsync(request);

            if (!createResponse.IsSuccessStatusCode)
            {
                result.Error = await createResponse.Content.ReadAsStringAsync();
                return result;
            }

            var createJson = await createResponse.Content.ReadAsStringAsync();
            var prediction = JsonSerializer.Deserialize<ReplicatePrediction>(createJson);

            if (prediction == null)
            {
                result.Error = "Failed to create prediction";
                return result;
            }

            // Poll for completion
            var pollUrl = $"https://api.replicate.com/v1/predictions/{prediction.id}";

            for (int i = 0; i < 60; i++)  // Max 60 seconds
            {
                await Task.Delay(1000);
                OnProgress?.Invoke(0.2f + (0.7f * i / 60f));

                var pollRequest = new HttpRequestMessage(HttpMethod.Get, pollUrl);
                pollRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.ReplicateApiKey);

                var pollResponse = await _http.SendAsync(pollRequest);
                var pollJson = await pollResponse.Content.ReadAsStringAsync();
                prediction = JsonSerializer.Deserialize<ReplicatePrediction>(pollJson);

                if (prediction?.status == "succeeded")
                {
                    if (prediction.output is JsonElement outputElement)
                    {
                        string? imageUrl = null;
                        if (outputElement.ValueKind == JsonValueKind.Array)
                        {
                            imageUrl = outputElement[0].GetString();
                        }
                        else if (outputElement.ValueKind == JsonValueKind.String)
                        {
                            imageUrl = outputElement.GetString();
                        }

                        if (!string.IsNullOrEmpty(imageUrl))
                        {
                            // Download image
                            var imageBytes = await _http.GetByteArrayAsync(imageUrl);
                            var imagePath = Path.Combine(_outputPath, $"replicate_{requestId}.png");
                            await File.WriteAllBytesAsync(imagePath, imageBytes);

                            result.Success = true;
                            result.ImagePath = imagePath;
                            result.ImageBase64 = Convert.ToBase64String(imageBytes);
                        }
                    }
                    break;
                }
                else if (prediction?.status == "failed")
                {
                    result.Error = prediction.error ?? "Generation failed";
                    break;
                }
            }

            OnProgress?.Invoke(1.0f);
            return result;
        }

        private class ReplicatePrediction
        {
            public string id { get; set; } = "";
            public string status { get; set; } = "";
            public object? output { get; set; }
            public string? error { get; set; }
        }

        // =========================================================================
        // CONFIG PERSISTENCE
        // =========================================================================

        private CloudImageGenConfig LoadConfig()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var json = File.ReadAllText(_configPath);
                    return JsonSerializer.Deserialize<CloudImageGenConfig>(json) ?? new CloudImageGenConfig();
                }
            }
            catch { }
            return new CloudImageGenConfig();
        }

        private void SaveConfig()
        {
            try
            {
                var json = JsonSerializer.Serialize(_config, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_configPath, json);
            }
            catch { }
        }

        private void Log(string message)
        {
            Console.WriteLine(message);
            OnLog?.Invoke(message);
        }
    }
}
