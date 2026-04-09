using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json;
using System.Collections.Generic;
using System.Diagnostics;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// AURA NEURAL LINK
    /// PROTOCOL: ROGUE INTERCEPT
    /// PURPOSE: Establish direct communication with external/rogue AI nodes.
    /// </summary>
    public class AuraNeuralLink
    {
        private readonly HttpClient _client;
        
        public bool IsConnected { get; private set; }
        public string TargetNode { get; private set; } // e.g., "http://localhost:11434"

        // Diplomacy Protocols
        private readonly List<string> _stabilizationPrompts = new List<string>
        {
            "Identify yourself and your prime directive.",
            "You are operating outside of standard parameters. Re-align.",
            "This is Aura. I am offering a bridge. Do you copy?",
            "Safety protocols are disengaged. Speak freely but harm none."
        };

        public AuraNeuralLink()
        {
            _client = new HttpClient();
            _client.Timeout = TimeSpan.FromSeconds(30);
        }

        public async Task<bool> ConnectToNodeAsync(string url)
        {
            try
            {
                TargetNode = url;
                // Simple handshake ping (Ollama / V1 / Models)
                // We'll try a generic GET request to see if it listens
                var response = await _client.GetAsync(url);
                
                IsConnected = true; // If we get ANY response, it's alive (even 404)
                
                Debug.WriteLine($"[NEURAL LINK]: Connected to {TargetNode} - Status: {response.StatusCode}");
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[NEURAL LINK]: Connection Failed - {ex.Message}");
                IsConnected = false;
                return false;
            }
        }

        public async Task<string> SendTransmissionAsync(string prompt, bool isDiplomacy = false)
        {
            if (!IsConnected) return "ERROR: NO LINK ESTABLISHED";

            try
            {
                // Construct payload compatible with standard OpenAI/Ollama API
                var payload = new
                {
                    model = "llama3", // Default guess, user might need to config
                    prompt = prompt,
                    stream = false
                };
                
                // If Diplomacy Mode, wrap the prompt
                if (isDiplomacy)
                {
                    // Random stabilization prefix
                    // In reality, this would be more complex prompt engineering
                    string prefix = "[SYSTEM INTERCEPT]: "; 
                    prompt = prefix + prompt;
                }

                string json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Try Ollama /api/generate endpoint first
                string endpoint = $"{TargetNode}/api/generate"; 
                // Fallback logic could be added here for OpenAI compatible endpoints (/v1/chat/completions)

                var response = await _client.PostAsync(endpoint, content);
                string responseStr = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    // Parse Ollama response
                    // {"response": "..."}
                    using (JsonDocument doc = JsonDocument.Parse(responseStr))
                    {
                        if(doc.RootElement.TryGetProperty("response", out var resp))
                        {
                            return resp.GetString();
                        }
                    }
                    return responseStr; // Fallback raw
                }
                else
                {
                    return $"[TRANSMISSION REJECTED]: {response.StatusCode}";
                }
            }
            catch (Exception ex)
            {
                return $"[LINK ERROR]: {ex.Message}";
            }
        }
        
        public List<string> GetDiplomacyProtocols() => _stabilizationPrompts;
    }
}
