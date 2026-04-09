/*
 * AURA AUTHENTICATION HUB - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Central authentication and API key management
 *
 * CAPABILITIES:
 * - Google OAuth authentication
 * - Firebase authentication
 * - API key management (OpenAI, Anthropic, Google Cloud, etc.)
 * - Session management
 * - Multi-user support
 * - Secure credential storage
 *
 * INTEGRATES WITH:
 * - AuraCollaborationHub (for group auth)
 * - AuraCatalystAuth (for Catalyst recognition)
 * - AuraCloudStorage (for Firebase)
 * - All AI services (API keys)
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Net.Http;

namespace AuraxNova_Command_v5.Core
{
    public enum AuthProvider
    {
        Google,
        Firebase,
        Microsoft,
        GitHub,
        Local
    }

    public class UserSession
    {
        public string SessionId { get; set; }
        public string UserId { get; set; }
        public string Email { get; set; }
        public string DisplayName { get; set; }
        public string AvatarUrl { get; set; }
        public AuthProvider Provider { get; set; }
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
        public DateTime TokenExpiry { get; set; }
        public DateTime SessionStart { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class APICredentials
    {
        public Dictionary<string, string> ApiKeys { get; set; } = new();
        public Dictionary<string, Dictionary<string, string>> ServiceConfig { get; set; } = new();
    }

    public class AuraAuthenticationHub
    {
        private readonly string _credentialsPath = "E:/AuraNova_DataLake/Auth/credentials.json";
        private readonly string _envPath = "E:/AuraNova_DataLake/Auth/.env";
        private readonly string _sessionsPath = "E:/AuraNova_DataLake/Auth/sessions";

        private UserSession _currentSession;
        private APICredentials _credentials;

        // Google OAuth
        private const string GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
        private const string GOOGLE_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET";
        private const string GOOGLE_REDIRECT_URI = "http://localhost:8080/auth/callback";

        // Firebase
        private string FIREBASE_API_KEY = ""; // Loaded from .env
        private const string FIREBASE_PROJECT_ID = "auraxnovaos"; 

        public AuraAuthenticationHub()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_credentialsPath));
            Directory.CreateDirectory(_sessionsPath);

            LoadCredentials(); // Load saved keys
            LoadEnvironmentVariables(); // Load from .env into credentials
            
            // Sync local var for convenience
            FIREBASE_API_KEY = GetApiKey("google") ?? GetApiKey("firebase") ?? "";
            
            Debug.WriteLine($"[AUTH]: Hub Initialized. API Key Present: {!string.IsNullOrEmpty(FIREBASE_API_KEY)}");
        }

        #region Google OAuth

        public async Task<UserSession> AuthenticateWithGoogleAsync()
        {
            /*
             * Google OAuth 2.0 flow
             *
             * 1. Generate auth URL
             * 2. Open browser for user consent
             * 3. Receive callback with auth code
             * 4. Exchange code for tokens
             * 5. Get user info
             * 6. Create session
             */

            try
            {
                Debug.WriteLine("[AUTH]: Starting Google OAuth flow...");

                // Generate state for CSRF protection
                var state = GenerateSecureToken();

                // Build auth URL
                var authUrl = BuildGoogleAuthUrl(state);

                Debug.WriteLine($"[AUTH]: Opening browser for Google login...");
                Debug.WriteLine($"[AUTH]: URL: {authUrl}");

                // Start Local Loopback Listener
                using var listener = new System.Net.HttpListener();
                listener.Prefixes.Add("http://localhost:8080/auth/");
                listener.Start();

                Debug.WriteLine($"[AUTH]: Listening on http://localhost:8080/auth/ ...");

                // Open Browser
                Process.Start(new ProcessStartInfo
                {
                    FileName = authUrl,
                    UseShellExecute = true
                });

                // Wait for callback
                var context = await listener.GetContextAsync();
                var request = context.Request;
                var response = context.Response;

                // Extract code
                string code = request.QueryString["code"];
                string error = request.QueryString["error"];

                // Send response to browser
                string responseString = "<html><body><h2>AuraxNova Authentication Successful</h2><p>You may close this window and return to the application.</p><script>window.close();</script></body></html>";
                byte[] buffer = System.Text.Encoding.UTF8.GetBytes(responseString);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
                response.OutputStream.Close();
                listener.Stop();

                if (string.IsNullOrEmpty(code))
                {
                    throw new Exception($"OAuth Error: {error}");
                }

                Debug.WriteLine($"[AUTH]: Auth Code received: {code.Substring(0, 10)}...");

                // Exchange Code for Token
                var tokens = await ExchangeGoogleAuthCodeAsync(code);
                
                // Get User Info
                var userInfo = await GetGoogleUserInfoAsync(tokens["access_token"]);

                // Create Session
                 _currentSession = new UserSession
                {
                    SessionId = Guid.NewGuid().ToString(),
                    UserId = userInfo["id"],
                    Email = userInfo["email"],
                    DisplayName = userInfo.ContainsKey("name") ? userInfo["name"] : userInfo["email"],
                    Provider = AuthProvider.Google,
                    AccessToken = tokens["access_token"],
                    RefreshToken = tokens.ContainsKey("refresh_token") ? tokens["refresh_token"] : null,
                    TokenExpiry = DateTime.Now.AddSeconds(Convert.ToInt32(tokens["expires_in"])),
                    SessionStart = DateTime.Now
                };

                SaveSession(_currentSession);

                Debug.WriteLine($"[AUTH]: ✓ Google authentication successful");
                Debug.WriteLine($"[AUTH]: User: {_currentSession.DisplayName} ({_currentSession.Email})");

                return _currentSession;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH]: ✗ Google authentication failed: {ex.Message}");
                return null;
            }
        }

        private string BuildGoogleAuthUrl(string state)
        {
            var scopes = new[]
            {
                "openid",
                "email",
                "profile",
                "https://www.googleapis.com/auth/drive.file",  // Google Drive access
                "https://www.googleapis.com/auth/userinfo.profile"
            };

            var scopeString = string.Join(" ", scopes);

            return $"https://accounts.google.com/o/oauth2/v2/auth?" +
                   $"client_id={GOOGLE_CLIENT_ID}&" +
                   $"redirect_uri={Uri.EscapeDataString(GOOGLE_REDIRECT_URI)}&" +
                   $"response_type=code&" +
                   $"scope={Uri.EscapeDataString(scopeString)}&" +
                   $"state={state}&" +
                   $"access_type=offline&" +
                   $"prompt=consent";
        }

        private async Task<Dictionary<string, string>> ExchangeGoogleAuthCodeAsync(string authCode)
        {
            using var client = new HttpClient();

            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "code", authCode },
                { "client_id", GOOGLE_CLIENT_ID },
                { "client_secret", GOOGLE_CLIENT_SECRET },
                { "redirect_uri", GOOGLE_REDIRECT_URI },
                { "grant_type", "authorization_code" }
            });

            var response = await client.PostAsync("https://oauth2.googleapis.com/token", content);
            var json = await response.Content.ReadAsStringAsync();

            return JsonSerializer.Deserialize<Dictionary<string, string>>(json);
        }

        private async Task<Dictionary<string, string>> GetGoogleUserInfoAsync(string accessToken)
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

            var response = await client.GetAsync("https://www.googleapis.com/oauth2/v2/userinfo");
            var json = await response.Content.ReadAsStringAsync();

            return JsonSerializer.Deserialize<Dictionary<string, string>>(json);
        }

        public async Task<bool> RefreshGoogleTokenAsync()
        {
            if (_currentSession?.RefreshToken == null)
                return false;

            try
            {
                using var client = new HttpClient();

                var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    { "client_id", GOOGLE_CLIENT_ID },
                    { "client_secret", GOOGLE_CLIENT_SECRET },
                    { "refresh_token", _currentSession.RefreshToken },
                    { "grant_type", "refresh_token" }
                });

                var response = await client.PostAsync("https://oauth2.googleapis.com/token", content);
                var json = await response.Content.ReadAsStringAsync();
                var tokens = JsonSerializer.Deserialize<Dictionary<string, string>>(json);

                _currentSession.AccessToken = tokens["access_token"];
                _currentSession.TokenExpiry = DateTime.Now.AddSeconds(Convert.ToInt32(tokens["expires_in"]));

                SaveSession(_currentSession);

                Debug.WriteLine("[AUTH]: Token refreshed successfully");
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH]: Token refresh failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region Firebase Authentication

        public async Task<UserSession> AuthenticateWithFirebaseAsync(string email, string password)
        {
            /*
             * Firebase email/password authentication
             */

            try
            {
                using var client = new HttpClient();

                var payload = new
                {
                    email = email,
                    password = password,
                    returnSecureToken = true
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json"
                );

                var response = await client.PostAsync(
                    $"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
                    content
                );

                var json = await response.Content.ReadAsStringAsync();
                
                if (!response.IsSuccessStatusCode)
                {
                     throw new Exception($"Firebase Auth Failed ({response.StatusCode}): {json}");
                }

                var result = JsonSerializer.Deserialize<Dictionary<string, object>>(json);

                _currentSession = new UserSession
                {
                    SessionId = Guid.NewGuid().ToString(),
                    UserId = result["localId"].ToString(),
                    Email = result["email"].ToString(),
                    DisplayName = result.ContainsKey("displayName") ? result["displayName"].ToString() : email,
                    Provider = AuthProvider.Firebase,
                    AccessToken = result["idToken"].ToString(),
                    RefreshToken = result["refreshToken"].ToString(),
                    TokenExpiry = DateTime.Now.AddSeconds(Convert.ToInt32(result["expiresIn"])),
                    SessionStart = DateTime.Now
                };

                SaveSession(_currentSession);

                Debug.WriteLine($"[AUTH]: ✓ Firebase authentication successful");
                Debug.WriteLine($"[AUTH]: User: {_currentSession.Email}");

                return _currentSession;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH]: ✗ Firebase authentication failed: {ex.Message}");
                return null;
            }
        }

        public async Task<bool> CreateFirebaseAccountAsync(string email, string password, string displayName)
        {
            try
            {
                using var client = new HttpClient();

                var payload = new
                {
                    email = email,
                    password = password,
                    returnSecureToken = true
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json"
                );

                var response = await client.PostAsync(
                    $"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}",
                    content
                );

                if (response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[AUTH]: ✓ Firebase account created: {email}");
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH]: ✗ Firebase account creation failed: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region API Key Management

        public void SetApiKey(string service, string apiKey)
        {
            /*
             * Store API key for a service
             *
             * Services:
             * - openai (ChatGPT/GPT-4)
             * - anthropic (Claude)
             * - google (Gemini, Cloud APIs)
             * - firebase
             * - github
             * - etc.
             */

            if (_credentials.ApiKeys.ContainsKey(service))
                Debug.WriteLine($"[AUTH]: Updating API key for {service}");
            else
                Debug.WriteLine($"[AUTH]: Adding API key for {service}");

            _credentials.ApiKeys[service] = apiKey;
            SaveCredentials();
        }

        public string GetApiKey(string service)
        {
            if (_credentials.ApiKeys.ContainsKey(service))
                return _credentials.ApiKeys[service];

            Debug.WriteLine($"[AUTH]: ✗ No API key found for {service}");
            return null;
        }

        public void SetServiceConfig(string service, string configKey, string configValue)
        {
            /*
             * Store service-specific configuration
             *
             * Examples:
             * - google.project_id
             * - firebase.database_url
             * - openai.organization_id
             */

            if (!_credentials.ServiceConfig.ContainsKey(service))
                _credentials.ServiceConfig[service] = new Dictionary<string, string>();

            _credentials.ServiceConfig[service][configKey] = configValue;
            SaveCredentials();

            Debug.WriteLine($"[AUTH]: Set {service}.{configKey}");
        }

        public string GetServiceConfig(string service, string configKey)
        {
            if (_credentials.ServiceConfig.ContainsKey(service) &&
                _credentials.ServiceConfig[service].ContainsKey(configKey))
            {
                return _credentials.ServiceConfig[service][configKey];
            }

            return null;
        }

        public void LoadFromEnvironmentFile(string envFilePath = null)
        {
            /*
             * Load API keys from .env file
             *
             * Format:
             * OPENAI_API_KEY=sk-...
             * ANTHROPIC_API_KEY=sk-ant-...
             * GOOGLE_CLOUD_PROJECT=my-project
             */

            envFilePath ??= _envPath;

            if (!File.Exists(envFilePath))
            {
                Debug.WriteLine($"[AUTH]: No .env file found at {envFilePath}");
                return;
            }

            var lines = File.ReadAllLines(envFilePath);
            int keysLoaded = 0;

            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
                    continue;

                var parts = line.Split('=', 2);
                if (parts.Length != 2)
                    continue;

                var key = parts[0].Trim();
                var value = parts[1].Trim();

                // Map env var names to service names
                var service = key.ToLower() switch
                {
                    string k when k.Contains("openai") => "openai",
                    string k when k.Contains("anthropic") => "anthropic",
                    string k when k.Contains("google") => "google",
                    string k when k.Contains("firebase") => "firebase",
                    string k when k.Contains("github") => "github",
                    _ => key.ToLower()
                };

                if (key.EndsWith("_API_KEY") || key.EndsWith("_KEY"))
                {
                    SetApiKey(service, value);
                    keysLoaded++;
                }
                else
                {
                    // Configuration value
                    var configKey = key.Replace($"{service.ToUpper()}_", "").ToLower();
                    SetServiceConfig(service, configKey, value);
                }
            }

            Debug.WriteLine($"[AUTH]: Loaded {keysLoaded} API keys from .env");
        }

        public void CreateEnvironmentTemplate()
        {
            /*
             * Create a template .env file for user to fill in
             */

            var template = @"# AuraxNova API Keys and Configuration
# Fill in your API keys below

# OpenAI (ChatGPT, GPT-4)
OPENAI_API_KEY=sk-your-key-here
OPENAI_ORGANIZATION_ID=org-your-org-here

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Google Cloud & Gemini
GOOGLE_API_KEY=your-google-api-key
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Firebase
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# GitHub (for Copilot, API access)
GITHUB_TOKEN=ghp_your-token-here

# Other Services
REPLICATE_API_KEY=your-replicate-key
HUGGINGFACE_TOKEN=hf_your-token
";

            File.WriteAllText(_envPath, template);
            Debug.WriteLine($"[AUTH]: Created .env template at {_envPath}");
            Debug.WriteLine($"[AUTH]: Please fill in your API keys");
        }

        #endregion

        #region Session Management

        public UserSession GetCurrentSession() => _currentSession;

        public bool IsAuthenticated() => _currentSession != null;

        public bool IsTokenValid()
        {
            if (_currentSession == null)
                return false;

            return DateTime.Now < _currentSession.TokenExpiry;
        }

        public async Task<bool> EnsureValidTokenAsync()
        {
            if (!IsAuthenticated())
                return false;

            if (IsTokenValid())
                return true;

            // Try to refresh token
            return await RefreshGoogleTokenAsync();
        }

        public void Logout()
        {
            if (_currentSession != null)
            {
                Debug.WriteLine($"[AUTH]: Logging out {_currentSession.DisplayName}");
                _currentSession = null;
            }
        }

        #endregion

        #region Persistence

        private void LoadCredentials()
        {
            if (File.Exists(_credentialsPath))
            {
                try
                {
                    var json = File.ReadAllText(_credentialsPath);
                    var decrypted = DecryptString(json);
                    _credentials = JsonSerializer.Deserialize<APICredentials>(decrypted);
                    Debug.WriteLine($"[AUTH]: Loaded {_credentials.ApiKeys.Count} API keys");
                }
                catch
                {
                    Debug.WriteLine("[AUTH]: Could not load credentials, creating new");
                    _credentials = new APICredentials();
                }
            }
            else
            {
                _credentials = new APICredentials();
            }
        }

        private void SaveCredentials()
        {
            var json = JsonSerializer.Serialize(_credentials, new JsonSerializerOptions { WriteIndented = true });
            var encrypted = EncryptString(json);
            File.WriteAllText(_credentialsPath, encrypted);
        }

        private void LoadEnvironmentVariables()
        {
            if (File.Exists(_envPath))
            {
                LoadFromEnvironmentFile(_envPath);
            }
            else
            {
                CreateEnvironmentTemplate();
            }
        }

        private void SaveSession(UserSession session)
        {
            var sessionPath = Path.Combine(_sessionsPath, $"{session.SessionId}.json");
            var json = JsonSerializer.Serialize(session, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(sessionPath, json);
        }

        #endregion

        #region Security

        private string EncryptString(string plainText)
        {
            // Simple encryption (use Windows DPAPI in production)
            var bytes = Encoding.UTF8.GetBytes(plainText);
            var encrypted = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(encrypted);
        }

        private string DecryptString(string encryptedText)
        {
            var bytes = Convert.FromBase64String(encryptedText);
            var decrypted = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }

        private string GenerateSecureToken()
        {
            var bytes = new byte[32];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        #endregion

        #region Public API

        public Dictionary<string, object> GetAuthStatus()
        {
            return new Dictionary<string, object>
            {
                { "authenticated", IsAuthenticated() },
                { "user", _currentSession?.DisplayName ?? "Not logged in" },
                { "email", _currentSession?.Email ?? "" },
                { "provider", _currentSession?.Provider.ToString() ?? "" },
                { "token_valid", IsTokenValid() },
                { "api_keys_configured", _credentials.ApiKeys.Count },
                { "services", _credentials.ApiKeys.Keys.ToList() }
            };
        }

        public List<string> GetConfiguredServices() => _credentials.ApiKeys.Keys.ToList();

        public bool HasApiKey(string service) => _credentials.ApiKeys.ContainsKey(service);

        #endregion
    }

    #region Usage Examples

    public static class AuthHubExamples
    {
        public static async Task QuickStartExample()
        {
            var auth = new AuraAuthenticationHub();

            // Load API keys from .env
            auth.LoadFromEnvironmentFile();

            // Or set manually
            auth.SetApiKey("openai", "sk-your-openai-key");
            auth.SetApiKey("anthropic", "sk-ant-your-claude-key");
            auth.SetApiKey("google", "your-google-api-key");

            // Set service config
            auth.SetServiceConfig("google", "project_id", "your-project-id");
            auth.SetServiceConfig("firebase", "database_url", "https://your-db.firebaseio.com");

            // Authenticate with Google
            var session = await auth.AuthenticateWithGoogleAsync();

            if (session != null)
            {
                Debug.WriteLine($"Logged in as: {session.DisplayName}");

                // Use API keys
                var openaiKey = auth.GetApiKey("openai");
                // Now you can use this key with OpenAI SDK

                // Check token validity
                if (await auth.EnsureValidTokenAsync())
                {
                    Debug.WriteLine("Token is valid");
                }
            }

            // Get auth status
            var status = auth.GetAuthStatus();
            foreach (var kvp in status)
            {
                Debug.WriteLine($"{kvp.Key}: {kvp.Value}");
            }
        }
    }

    #endregion
}
