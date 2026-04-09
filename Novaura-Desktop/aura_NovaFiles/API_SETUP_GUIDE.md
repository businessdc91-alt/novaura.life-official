# AuraxNova Command v5 - API Setup Guide

## 🔑 Quick Start

The system is now configured with centralized API key management. All your existing keys have been automatically loaded from `secrets.txt` and `google secret.txt`.

### Current Status

✅ **Firebase/Google Cloud** - Configured and ready
- Project: `auraxnovaos`
- All Google Cloud services available (Vertex AI, Claude, Imagen, Veo, Gemini)

✅ **Configuration Files Created**
- `.env` - Main configuration file
- `config.json` - JSON configuration
- `Aura_Config.py` - Python configuration loader

---

## 📁 Configuration Files

### 1. `.env` File (Recommended)
The `.env` file contains all your API keys and is the primary configuration source.

**Location:** `aura_NovaFiles/.env`

This file is already populated with your existing keys:
- Firebase/Google Cloud credentials
- LM Studio configuration
- Catalyst settings

### 2. `config.json` File
JSON-based configuration that provides structured settings.

**Location:** `aura_NovaFiles/config.json`

### 3. `Aura_Config.py` Module
Python module that loads and manages all configuration.

**Usage in your code:**
```python
from Aura_Config import get_config, get_google_api_key, get_firebase_config

# Get the full config object
config = get_config()

# Print configuration status
config.print_status()

# Get specific keys
google_key = get_google_api_key()
firebase = get_firebase_config()
claude_key = config.get_claude_api_key()
```

---

## 🔐 Available API Services

### 1. **Google Cloud / Firebase** ✅ Configured
Your current configuration provides access to:
- **Vertex AI** - Access Claude via Google Cloud
- **Imagen 4.0** - Advanced image generation
- **Veo 2.0** - Video generation
- **Gemini 1.5 Pro/Flash** - Google's AI models
- **Firebase Authentication** - User management
- **Firebase Storage** - Cloud storage
- **Firebase Analytics** - Usage tracking

**How to get:** Already configured from your existing `secrets.txt`

### 2. **LM Studio** ✅ Enabled
Local AI server for running models on your machine.

**Configuration:**
- URL: `http://localhost:1234/v1`
- Status: Enabled
- Fallback: Enabled (will retry if server is down)

**How to use:** Just start LM Studio and the system will auto-detect it.

### 3. **Claude API (Direct)** ⚠️ Optional
Direct access to Anthropic's Claude API (alternative to Vertex AI).

**How to get:**
1. Visit: https://console.anthropic.com
2. Create an account
3. Generate an API key
4. Add to `.env`: `CLAUDE_API_KEY=your_key_here`

**Note:** You already have Claude access via Vertex AI (Google Cloud).

### 4. **OpenAI API** ⚠️ Optional
Access to GPT-4 and other OpenAI models.

**How to get:**
1. Visit: https://platform.openai.com
2. Create an account
3. Generate an API key
4. Add to `.env`: `OPENAI_API_KEY=your_key_here`

---

## 🚀 Adding New API Keys

### Method 1: Edit `.env` File
```bash
# Open .env and add your key
CLAUDE_API_KEY=sk-ant-api03-xxxxx
OPENAI_API_KEY=sk-proj-xxxxx
```

### Method 2: Edit `config.json`
```json
{
  "ai_services": {
    "claude": {
      "enabled": true,
      "api_key": "sk-ant-api03-xxxxx"
    }
  }
}
```

### Method 3: Environment Variables
Set system environment variables that will override file settings:
```bash
# Windows (Command Prompt)
set CLAUDE_API_KEY=sk-ant-api03-xxxxx

# Windows (PowerShell)
$env:CLAUDE_API_KEY="sk-ant-api03-xxxxx"

# Linux/Mac
export CLAUDE_API_KEY=sk-ant-api03-xxxxx
```

---

## 🧪 Testing Your Configuration

Run the configuration test:
```bash
python Aura_Config.py
```

This will display:
- All configured services
- API key status (configured/not configured)
- Available AI models
- System settings

---

## 🔒 Security Best Practices

### DO:
✅ Keep `.env` file in `.gitignore` (already done)
✅ Use `.env.example` as a template (already created)
✅ Rotate API keys regularly
✅ Use service accounts for production
✅ Keep backups of your configuration (encrypted)

### DON'T:
❌ Commit `.env` to version control
❌ Share API keys in screenshots or logs
❌ Use production keys in development
❌ Store keys in code files

---

## 📊 Service Priority

The configuration loader checks sources in this order:

1. **Environment Variables** (highest priority)
2. **`.env` File**
3. **`config.json`**
4. **Legacy Files** (`secrets.txt`, `google secret.txt`)

This means you can override any setting by setting an environment variable.

---

## 🎯 Integration with Existing Code

### Update Your Modules

To use the new configuration system in your Aura modules:

```python
# Old way (manual)
GOOGLE_API_KEY = "AIzaSy..."

# New way (centralized)
from Aura_Config import get_config

config = get_config()
google_key = config.get_google_api_key()
firebase = config.get_firebase_config()
```

### Example: Update 05_Aura_Nova.py
```python
from Aura_Config import get_config

config = get_config()

# Use LM Studio config from centralized source
lm_studio_url = config.get_lm_studio_url()
lm_studio_enabled = config.get_lm_studio_enabled()
```

---

## 🆘 Troubleshooting

### "No configuration found"
**Solution:** Make sure `.env` or `config.json` exists in the project root.

### "API key not working"
**Solutions:**
1. Check the key hasn't expired
2. Verify the key is correct (no extra spaces)
3. Check service quotas/billing
4. Test with the service's API documentation

### "LM Studio not connecting"
**Solutions:**
1. Start LM Studio application
2. Load a model in LM Studio
3. Verify LM Studio is running on port 1234
4. Check firewall settings

### "Google Cloud services failing"
**Solutions:**
1. Verify Firebase project is active
2. Enable required APIs in Google Cloud Console:
   - Vertex AI API
   - Imagen API
   - Generative AI API
3. Check billing is enabled
4. Verify API key permissions

---

## 📞 Getting API Keys

### Required (Already Configured)
- ✅ **Firebase/Google Cloud** - You have this

### Optional
- 🔵 **Claude API** - https://console.anthropic.com
- 🟢 **OpenAI API** - https://platform.openai.com
- 🟣 **Stripe** (for payments) - https://stripe.com
- 🔴 **Discord Bot** (for community) - https://discord.com/developers

---

## 🎉 You're Ready!

Your system is configured with:
- ✅ Firebase & Google Cloud (Vertex AI, Imagen, Veo, Gemini)
- ✅ LM Studio (local AI)
- ✅ Centralized configuration management
- ✅ Secure credential storage

**Next Steps:**
1. Test the configuration: `python Aura_Config.py`
2. Add optional API keys if needed
3. Start using Aura with `python Aura_Ignition.py`

---

## 📚 Additional Resources

- **Firebase Console:** https://console.firebase.google.com
- **Google Cloud Console:** https://console.cloud.google.com
- **Vertex AI Documentation:** https://cloud.google.com/vertex-ai/docs
- **Anthropic API Docs:** https://docs.anthropic.com
- **OpenAI API Docs:** https://platform.openai.com/docs

---

**Built with ❤️ by Dillan Copeland**
**AuraxNova Command v5 - Phoenix Protocol Active**
