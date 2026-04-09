using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.IO;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Enhanced Gemini Relay supporting:
    /// - Direct conversation with Gemini
    /// - Aura-Gemini collaboration mode
    /// - Vertex AI multimodal (images)
    /// </summary>
    public class GeminiRelay
    {
        private string _geminiApiKey;
        private string _vertexApiKey;
        private readonly HttpClient _client;
        
        private const string GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";
        private const string VERTEX_IMAGEN_URL = "https://us-central1-aiplatform.googleapis.com/v1/projects/{0}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict";

        public bool IsActive { get; set; } = false;
        public bool VertexEnabled { get; set; } = false;

        // Events for UI updates
        public event Action<string> OnGeminiResponse;
        public event Action<string> OnVertexImageGenerated;

        public GeminiRelay(string geminiApiKey = null, string vertexApiKey = null)
        {
            _geminiApiKey = geminiApiKey;
            _vertexApiKey = vertexApiKey;
            _client = new HttpClient();
            _client.Timeout = TimeSpan.FromSeconds(60);
        }

        public void SetApiKey(string key)
        {
            _geminiApiKey = key;
            IsActive = !string.IsNullOrEmpty(key);
        }

        public void SetVertexApiKey(string key)
        {
            _vertexApiKey = key;
            VertexEnabled = !string.IsNullOrEmpty(key);
        }

        /// <summary>
        /// Direct conversation with Gemini (standalone, not through Aura)
        /// </summary>
        public async Task<string> AskGeminiDirectAsync(string userMessage)
        {
            if (string.IsNullOrEmpty(_geminiApiKey)) 
                return "[Gemini] API key not configured. Set it in Settings or .env file.";

            try
            {
                var requestBody = new
                {
                    contents = new[]
                    {
                        new { 
                            role = "user",
                            parts = new[] { new { text = userMessage } } 
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.7,
                        maxOutputTokens = 2048
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var url = $"{GEMINI_BASE_URL}?key={_geminiApiKey}";
                
                var response = await _client.PostAsync(url, content);
                
                if (response.IsSuccessStatusCode)
                {
                    var responseString = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseString);
                    var text = doc.RootElement
                        .GetProperty("candidates")[0]
                        .GetProperty("content")
                        .GetProperty("parts")[0]
                        .GetProperty("text")
                        .GetString();
                    
                    OnGeminiResponse?.Invoke(text);
                    return text;
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return $"[Gemini Error {response.StatusCode}]: {error}";
                }
            }
            catch (Exception ex)
            {
                return $"[Gemini Connection Failed]: {ex.Message}";
            }
        }

        /// <summary>
        /// Collaborative mode: Gemini comments on Aura's response
        /// </summary>
        public async Task<string> AskGeminiAsync(string userMessage, string auraResponse)
        {
            if (!IsActive || string.IsNullOrEmpty(_geminiApiKey)) return null;

            try
            {
                var prompt = $@"You are Gemini, a cloud AI collaborating with a local AI named Aura.

User asked: ""{userMessage}""

Aura's response: ""{auraResponse}""

Your task: Provide additional cloud-based insights, real-time data, or fact-checking that the local AI might have missed. 
- If Aura was accurate and complete, be brief and supportive.
- Add any current information from your knowledge.
- Keep response under 150 words unless elaboration is needed.
- Start with '☁️ '";

                var requestBody = new
                {
                    contents = new[]
                    {
                        new { parts = new[] { new { text = prompt } } }
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var url = $"{GEMINI_BASE_URL}?key={_geminiApiKey}";
                
                var response = await _client.PostAsync(url, content);
                
                if (response.IsSuccessStatusCode)
                {
                    var responseString = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseString);
                    var text = doc.RootElement
                        .GetProperty("candidates")[0]
                        .GetProperty("content")
                        .GetProperty("parts")[0]
                        .GetProperty("text")
                        .GetString();
                    return text;
                }
                else
                {
                    return $"☁️ [Gemini Error]: {response.StatusCode}";
                }
            }
            catch (Exception ex)
            {
                return $"☁️ [Gemini Connection Failed]: {ex.Message}";
            }
        }

        /// <summary>
        /// Let Aura and Gemini have a back-and-forth conversation
        /// </summary>
        public async Task<string> FacilitateDialogueAsync(string topic, Func<string, Task<string>> askAura)
        {
            var dialogue = new StringBuilder();
            dialogue.AppendLine($"=== AI Dialogue on: {topic} ===\n");

            // Round 1: Ask Gemini to start
            var geminiOpening = await AskGeminiDirectAsync($"Start a brief discussion about: {topic}. Keep it to 2-3 sentences.");
            dialogue.AppendLine($"☁️ Gemini: {geminiOpening}\n");

            // Round 2: Have Aura respond
            if (askAura != null)
            {
                var auraResponse = await askAura($"Gemini said: \"{geminiOpening}\". What's your perspective on {topic}?");
                dialogue.AppendLine($"🤖 Aura: {auraResponse}\n");

                // Round 3: Gemini replies
                var geminiReply = await AskGeminiDirectAsync($"Aura responded to your point about {topic} with: \"{auraResponse}\". Give a brief final thought.");
                dialogue.AppendLine($"☁️ Gemini: {geminiReply}");
            }

            return dialogue.ToString();
        }

        /// <summary>
        /// Generate image using Vertex AI Imagen
        /// </summary>
        public async Task<string> GenerateImageAsync(string prompt, string projectId = "auraxnovaos")
        {
            if (string.IsNullOrEmpty(_vertexApiKey))
                return "[Vertex] API key not configured.";

            try
            {
                var url = string.Format(VERTEX_IMAGEN_URL, projectId);
                
                var requestBody = new
                {
                    instances = new[]
                    {
                        new { prompt = prompt }
                    },
                    parameters = new
                    {
                        sampleCount = 1,
                        aspectRatio = "1:1",
                        safetyFilterLevel = "block_some"
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {_vertexApiKey}");
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _client.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    var responseString = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseString);
                    
                    // Extract base64 image
                    var base64Image = doc.RootElement
                        .GetProperty("predictions")[0]
                        .GetProperty("bytesBase64Encoded")
                        .GetString();

                    // Save to file
                    var fileName = $"generated_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                    var filePath = Path.Combine(@"D:\AuraNova_DataLake\GeneratedImages", fileName);
                    Directory.CreateDirectory(Path.GetDirectoryName(filePath));
                    
                    var imageBytes = Convert.FromBase64String(base64Image);
                    await File.WriteAllBytesAsync(filePath, imageBytes);

                    OnVertexImageGenerated?.Invoke(filePath);
                    return filePath;
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return $"[Vertex Error {response.StatusCode}]: {error}";
                }
            }
            catch (Exception ex)
            {
                return $"[Vertex Error]: {ex.Message}";
            }
        }

        /// <summary>
        /// Check if services are properly configured
        /// </summary>
        public (bool gemini, bool vertex, string status) GetStatus()
        {
            var geminiOk = !string.IsNullOrEmpty(_geminiApiKey);
            var vertexOk = !string.IsNullOrEmpty(_vertexApiKey);
            
            var status = "";
            if (geminiOk) status += "Gemini ✓ ";
            else status += "Gemini ✗ ";
            if (vertexOk) status += "Vertex ✓";
            else status += "Vertex ✗";

            return (geminiOk, vertexOk, status);
        }
    }
}
