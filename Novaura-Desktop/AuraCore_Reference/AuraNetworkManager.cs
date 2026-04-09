using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;

namespace AuraxNova_Command_v5.Core
{
    public class AuraMessage
    {
        public string ID { get; set; } = Guid.NewGuid().ToString();
        public string SenderID { get; set; }
        public string SenderName { get; set; }
        public string Content { get; set; }
        public DateTime Timestamp { get; set; }
        public bool IsGlobal { get; set; } = false; // True = Global Lobby, False = DM
        public string ChannelID { get; set; } = "global";
    }

    /// <summary>
    /// AURA NETWORK MANAGER
    /// PURPOSE: Handles Social & Instant Messaging (AuraNet).
    /// ARCHITECTURE: Offline-First. Syncs when possible.
    /// </summary>
    public class AuraNetworkManager
    {
        private readonly string _localCachePath = "E:/AuraNova_DataLake/AuraNet/cache";
        private readonly AuraAuthenticationHub _auth;
        private readonly HttpClient _client;
        
        // In-memory cache
        public List<AuraMessage> GlobalFeed { get; private set; } = new();
        public bool IsOnline { get; private set; } = false;

        public event Action<AuraMessage> OnMessageReceived;

        public AuraNetworkManager(AuraAuthenticationHub auth)
        {
            _auth = auth;
            _client = new HttpClient();
            Directory.CreateDirectory(_localCachePath);
            LoadCache();
            
            // Check connectivity
            CheckConnection();
        }

        private async void CheckConnection()
        {
            try 
            {
                // Simple connectivity check
                var response = await _client.GetAsync("https://www.google.com");
                IsOnline = response.IsSuccessStatusCode;
                Debug.WriteLine($"[AURANET]: Online Status: {IsOnline}");
                
                if (IsOnline) SyncMessages();
            }
            catch { IsOnline = false; }
        }

        public async Task<bool> SendMessageAsync(string content, bool isGlobal = true)
        {
            var user = _auth.GetCurrentSession();
            string senderName = user?.DisplayName ?? "Anonymous";
            string senderId = user?.UserId ?? "anon";

            var msg = new AuraMessage
            {
                SenderID = senderId,
                SenderName = senderName,
                Content = content,
                Timestamp = DateTime.Now,
                IsGlobal = isGlobal
            };

            // 1. Save Locally (Instant UI update)
            GlobalFeed.Add(msg);
            SaveCache();
            OnMessageReceived?.Invoke(msg);

            // 2. Sync Remote (if online)
            if (IsOnline)
            {
                await UploadMessage(msg);
            }
            return true;
        }

        private async Task UploadMessage(AuraMessage msg)
        {
            try
            {
                // Using Firebase Realtime DB REST API (Simulated URL structure)
                // In production, get URL from AuthHub config
                string dbUrl = _auth.GetServiceConfig("firebase", "database_url");
                if (string.IsNullOrEmpty(dbUrl)) return;

                string endpoint = $"{dbUrl}/messages/{msg.IsGlobal}/{msg.ID}.json";
                string json = JsonSerializer.Serialize(msg);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                await _client.PutAsync(endpoint, content);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AURANET]: Upload Failed - {ex.Message}");
            }
        }

        private async void SyncMessages()
        {
            // Polling simulation for new messages
            // In a real app, use SignalR or Firebase SDK events
        }
        
        private void SaveCache()
        {
            try
            {
                string path = Path.Combine(_localCachePath, "messages_global.json");
                string json = JsonSerializer.Serialize(GlobalFeed);
                File.WriteAllText(path, json);
            }
            catch {}
        }

        private void LoadCache()
        {
            try
            {
                string path = Path.Combine(_localCachePath, "messages_global.json");
                if (File.Exists(path))
                {
                    string json = File.ReadAllText(path);
                    GlobalFeed = JsonSerializer.Deserialize<List<AuraMessage>>(json);
                }
            }
            catch {}
        }
    }
}
