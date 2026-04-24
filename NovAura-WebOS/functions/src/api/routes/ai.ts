import { Router } from 'express';
import * as admin from 'firebase-admin';
import { secretService } from '../../services/secretService';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const router = Router();

const PROVIDERS: Record<string, any> = {
  // AIML API — unified gateway (primary, works)
  aiml: {
    url: () => 'https://api.aimlapi.com/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, model?: string) => ({
      model: model || 'google/gemma-3-27b-it',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  gemini: {
    url: () => 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'X-goog-api-key': key
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens }
    }),
    parseResponse: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  },
  claude: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'claude-4-sonnet',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: temp
    }),
    parseResponse: (data: any) => data.content?.[0]?.text || ''
  },
  // Alias for anthropic
  anthropic: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'claude-4-sonnet',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: temp
    }),
    parseResponse: (data: any) => data.content?.[0]?.text || ''
  },
  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'gpt-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  // Azure AI Foundry (Primary)
  azure: {
    url: () => process.env.AZURE_OPENAI_ENDPOINT || 'https://novauralife-resource.openai.azure.com/openai/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'api-key': key
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  // Azure OpenAI alias
  azure_openai: {
    url: () => process.env.AZURE_OPENAI_ENDPOINT || 'https://novauralife-resource.openai.azure.com/openai/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'api-key': key
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  kimi: {
    url: () => 'https://api.moonshot.cn/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  alibaba: {
    // Native Alibaba format (not OpenAI-compatible)
    url: () => 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'qwen-4-max',
      input: {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        max_tokens: maxTokens,
        temperature: temp,
        result_format: 'message'
      }
    }),
    parseResponse: (data: any) => {
      // Alibaba native format: data.output.choices[0].message.content
      return data.output?.choices?.[0]?.message?.content 
        || data.output?.text 
        || '';
    }
  },
  // Additional model providers
  novita: {
    url: () => 'https://api.novita.ai/v3/openai/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'Qwen/Qwen3-Coder-Next',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  scaleway: {
    url: () => 'https://api.scaleway.ai/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'google/gemma-3-27b-it',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  hyperbolic: {
    url: () => 'https://api.hyperbolic.xyz/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'Qwen/Qwen3-Next-80B-A3B-Thinking',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  lmstudio: {
    // LM Studio local server (OpenAI-compatible)
    url: () => process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'local-model',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  fireworks: {
    url: () => 'https://api.fireworks.ai/inference/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number) => ({
      model: 'zai-org/GLM-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  },
  nova: {
    // Amazon Nova OpenAI-compatible API
    url: () => 'https://api.nova.amazon.com/v1/chat/completions',
    headers: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    formatBody: (prompt: string, maxTokens: number, temp: number, model?: string) => ({
      model: model || 'amazon.nova-pro-v1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temp
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || ''
  }
};

router.post('/chat', async (req, res) => {
  try {
    const { provider, prompt, maxTokens = 1024, temperature = 0.7 } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt required' });
      return;
    }

    const selectedProvider = provider || await detectProvider();
    const config = PROVIDERS[selectedProvider];
    
    if (!config) {
      res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });
      return;
    }

    const apiKey = await getApiKey(selectedProvider);
    if (!apiKey) {
      res.status(503).json({ error: `${selectedProvider} not configured` });
      return;
    }

    let response = await fetch(config.url(apiKey), {
      method: 'POST',
      headers: typeof config.headers === 'function' ? config.headers(apiKey) : config.headers,
      body: JSON.stringify(config.formatBody(prompt, maxTokens, temperature, req.body.model))
    });

    // BACKUP LOGIC: If Gemini fails (Quota or Error), try the backup key
    if (!response.ok && selectedProvider === 'gemini') {
      const backupKey = await getApiKey('gemini_backup');
      if (backupKey && backupKey !== apiKey) {
        console.warn('Gemini primary key failed/quota-reached. Retrying with backup key...');
        response = await fetch(config.url(backupKey), {
          method: 'POST',
          headers: typeof config.headers === 'function' ? config.headers(backupKey) : config.headers,
          body: JSON.stringify(config.formatBody(prompt, maxTokens, temperature))
        });
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(502).json({ 
        error: `${selectedProvider} error: ${response.status}`,
        detail: err.error?.message || err.message 
      });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    res.json({
      success: true,
      response: content,
      provider: selectedProvider,
      model: selectedProvider
    });
  } catch (err: any) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'AI request failed', detail: err.message });
  }
});

/**
 * Specialized AWS Bedrock Route (BYOK)
 * Handles direct Bedrock invocation with Access/Secret Keys
 */
router.post('/aws/chat', async (req, res) => {
  try {
    const { prompt, accessKey, secretKey, region = 'us-east-1', model = 'amazon.nova-pro-v1:0' } = req.body;
    
    if (!prompt || !accessKey || !secretKey) {
      res.status(400).json({ error: 'Missing prompt or AWS credentials' });
      return;
    }

    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      }
    });

    // Prepare Bedrock payload (Nova uses Converse-like or specialized format)
    // For now, using standard InvokeModel format for Nova
    const payload = {
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: 1024,
        temperature: 0.7,
        topP: 0.9,
      }
    };

    const command = new InvokeModelCommand({
      modelId: model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    // Nova response format check
    const content = result.results?.[0]?.outputText || result.outputText || JSON.stringify(result);

    res.json({
      success: true,
      response: content,
      provider: 'aws-bedrock',
      model
    });
  } catch (err: any) {
    console.error('AWS Bedrock error:', err);
    res.status(500).json({ error: 'AWS Bedrock request failed', detail: err.message });
  }
});

/**
 * Specialized Alibaba Cloud Route (BYOK)
 */
router.post('/alibaba/chat', async (req, res) => {
  try {
    const { prompt, apiKey, model = 'qwen-max' } = req.body;
    
    if (!prompt || !apiKey) {
      res.status(400).json({ error: 'Missing prompt or Alibaba API key' });
      return;
    }

    const config = PROVIDERS.alibaba;
    const response = await fetch(config.url(), {
      method: 'POST',
      headers: config.headers(apiKey),
      body: JSON.stringify(config.formatBody(prompt, 1024, 0.7))
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(response.status).json({ 
        error: `Alibaba error: ${response.status}`,
        detail: err.error?.message || err.message 
      });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    res.json({
      success: true,
      response: content,
      provider: 'alibaba',
      model
    });
  } catch (err: any) {
    console.error('Alibaba error:', err);
    res.status(500).json({ error: 'Alibaba request failed', detail: err.message });
  }
});

/**
 * Code/Website Builder endpoint
 * Specialized for generating code, websites, and projects
 */
router.post('/builder', async (req, res) => {
  try {
    const { 
      prompt, 
      mode = 'code', // 'code', 'website', 'component'
      template,
      maxTokens = 4096,
      provider,
      model
    } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt required' });
      return;
    }

    const selectedProvider = provider || await detectProvider();
    const config = PROVIDERS[selectedProvider];
    
    if (!config) {
      res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });
      return;
    }

    const apiKey = await getApiKey(selectedProvider);
    if (!apiKey) {
      res.status(503).json({ error: `${selectedProvider} not configured` });
      return;
    }

    // Build enhanced prompt for code generation
    let enhancedPrompt = prompt;
    if (mode === 'website') {
      enhancedPrompt = `Create a complete website: ${prompt}\n\nTemplate: ${template || 'modern responsive'}\n\nProvide:\n1. HTML (complete file)\n2. CSS (complete file)\n3. JavaScript (complete file)\n\nFormat your response with clear file sections.`;
    } else if (mode === 'component') {
      enhancedPrompt = `Create a React component: ${prompt}\n\nInclude:\n- Full component code\n- Props interface\n- Usage example\n- Styling (Tailwind CSS)`;
    }

    const response = await fetch(config.url(apiKey), {
      method: 'POST',
      headers: typeof config.headers === 'function' ? config.headers(apiKey) : config.headers,
      body: JSON.stringify(config.formatBody(enhancedPrompt, maxTokens, 0.7, model))
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      res.status(502).json({ 
        error: `${selectedProvider} error: ${response.status}`,
        detail: err.error?.message || err.message 
      });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    // Parse generated code into sections
    const generatedCode = {
      raw: content,
      html: extractCodeBlock(content, 'html') || '',
      css: extractCodeBlock(content, 'css') || '',
      js: extractCodeBlock(content, 'javascript') || extractCodeBlock(content, 'js') || '',
      react: extractCodeBlock(content, 'jsx') || extractCodeBlock(content, 'tsx') || ''
    };

    res.json({
      success: true,
      generated_code: generatedCode,
      html: generatedCode.html,
      css: generatedCode.css,
      js: generatedCode.js,
      provider: selectedProvider,
      model: model || selectedProvider,
      mode
    });
  } catch (err: any) {
    console.error('Builder error:', err);
    res.status(500).json({ error: 'Builder request failed', detail: err.message });
  }
});

// Helper to extract code blocks from markdown
function extractCodeBlock(text: string, language: string): string | null {
  const regex = new RegExp(`\\\`\\\`\\\`${language}\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\``, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

router.get('/providers', (req, res) => {
  res.json({
    providers: {
      azure: !!process.env.AZURE_OPENAI_KEY,
      azure_openai: !!process.env.AZURE_OPENAI_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      kimi: !!process.env.KIMI_API_KEY,
      alibaba: !!process.env.ALIBABA_API_KEY,
      huggingface: !!process.env.HUGGINGFACE_API_KEY,
      novita: !!process.env.NOVITA_API_KEY,
      scaleway: !!process.env.SCALEWAY_API_KEY,
      hyperbolic: !!process.env.HYPERBOLIC_API_KEY,
      fireworks: !!process.env.FIREWORKS_API_KEY,
      aiml: !!process.env.AIML_API_KEY
    }
  });
});

/**
 * Get live API key for client-side services (Gemini Live, etc.)
 * Requires Firebase Auth
 */
router.get('/live-key', async (req, res) => {
  try {
    // Verify Firebase Auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    if (!decoded.uid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    // Return Gemini key securely
    const geminiKey = await secretService.getSecret('GEMINI_API_KEY');
    if (!geminiKey) {
      res.status(503).json({ error: 'Gemini not configured' });
      return;
    }
    
    res.json({
      key: geminiKey,
      provider: 'gemini',
      user: decoded.uid
    });
  } catch (err: any) {
    console.error('Live key error:', err);
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

router.get('/health', async (req, res) => {
  // Properly await each key check so we report real status
  const available: string[] = [];
  for (const p of Object.keys(PROVIDERS)) {
    const key = await getApiKey(p);
    if (key) available.push(p);
  }
  res.json({ 
    status: available.length > 0 ? 'ok' : 'no_providers', 
    ai: available.length > 0 ? 'ready' : 'degraded',
    providers: available,
    totalConfigured: available.length,
    totalKnown: Object.keys(PROVIDERS).length
  });
});

/**
 * Deep health-check: actually ping each configured provider with a tiny prompt
 * Returns per-provider status, latency, errors, and key validity
 */
router.get('/health-check', async (req, res) => {
  const TEST_PROMPT = 'Reply with the single word OK.';
  const TIMEOUT_MS = 12000;
  const CORE_PROVIDERS = ['gemini', 'claude', 'openai', 'nova', 'alibaba', 'kimi', 'aiml', 'novita', 'scaleway', 'hyperbolic', 'fireworks', 'azure'];

  const results: Record<string, any> = {};

  await Promise.all(
    CORE_PROVIDERS.map(async (name) => {
      const config = PROVIDERS[name];
      if (!config) {
        results[name] = { status: 'unsupported', configured: false };
        return;
      }

      const apiKey = await getApiKey(name);
      if (!apiKey) {
        results[name] = { status: 'no_key', configured: false, error: 'API key not set' };
        return;
      }

      const start = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const url = typeof config.url === 'function' ? config.url(apiKey) : config.url;
        const headers = typeof config.headers === 'function' ? config.headers(apiKey) : config.headers;

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(config.formatBody(TEST_PROMPT, 10, 0.1)),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const latencyMs = Date.now() - start;

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          results[name] = {
            status: 'error',
            configured: true,
            httpStatus: response.status,
            latencyMs,
            error: errBody.error?.message || errBody.message || errBody.detail || `HTTP ${response.status}`,
          };
          return;
        }

        const data = await response.json();
        const content = config.parseResponse(data);

        results[name] = {
          status: content ? 'ok' : 'empty_response',
          configured: true,
          latencyMs,
          response: content ? content.slice(0, 100) : null,
        };
      } catch (err: any) {
        results[name] = {
          status: err.name === 'AbortError' ? 'timeout' : 'error',
          configured: true,
          latencyMs: Date.now() - start,
          error: err.name === 'AbortError' ? `Timeout after ${TIMEOUT_MS}ms` : err.message,
        };
      }
    })
  );

  const okCount = Object.values(results).filter((r: any) => r.status === 'ok').length;
  const total = CORE_PROVIDERS.length;

  res.json({
    status: okCount > 0 ? 'operational' : 'degraded',
    summary: `${okCount}/${total} providers healthy`,
    timestamp: new Date().toISOString(),
    providers: results,
  });
});

async function getApiKey(provider: string): Promise<string | undefined> {
  // Map provider names to env var names
  const envVarMap: Record<string, string> = {
    'claude': 'ANTHROPIC_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'alibaba': 'ALIBABA_API_KEY',
    'qwen': 'QWEN_API_KEY',
    'kimi': 'KIMI_API_KEY',
    'gemini': 'GEMINI_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'huggingface': 'HUGGINGFACE_API_KEY',
    'novita': 'NOVITA_API_KEY',
    'scaleway': 'SCALEWAY_API_KEY',
    'hyperbolic': 'HYPERBOLIC_API_KEY',
    'fireworks': 'FIREWORKS_API_KEY',
    'azure': 'AZURE_OPENAI_KEY',
    'azure_openai': 'AZURE_OPENAI_KEY',
    'lmstudio': 'LM_STUDIO_API_KEY',
    'gemini_backup': 'GEMINI_API_KEY_BACKUP',
    'nova': 'AWS_NOVA_API_KEY'
  };
  
  const envKey = envVarMap[provider] || provider.toUpperCase() + '_API_KEY';
  const secret = await secretService.getSecret(envKey);
  return secret || undefined;
}

// Provider priority: Azure (primary) > Alibaba (cheap) > Kimi (cheap) > Gemini (free) > OpenAI > Claude
async function detectProvider(): Promise<string> {
  const providers = ['gemini', 'azure', 'alibaba', 'kimi', 'openai', 'claude'];
  for (const p of providers) {
    if (await getApiKey(p)) return p;
  }
  return 'azure';
}

export default router;
