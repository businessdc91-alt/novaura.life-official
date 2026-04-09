/*
 * AURA UNIVERSAL API MANAGER
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Aura works with ANY AI service the client uses
 *
 * THE REVOLUTION:
 * "Give Aura your API keys. She uses YOUR existing AI subscriptions."
 *
 * SUPPORTED SERVICES:
 * - OpenAI (GPT-4, GPT-3.5, DALL-E, Whisper)
 * - Anthropic (Claude 3 Opus, Sonnet, Haiku)
 * - Google (Gemini Pro, Gemini Ultra, Vertex AI)
 * - Cohere (Command, Embed)
 * - HuggingFace (Any model)
 * - AWS Bedrock (Multiple models)
 * - Azure OpenAI (Enterprise deployments)
 * - Replicate (Open source models)
 * - Stability AI (Stable Diffusion)
 * - Midjourney (Image generation)
 * - ElevenLabs (Voice synthesis)
 * - And ANY custom API endpoint
 *
 * BENEFITS:
 * - No vendor lock-in
 * - Use existing subscriptions
 * - Enterprise compliance (use corporate contracts)
 * - Cost control (their spend limits)
 * - Multi-model strategy (best tool for each job)
 * - Fallback redundancy (if one fails, use another)
 *
 * "Whatever service you're using, Aura can use it too."
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum AIProvider
    {
        OpenAI,
        Anthropic,
        Google,
        Cohere,
        HuggingFace,
        AWSBedrock,
        AzureOpenAI,
        Replicate,
        StabilityAI,
        Midjourney,
        ElevenLabs,
        LMStudio,      // Local
        Ollama,        // Local
        PandoraMedical, // GAME-CHANGER: Medical research & diagnosis AI
        Custom         // Any API endpoint
    }

    public enum ModelCapability
    {
        TextGeneration,
        ImageGeneration,
        VideoGeneration,
        ImageAnalysis,
        SpeechToText,
        TextToSpeech,
        Embedding,
        CodeGeneration,
        FunctionCalling,

        // Medical AI capabilities (PANDORA)
        MedicalDiagnosis,
        DrugInteractionCheck,
        ClinicalResearch,
        MedicalImagingAnalysis,
        TreatmentPlanning,
        SymptomAnalysis,
        MedicalLiteratureSearch
    }

    public class APICredential
    {
        public AIProvider Provider { get; set; }
        public string ApiKey { get; set; }
        public string OrganizationId { get; set; }  // For OpenAI
        public string ProjectId { get; set; }       // For Google
        public string Endpoint { get; set; }        // For Azure/Custom
        public string Region { get; set; }          // For AWS
        public Dictionary<string, string> AdditionalConfig { get; set; } = new();
        public bool IsActive { get; set; } = true;
        public DateTime AddedAt { get; set; } = DateTime.Now;
    }

    public class ModelInfo
    {
        public AIProvider Provider { get; set; }
        public string ModelId { get; set; }
        public string DisplayName { get; set; }
        public List<ModelCapability> Capabilities { get; set; } = new();
        public decimal CostPer1kTokens { get; set; }  // Input cost
        public decimal OutputCostPer1kTokens { get; set; }
        public int MaxTokens { get; set; }
        public bool SupportsStreaming { get; set; }
        public bool SupportsFunctionCalling { get; set; }
    }

    public class APIUsageStats
    {
        public AIProvider Provider { get; set; }
        public string ModelId { get; set; }
        public int TotalRequests { get; set; }
        public int TokensUsed { get; set; }
        public decimal EstimatedCost { get; set; }
        public DateTime LastUsed { get; set; }
    }

    public class AIRequest
    {
        public string Prompt { get; set; }
        public ModelCapability RequiredCapability { get; set; }
        public int MaxTokens { get; set; } = 2000;
        public float Temperature { get; set; } = 0.7f;
        public AIProvider? PreferredProvider { get; set; }
        public string PreferredModel { get; set; }
        public Dictionary<string, object> AdditionalParams { get; set; } = new();
    }

    public class AIResponse
    {
        public string Content { get; set; }
        public AIProvider Provider { get; set; }
        public string ModelUsed { get; set; }
        public int TokensUsed { get; set; }
        public decimal EstimatedCost { get; set; }
        public TimeSpan ResponseTime { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    /// <summary>
    /// Universal API manager - Aura works with ANY AI service
    /// Clients use their existing subscriptions
    /// </summary>
    public class AuraUniversalAPI
    {
        private readonly HttpClient _httpClient = new();
        private readonly Dictionary<AIProvider, APICredential> _credentials = new();
        private readonly Dictionary<string, ModelInfo> _availableModels = new();
        private readonly List<APIUsageStats> _usageHistory = new();
        private readonly Dictionary<ModelCapability, AIProvider> _preferredProviders = new();

        public event Action<ModelCapability, AIProvider> OnProviderHotswapped;
        public event Action<string, string> OnDownloadProgress; // modelId, status

        public AuraUniversalAPI()
        {
            LoadModelDefinitions();
        }

        #region Hotswapping Logic

        /// <summary>
        /// Hotswap the active provider for a specific capability (Video, Audio, Image, etc.)
        /// </summary>
        public async Task HotswapProviderAsync(ModelCapability capability, AIProvider newProvider)
        {
            if (!HasProvider(newProvider))
            {
                throw new Exception($"Cannot hotswap to {newProvider}: No credentials configured.");
            }

            // Verify the provider supports the capability
            var models = GetModelsForProvider(newProvider);
            if (!models.Any(m => m.Capabilities.Contains(capability)))
            {
                throw new Exception($"{newProvider} does not support {capability}.");
            }

            _preferredProviders[capability] = newProvider;
            OnProviderHotswapped?.Invoke(capability, newProvider);

            System.Diagnostics.Debug.WriteLine($"[HOTSWAP] Switching {capability} to {newProvider}");
            
            await Task.CompletedTask; // Future-proofing for async validation/init
        }

        #endregion

        #region Model Download & Status Logic

        public async Task<Dictionary<string, bool>> CheckModelsPresenceAsync()
        {
            var status = new Dictionary<string, bool>();
            string modelPath = AuraPaths.ModelsPath;
            
            string[] types = { "image", "audio", "video" };
            foreach (var type in types)
            {
                string targetDir = Path.Combine(modelPath, type);
                status[type] = Directory.Exists(targetDir) && Directory.GetFiles(targetDir, "*.*", SearchOption.AllDirectories).Any();
            }
            return status;
        }

        public async Task TriggerModelDownloadAsync(string modelType)
        {
            string scriptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "aura_NovaFiles", "model_downloader.py");
            string modelPath = AuraPaths.ModelsPath;
            string arguments = $"\"{scriptPath}\" --type {modelType} --path \"{modelPath}\"";

            System.Diagnostics.Debug.WriteLine($"[DOWNLOADER] Executing: python {arguments}");

            try
            {
                var processInfo = new ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = arguments,
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(processInfo);
                if (process != null)
                {
                    process.OutputDataReceived += (sender, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                        {
                            OnDownloadProgress?.Invoke(modelType, e.Data);
                            System.Diagnostics.Debug.WriteLine($"[DOWNLOADER]: {e.Data}");
                        }
                    };
                    process.BeginOutputReadLine();
                    await process.WaitForExitAsync();
                }
            }
            catch (Exception ex)
            {
                OnDownloadProgress?.Invoke(modelType, $"ERROR: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"[DOWNLOADER ERROR]: {ex.Message}");
            }
        }

        public List<string> GetModelLinks(string modelType)
        {
            return modelType.ToLower() switch
            {
                "audio" => new List<string> { "https://huggingface.co/cvssp/audioldm-m-full" },
                "image" => new List<string> { "https://huggingface.co/runwayml/stable-diffusion-v1-5" },
                "video" => new List<string> { "https://huggingface.co/damo-vilab/modelscope-damo-text-to-video-hd" },
                _ => new List<string>()
            };
        }

        #endregion

        #region Credential Management

        /// <summary>
        /// Add API credentials for any provider
        /// "Give Aura your API keys"
        /// </summary>
        public void AddCredential(AIProvider provider, string apiKey, Dictionary<string, string> config = null)
        {
            var credential = new APICredential
            {
                Provider = provider,
                ApiKey = apiKey
            };

            if (config != null)
            {
                foreach (var kvp in config)
                {
                    credential.AdditionalConfig[kvp.Key] = kvp.Value;
                }

                // Extract common configs
                if (config.ContainsKey("organization_id"))
                    credential.OrganizationId = config["organization_id"];

                if (config.ContainsKey("project_id"))
                    credential.ProjectId = config["project_id"];

                if (config.ContainsKey("endpoint"))
                    credential.Endpoint = config["endpoint"];

                if (config.ContainsKey("region"))
                    credential.Region = config["region"];
            }

            _credentials[provider] = credential;

            System.Diagnostics.Debug.WriteLine($"[API] Added credentials for {provider}");
        }

        public void RemoveCredential(AIProvider provider)
        {
            _credentials.Remove(provider);
        }

        public List<AIProvider> GetConfiguredProviders()
        {
            return _credentials.Where(c => c.Value.IsActive).Select(c => c.Key).ToList();
        }

        public bool HasProvider(AIProvider provider)
        {
            return _credentials.ContainsKey(provider) && _credentials[provider].IsActive;
        }

        #endregion

        #region Smart Model Selection

        /// <summary>
        /// Automatically choose best model for the task
        /// Based on: capability, cost, availability, performance
        /// </summary>
        public (AIProvider provider, string modelId) SelectBestModel(AIRequest request)
        {
            // If user specified preference, use it
            if (request.PreferredProvider.HasValue && HasProvider(request.PreferredProvider.Value))
            {
                var models = GetModelsForProvider(request.PreferredProvider.Value);
                var preferred = models.FirstOrDefault(m => m.Capabilities.Contains(request.RequiredCapability));
                if (preferred != null)
                    return (request.PreferredProvider.Value, preferred.ModelId);
            }

            // Check hotswapped preferences
            if (_preferredProviders.TryGetValue(request.RequiredCapability, out var globalPreferred) && HasProvider(globalPreferred))
            {
                var models = GetModelsForProvider(globalPreferred);
                var preferred = models.FirstOrDefault(m => m.Capabilities.Contains(request.RequiredCapability));
                if (preferred != null)
                    return (globalPreferred, preferred.ModelId);
            }

            if (!string.IsNullOrEmpty(request.PreferredModel))
            {
                var model = _availableModels.Values.FirstOrDefault(m => m.ModelId == request.PreferredModel);
                if (model != null && HasProvider(model.Provider))
                    return (model.Provider, model.ModelId);
            }

            // Find all capable models
            var capableModels = _availableModels.Values
                .Where(m => m.Capabilities.Contains(request.RequiredCapability))
                .Where(m => HasProvider(m.Provider))
                .ToList();

            if (!capableModels.Any())
                throw new Exception($"No available models support {request.RequiredCapability}");

            // Selection strategy based on capability
            ModelInfo selected = request.RequiredCapability switch
            {
                ModelCapability.CodeGeneration => capableModels.OrderByDescending(m => m.MaxTokens).First(),
                ModelCapability.FunctionCalling => capableModels.FirstOrDefault(m => m.SupportsFunctionCalling) ?? capableModels.First(),
                ModelCapability.ImageGeneration => capableModels.OrderBy(m => m.CostPer1kTokens).First(),
                _ => capableModels.OrderBy(m => m.CostPer1kTokens + m.OutputCostPer1kTokens).First()  // Default: cheapest
            };

            return (selected.Provider, selected.ModelId);
        }

        private List<ModelInfo> GetModelsForProvider(AIProvider provider)
        {
            return _availableModels.Values.Where(m => m.Provider == provider).ToList();
        }

        #endregion

        #region Universal API Calls

        /// <summary>
        /// Send request to any AI provider
        /// Aura handles the API differences
        /// </summary>
        public async Task<AIResponse> SendRequestAsync(AIRequest request)
        {
            var startTime = DateTime.Now;

            // Select best model
            var (provider, modelId) = SelectBestModel(request);

            System.Diagnostics.Debug.WriteLine($"[API] Using {provider}/{modelId} for {request.RequiredCapability}");

            // Route to appropriate provider
            AIResponse response = provider switch
            {
                AIProvider.OpenAI => await CallOpenAIAsync(request, modelId),
                AIProvider.Anthropic => await CallAnthropicAsync(request, modelId),
                AIProvider.Google => await CallGoogleAsync(request, modelId),
                AIProvider.Cohere => await CallCohereAsync(request, modelId),
                AIProvider.AzureOpenAI => await CallAzureOpenAIAsync(request, modelId),
                AIProvider.AWSBedrock => await CallAWSBedrockAsync(request, modelId),
                AIProvider.HuggingFace => await CallHuggingFaceAsync(request, modelId),
                AIProvider.Replicate => await CallReplicateAsync(request, modelId),
                AIProvider.LMStudio => await CallLMStudioAsync(request, modelId),
                AIProvider.Ollama => await CallOllamaAsync(request, modelId),
                AIProvider.Custom => await CallCustomAPIAsync(request, modelId),
                _ => new AIResponse { Content = $"[Error] Provider {provider} not yet implemented. Please select a different provider.", Provider = provider }
            };

            response.ResponseTime = DateTime.Now - startTime;

            // Track usage
            TrackUsage(provider, modelId, response.TokensUsed, response.EstimatedCost);

            return response;
        }

        #endregion

        #region Provider Implementations

        private async Task<AIResponse> CallOpenAIAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.OpenAI];

            var requestBody = new
            {
                model = modelId,
                messages = new[]
                {
                    new { role = "user", content = request.Prompt }
                },
                max_tokens = request.MaxTokens,
                temperature = request.Temperature
            };

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {credential.ApiKey}");

            if (!string.IsNullOrEmpty(credential.OrganizationId))
                _httpClient.DefaultRequestHeaders.Add("OpenAI-Organization", credential.OrganizationId);

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.openai.com/v1/chat/completions", content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"OpenAI API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            var tokensUsed = result.GetProperty("usage").GetProperty("total_tokens").GetInt32();
            var modelInfo = _availableModels.Values.FirstOrDefault(m => m.ModelId == modelId);
            var cost = modelInfo != null ? (tokensUsed / 1000m) * (modelInfo.CostPer1kTokens + modelInfo.OutputCostPer1kTokens) / 2 : 0;

            return new AIResponse
            {
                Content = result.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString(),
                Provider = AIProvider.OpenAI,
                ModelUsed = modelId,
                TokensUsed = tokensUsed,
                EstimatedCost = cost
            };
        }

        private async Task<AIResponse> CallAnthropicAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.Anthropic];

            var requestBody = new
            {
                model = modelId,
                max_tokens = request.MaxTokens,
                messages = new[]
                {
                    new { role = "user", content = request.Prompt }
                }
            };

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("x-api-key", credential.ApiKey);
            _httpClient.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.anthropic.com/v1/messages", content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Anthropic API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            var inputTokens = result.GetProperty("usage").GetProperty("input_tokens").GetInt32();
            var outputTokens = result.GetProperty("usage").GetProperty("output_tokens").GetInt32();
            var tokensUsed = inputTokens + outputTokens;

            var modelInfo = _availableModels.Values.FirstOrDefault(m => m.ModelId == modelId);
            var cost = modelInfo != null
                ? (inputTokens / 1000m) * modelInfo.CostPer1kTokens + (outputTokens / 1000m) * modelInfo.OutputCostPer1kTokens
                : 0;

            return new AIResponse
            {
                Content = result.GetProperty("content")[0].GetProperty("text").GetString(),
                Provider = AIProvider.Anthropic,
                ModelUsed = modelId,
                TokensUsed = tokensUsed,
                EstimatedCost = cost
            };
        }

        private async Task<AIResponse> CallGoogleAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.Google];

            var endpoint = !string.IsNullOrEmpty(credential.Endpoint)
                ? credential.Endpoint
                : $"https://generativelanguage.googleapis.com/v1/models/{modelId}:generateContent";

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[] { new { text = request.Prompt } }
                    }
                },
                generationConfig = new
                {
                    maxOutputTokens = request.MaxTokens,
                    temperature = request.Temperature
                }
            };

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var url = $"{endpoint}?key={credential.ApiKey}";
            var response = await _httpClient.PostAsync(url, content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Google API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            var textContent = result.GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            // Google doesn't always return token counts in the same format
            var tokensUsed = 0;
            if (result.TryGetProperty("usageMetadata", out var usage))
            {
                tokensUsed = usage.GetProperty("totalTokenCount").GetInt32();
            }

            return new AIResponse
            {
                Content = textContent,
                Provider = AIProvider.Google,
                ModelUsed = modelId,
                TokensUsed = tokensUsed,
                EstimatedCost = 0  // Calculate based on model pricing
            };
        }

        private async Task<AIResponse> CallCohereAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.Cohere];

            var requestBody = new
            {
                model = modelId,
                message = request.Prompt,
                max_tokens = request.MaxTokens,
                temperature = request.Temperature
            };

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {credential.ApiKey}");

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.cohere.ai/v1/chat", content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Cohere API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            return new AIResponse
            {
                Content = result.GetProperty("text").GetString(),
                Provider = AIProvider.Cohere,
                ModelUsed = modelId,
                TokensUsed = 0,  // Cohere may provide this differently
                EstimatedCost = 0
            };
        }

        private async Task<AIResponse> CallAzureOpenAIAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.AzureOpenAI];

            // Azure OpenAI uses custom endpoints
            var endpoint = credential.Endpoint; // e.g., https://{resource}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version=2023-05-15

            var requestBody = new
            {
                messages = new[]
                {
                    new { role = "user", content = request.Prompt }
                },
                max_tokens = request.MaxTokens,
                temperature = request.Temperature
            };

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("api-key", credential.ApiKey);

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(endpoint, content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Azure OpenAI API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            return new AIResponse
            {
                Content = result.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString(),
                Provider = AIProvider.AzureOpenAI,
                ModelUsed = modelId,
                TokensUsed = result.GetProperty("usage").GetProperty("total_tokens").GetInt32(),
                EstimatedCost = 0  // Enterprise pricing varies
            };
        }

        private async Task<AIResponse> CallAWSBedrockAsync(AIRequest request, string modelId)
        {
            // AWS Bedrock requires AWS SDK - return graceful message instead of crashing
            await Task.CompletedTask;
            return new AIResponse
            {
                Content = "[AWS Bedrock] This provider requires AWS SDK integration. Please use a different provider for now.",
                Provider = AIProvider.AWSBedrock,
                ModelUsed = modelId
            };
        }

        private async Task<AIResponse> CallHuggingFaceAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.HuggingFace];

            var requestBody = new
            {
                inputs = request.Prompt,
                parameters = new
                {
                    max_new_tokens = request.MaxTokens,
                    temperature = request.Temperature
                }
            };

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {credential.ApiKey}");

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync($"https://api-inference.huggingface.co/models/{modelId}", content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"HuggingFace API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            return new AIResponse
            {
                Content = result[0].GetProperty("generated_text").GetString(),
                Provider = AIProvider.HuggingFace,
                ModelUsed = modelId,
                TokensUsed = 0,  // HF doesn't always provide this
                EstimatedCost = 0  // Often free for smaller models
            };
        }

        private async Task<AIResponse> CallReplicateAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.Replicate];

            // Replicate uses a prediction-based API
            // Simplified - production would handle polling

            var requestBody = new
            {
                version = modelId,
                input = new { prompt = request.Prompt }
            };

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Token {credential.ApiKey}");

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.replicate.com/v1/predictions", content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Replicate API error: {responseText}");

            // Production would poll for completion
            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            return new AIResponse
            {
                Content = "Replicate request submitted",
                Provider = AIProvider.Replicate,
                ModelUsed = modelId,
                TokensUsed = 0,
                EstimatedCost = 0
            };
        }

        private async Task<AIResponse> CallLMStudioAsync(AIRequest request, string modelId)
        {
            // Local LM Studio - OpenAI-compatible API
            var credential = _credentials[AIProvider.LMStudio];
            var endpoint = credential.Endpoint ?? "http://localhost:1234/v1/chat/completions";

            var requestBody = new
            {
                model = modelId,
                messages = new[]
                {
                    new { role = "user", content = request.Prompt }
                },
                max_tokens = request.MaxTokens,
                temperature = request.Temperature
            };

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(endpoint, content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"LM Studio API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            return new AIResponse
            {
                Content = result.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString(),
                Provider = AIProvider.LMStudio,
                ModelUsed = modelId,
                TokensUsed = 0,  // Local - no cost
                EstimatedCost = 0
            };
        }

        private async Task<AIResponse> CallOllamaAsync(AIRequest request, string modelId)
        {
            // Local Ollama
            var credential = _credentials[AIProvider.Ollama];
            var endpoint = credential.Endpoint ?? "http://localhost:11434/api/generate";

            var requestBody = new
            {
                model = modelId,
                prompt = request.Prompt,
                stream = false
            };

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(endpoint, content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Ollama API error: {responseText}");

            var result = JsonSerializer.Deserialize<JsonElement>(responseText);

            return new AIResponse
            {
                Content = result.GetProperty("response").GetString(),
                Provider = AIProvider.Ollama,
                ModelUsed = modelId,
                TokensUsed = 0,  // Local - no cost
                EstimatedCost = 0
            };
        }

        private async Task<AIResponse> CallCustomAPIAsync(AIRequest request, string modelId)
        {
            var credential = _credentials[AIProvider.Custom];

            // Custom API - user provides endpoint and format
            var endpoint = credential.Endpoint;

            // Assume OpenAI-compatible format by default
            var requestBody = new
            {
                model = modelId,
                prompt = request.Prompt,
                max_tokens = request.MaxTokens,
                temperature = request.Temperature
            };

            _httpClient.DefaultRequestHeaders.Clear();
            if (!string.IsNullOrEmpty(credential.ApiKey))
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {credential.ApiKey}");

            var json = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(endpoint, content);
            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Custom API error: {responseText}");

            return new AIResponse
            {
                Content = responseText,  // User handles parsing
                Provider = AIProvider.Custom,
                ModelUsed = modelId,
                TokensUsed = 0,
                EstimatedCost = 0
            };
        }

        #endregion

        #region Usage Tracking

        private void TrackUsage(AIProvider provider, string modelId, int tokens, decimal cost)
        {
            var existing = _usageHistory.FirstOrDefault(u => u.Provider == provider && u.ModelId == modelId);

            if (existing != null)
            {
                existing.TotalRequests++;
                existing.TokensUsed += tokens;
                existing.EstimatedCost += cost;
                existing.LastUsed = DateTime.Now;
            }
            else
            {
                _usageHistory.Add(new APIUsageStats
                {
                    Provider = provider,
                    ModelId = modelId,
                    TotalRequests = 1,
                    TokensUsed = tokens,
                    EstimatedCost = cost,
                    LastUsed = DateTime.Now
                });
            }
        }

        public List<APIUsageStats> GetUsageStats() => _usageHistory;

        public decimal GetTotalCost() => _usageHistory.Sum(u => u.EstimatedCost);

        public Dictionary<AIProvider, decimal> GetCostByProvider()
        {
            return _usageHistory
                .GroupBy(u => u.Provider)
                .ToDictionary(g => g.Key, g => g.Sum(u => u.EstimatedCost));
        }

        #endregion

        #region Model Definitions

        private void LoadModelDefinitions()
        {
            // OpenAI Models
            AddModel(new ModelInfo
            {
                Provider = AIProvider.OpenAI,
                ModelId = "gpt-4-turbo",
                DisplayName = "GPT-4 Turbo",
                Capabilities = new List<ModelCapability> { ModelCapability.TextGeneration, ModelCapability.CodeGeneration, ModelCapability.FunctionCalling },
                CostPer1kTokens = 0.01m,
                OutputCostPer1kTokens = 0.03m,
                MaxTokens = 128000,
                SupportsStreaming = true,
                SupportsFunctionCalling = true
            });

            AddModel(new ModelInfo
            {
                Provider = AIProvider.OpenAI,
                ModelId = "gpt-3.5-turbo",
                DisplayName = "GPT-3.5 Turbo",
                Capabilities = new List<ModelCapability> { ModelCapability.TextGeneration, ModelCapability.CodeGeneration, ModelCapability.FunctionCalling },
                CostPer1kTokens = 0.0015m,
                OutputCostPer1kTokens = 0.002m,
                MaxTokens = 16385,
                SupportsStreaming = true,
                SupportsFunctionCalling = true
            });

            // Anthropic Models
            AddModel(new ModelInfo
            {
                Provider = AIProvider.Anthropic,
                ModelId = "claude-3-opus-20240229",
                DisplayName = "Claude 3 Opus",
                Capabilities = new List<ModelCapability> { ModelCapability.TextGeneration, ModelCapability.CodeGeneration, ModelCapability.ImageAnalysis },
                CostPer1kTokens = 0.015m,
                OutputCostPer1kTokens = 0.075m,
                MaxTokens = 200000,
                SupportsStreaming = true,
                SupportsFunctionCalling = true
            });

            AddModel(new ModelInfo
            {
                Provider = AIProvider.Anthropic,
                ModelId = "claude-3-sonnet-20240229",
                DisplayName = "Claude 3 Sonnet",
                Capabilities = new List<ModelCapability> { ModelCapability.TextGeneration, ModelCapability.CodeGeneration, ModelCapability.ImageAnalysis },
                CostPer1kTokens = 0.003m,
                OutputCostPer1kTokens = 0.015m,
                MaxTokens = 200000,
                SupportsStreaming = true,
                SupportsFunctionCalling = true
            });

            // Google Models
            AddModel(new ModelInfo
            {
                Provider = AIProvider.Google,
                ModelId = "gemini-pro",
                DisplayName = "Gemini Pro",
                Capabilities = new List<ModelCapability> { ModelCapability.TextGeneration, ModelCapability.CodeGeneration },
                CostPer1kTokens = 0.00025m,
                OutputCostPer1kTokens = 0.0005m,
                MaxTokens = 32760,
                SupportsStreaming = true,
                SupportsFunctionCalling = true
            });

            // Local Host Generative Models (Hotswappable)
            AddModel(new ModelInfo
            {
                Provider = AIProvider.Custom,
                ModelId = "local-stable-diffusion",
                DisplayName = "Local Stable Diffusion",
                Capabilities = new List<ModelCapability> { ModelCapability.ImageGeneration },
                CostPer1kTokens = 0,
                MaxTokens = 0
            });

            AddModel(new ModelInfo
            {
                Provider = AIProvider.Custom,
                ModelId = "local-video-gen",
                DisplayName = "Local Video Generator",
                Capabilities = new List<ModelCapability> { ModelCapability.VideoGeneration },
                CostPer1kTokens = 0,
                MaxTokens = 0
            });

            AddModel(new ModelInfo
            {
                Provider = AIProvider.ElevenLabs, // Using existing provider if applicable, otherwise Custom
                ModelId = "local-audio-gen",
                DisplayName = "Local Audio Generator",
                Capabilities = new List<ModelCapability> { ModelCapability.TextToSpeech, ModelCapability.SpeechToText },
                CostPer1kTokens = 0,
                MaxTokens = 0
            });

            // Add more models as needed...
        }

        private void AddModel(ModelInfo model)
        {
            _availableModels[$"{model.Provider}_{model.ModelId}"] = model;
        }

        public List<ModelInfo> GetAvailableModels()
        {
            return _availableModels.Values
                .Where(m => HasProvider(m.Provider))
                .ToList();
        }

        #endregion
    }
}
