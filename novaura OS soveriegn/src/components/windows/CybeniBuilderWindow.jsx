import React, { useState, useEffect, useRef } from 'react';
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import {
  Code2, Send, Play, Save, FolderOpen, FileCode, Check, RefreshCw,
  Sparkles, Terminal, Layers, Plus, Trash2, Loader2, ArrowRight,
  ChevronDown, BookOpen, Cpu, Globe, PhoneCall, GitCommit,
  Eye, EyeOff, Mic, MicOff, Palette, ShoppingBag, Gamepad2, Volume2,
  ShieldCheck, Zap, Split, PlayCircle
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { saveFile, listFiles } from '../../services/fileStorageService.js';
import { novaHub } from '../../services/novaHubService.js';
import { dualInference } from '../../services/dualInferenceService.js';
import {
  CYBENI_MODEL_SPECTRUM,
  REASONING_STRATEGIES,
  DESIGN_SYSTEMS,
  compileLivePreview
} from '../../services/cybeniStudioEngine.js';
import { marketplacePublish } from '../../services/marketplacePublishService.js';
import CybeniIntegrationsModal from './cybeni/CybeniIntegrationsModal.jsx';


export const BLUEPRINTS = [
  {
    id: 'gemini_sdk',
    name: 'Google Gemini SDK (@google/genai)',
    category: 'Cloud AI',
    icon: Sparkles,
    color: '#38bdf8',
    filename: 'geminiService.js',
    content: `/**
 * Production Blueprint: Official Google Gen AI SDK (@google/genai v1.0+)
 * Fully typed, multi-modal, streaming, and tool-calling implementation.
 */
import { GoogleGenAI, Type } from '@google/genai';

export function createGeminiClient(apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required. Pass your key or configure it in Settings.');
  }
  return new GoogleGenAI({ apiKey });
}

// 1. Core Text Generation with Persona & Temperature
export async function generateContent(prompt, systemInstruction = 'You are a sovereign system engineer.') {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-argon',
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });
  return response.text;
}

// 2. Multimodal Vision & Image Inspection
export async function analyzeImage(base64Image, mimeType, prompt) {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      prompt,
    ],
  });
  return response.text;
}

// 3. Low-Latency Token Streaming
export async function* streamTokens(prompt) {
  const ai = createGeminiClient();
  const stream = await ai.models.generateContentStream({
    model: 'gemini-3.8-flash',
    contents: prompt,
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
`,
  },
  {
    id: 'vertex_ai',
    name: 'Google Cloud Vertex AI Enterprise REST',
    category: 'Cloud AI',
    icon: Globe,
    color: '#60a5fa',
    filename: 'vertexAiService.js',
    content: `/**
 * Production Blueprint: Google Cloud Vertex AI REST Connector
 * Enterprise IAM Bearer tokens, regional endpoints, and custom safety settings.
 */
export async function callVertexAi({
  projectId,
  location = 'us-central1',
  model = 'gemini-4-argon',
  accessToken,
  contents,
}) {
  if (!projectId || !accessToken) {
    throw new Error('GCP Project ID and OAuth2 Access Token are required for Vertex AI');
  }

  const endpoint = \`https://\${location}-aiplatform.googleapis.com/v1/projects/\${projectId}/locations/\${location}/publishers/google/models/\${model}:generateContent\`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(\`Vertex AI HTTP \${response.status}: \${errorText}\`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
`,
  },
  {
    id: 'offline_ollama',
    name: 'Decentralized Local Inference (Ollama / LM Studio)',
    category: 'Local / Offline',
    icon: Cpu,
    color: '#34d399',
    filename: 'localInferenceService.js',
    content: `/**
 * Production Blueprint: Decentralized Local Inference
 * Completely offline, zero external internet, streaming Ollama/LM Studio client.
 */
export async function callLocalInference({
  host = 'http://127.0.0.1:11434',
  model = 'gemma:4b',
  prompt,
  onToken,
}) {
  // 1. Verify localhost daemon is alive
  const ping = await fetch(\`\${host}/api/tags\`).catch(() => null);
  if (!ping) {
    throw new Error(\`Local inference daemon at \${host} is unreachable. Please start Ollama or LM Studio.\`);
  }

  // 2. Stream completions directly over HTTP
  const response = await fetch(\`\${host}/api/generate\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: Boolean(onToken) }),
  });

  if (!response.ok) {
    throw new Error(\`Local model inference failed with HTTP \${response.status}\`);
  }

  if (onToken) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            accumulated += parsed.response;
            onToken(parsed.response, accumulated);
          }
        } catch {}
      }
    }
    return accumulated;
  }

  const data = await response.json();
  return data.response;
}
`,
  },
  {
    id: 'p2p_telecom',
    name: 'Sovereign P2P WebRTC Telecom Connector',
    category: 'Decentralized Mesh',
    icon: PhoneCall,
    color: '#10b981',
    filename: 'telecomConnector.js',
    content: `/**
 * Production Blueprint: Sovereign P2P Telecom Connector
 * Initiates direct WebRTC video/audio calls with in-ecosystem phone numbers.
 */
import { callService, CallState } from '../../services/sovereignCallService.js';
import { getLocalIdentity } from '../../services/sovereignMesh.js';

export async function dialPeer(remotePhoneNumber, isVideo = true) {
  const localId = getLocalIdentity();
  console.info(\`Connecting \${localId?.phoneNumber} -> \${remotePhoneNumber}\`);

  // Start peer-to-peer session
  const callId = await callService.startCall(remotePhoneNumber, isVideo);

  callService.addEventListener('state_change', (event) => {
    console.log(\`Call \${callId} status:\`, event.detail.state);
  });

  return callId;
}
`,
  },
];

const STARTER_FILES = [
  {
    path: '/projects/cybeni/index.html',
    name: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cybeni Live App Canvas</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#070c1d] text-slate-100 min-h-screen p-6 font-sans flex flex-col items-center justify-center">
  <div class="max-w-xl w-full p-8 rounded-3xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-2xl shadow-2xl text-center">
    <div class="w-14 h-14 mx-auto rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 text-3xl shadow-lg shadow-cyan-500/20">
      ⚡
    </div>
    <h1 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-emerald-400 tracking-tight">
      Cybeni Omni Studio
    </h1>
    <p class="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
      Sovereign multi-model autonomous builder. 2B-35B GGUF C++ embeds, multi-cloud SDKs, and live hot-reload canvas.
    </p>
    <div class="mt-6 flex flex-wrap gap-2.5 justify-center">
      <button onclick="alert('Cybeni System Online!')" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all cursor-pointer">
        Launch System
      </button>
      <button onclick="document.getElementById('tech-stack').classList.toggle('hidden')" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer">
        View Active Stack
      </button>
    </div>
    <div id="tech-stack" class="hidden mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs font-mono text-slate-300">
      <div class="text-[10px] text-cyan-400 uppercase font-bold tracking-wider mb-2">Architectural Blueprint:</div>
      <div>• Model: Qwen 2.5 Coder 14B / C++ Embedded GGUF</div>
      <div>• Reasoning: Chain-of-Thought (Chain Weaver)</div>
      <div>• Framework: Tailwind CSS + React 19 + Node/Tauri</div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    path: '/projects/cybeni/styles.css',
    name: 'styles.css',
    content: `/* Cybeni Sovereign App Styles */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono&display=swap');

body {
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
}
`,
  },
  {
    path: '/projects/cybeni/index.js',
    name: 'index.js',
    content: `// Cybeni Omni Architecture Entry
import { createServer } from './server.js';

const app = createServer();
app.listen(8080, () => {
  console.log('Sovereign service listening on port 8080');
});`,
  },
  {
    path: '/projects/cybeni/server.js',
    name: 'server.js',
    content: `// High-throughput local API service
export function createServer() {
  return {
    listen: (port, cb) => cb && cb(),
    status: 'online',
  };
}`,
  },
  {
    path: '/projects/cybeni/README.md',
    name: 'README.md',
    content: `# Cybeni Project
Decentralized service architecture generated by Cybeni AI Coding Agent.
Local-first, encrypted, and standalone.`,
  },
];

export default function CybeniBuilderWindow() {
  const { kernel } = useKernel();
  const [projectFiles, setProjectFiles] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState('/projects/cybeni/index.html');
  const [fileContent, setFileContent] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [showBlueprints, setShowBlueprints] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  // Studio Omni States
  const [selectedModel, setSelectedModel] = useState('qwen2.5-coder:7b');
  const [selectedReasoning, setSelectedReasoning] = useState('cot_chain_weaver');
  const [selectedTheme, setSelectedTheme] = useState('cyberpunk');
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const recognitionRef = useRef(null);

  // Agent Chat State
  const [agentMessages, setAgentMessages] = useState([
    {
      role: 'assistant',
      content: 'I am Cybeni, your dedicated architecture and code engineering agent. Ask me to scaffold systems, insert production Google Gemini or Vertex API references, configure local Ollama, or build decentralized WebRTC apps.',
    },
  ]);
  const [agentInput, setAgentInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const toggleVoiceDictation = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setSaveNotice('Speech recognition API is not supported in this environment.');
      setTimeout(() => setSaveNotice(''), 3000);
      return;
    }
    if (isRecordingVoice) {
      recognitionRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setAgentInput(prev => (prev ? prev + ' ' + transcript : transcript));
      setIsRecordingVoice(false);
    };
    rec.onerror = () => setIsRecordingVoice(false);
    rec.onend = () => setIsRecordingVoice(false);
    recognitionRef.current = rec;
    rec.start();
    setIsRecordingVoice(true);
  };

  const chatEndRef = useRef(null);

  useEffect(() => {
    loadProjectFiles();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  const loadProjectFiles = async () => {
    try {
      const allDocs = await db.documents.toArray();
      const cybeniDocs = allDocs.filter(d => (d.path || '').startsWith('/projects/cybeni'));

      if (cybeniDocs.length === 0) {
        // Initialize starter files in database
        for (const f of STARTER_FILES) {
          await saveFile(f.path, f.content, 'text/javascript');
        }
        setProjectFiles(STARTER_FILES);
        setFileContent(STARTER_FILES[0].content);
        setActiveFilePath(STARTER_FILES[0].path);
      } else {
        setProjectFiles(cybeniDocs);
        const current = cybeniDocs.find(d => d.path === activeFilePath) || cybeniDocs[0];
        setFileContent(typeof current.content === 'string' ? current.content : '');
        setActiveFilePath(current.path);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectFile = (file) => {
    setActiveFilePath(file.path);
    setFileContent(typeof file.content === 'string' ? file.content : '');
  };

  const handleSaveActiveFile = async () => {
    await saveFile(activeFilePath, fileContent);
    setSaveNotice(`Saved ${activeFilePath}`);
    loadProjectFiles();
    setTimeout(() => setSaveNotice(''), 2500);
  };

  const [isPushingToHub, setIsPushingToHub] = useState(false);

  const handlePushToNovaHub = async () => {
    try {
      setIsPushingToHub(true);
      // Ensure current file in editor is saved to local Dexie store first
      await saveFile(activeFilePath, fileContent);
      let commitMsg = `Update ${activeFilePath.split('/').pop()} & Cybeni Architecture`;
      try {
        const userPrompt = window.prompt?.('Enter Nova Hub commit message:', commitMsg);
        if (userPrompt === null) {
          setIsPushingToHub(false);
          return;
        }
        if (userPrompt && userPrompt.trim()) {
          commitMsg = userPrompt.trim();
        }
      } catch {
        // Fallback to default commit message if prompt is blocked
      }

      const commit = await novaHub.commitProjectFiles({
        repoId: 'repo_cybeni_core',
        projectPath: '/projects/cybeni',
        message: commitMsg,
        author: 'Sovereign Operator <operator@sovereign.local>',
      });

      setSaveNotice(`Pushed to Nova Hub: commit ${commit.hash.slice(0, 7)}`);
      setTimeout(() => setSaveNotice(''), 4000);
    } catch (err) {
      console.error('Nova Hub commit error:', err);
      setSaveNotice(`Push to Nova Hub failed: ${err.message}`);
      setTimeout(() => setSaveNotice(''), 5000);
    } finally {
      setIsPushingToHub(false);
    }
  };

  const handlePublishToMarketplace = async () => {
    try {
      const filename = activeFilePath.split('/').pop() || 'index.js';
      await marketplacePublish.publishCreation({
        title: `Cybeni Blueprint: ${filename}`,
        category: 'blueprints',
        description: `Production sovereign code blueprint scaffolded via Cybeni AI in theme: ${selectedTheme}. Active Model: ${selectedModel}.`,
        tags: ['cybeni', 'blueprint', 'sovereign', selectedTheme],
        content: fileContent,
      });
      setSaveNotice('Published blueprint to Sovereign Marketplace & P2P Mesh Swarm!');
      setTimeout(() => setSaveNotice(''), 3500);
    } catch (err) {
      setSaveNotice(`Marketplace publish error: ${err.message}`);
      setTimeout(() => setSaveNotice(''), 4000);
    }
  };

  const handleCreateNewFile = async () => {
    const filename = prompt('Enter new filename (e.g., config.js, service.ts):');
    if (!filename || !filename.trim()) return;

    const newPath = `/projects/cybeni/${filename.trim()}`;
    await saveFile(newPath, '// New file\n');
    await loadProjectFiles();
    setActiveFilePath(newPath);
    setFileContent('// New file\n');
  };

  const handleApplyBlueprint = async (bp) => {
    const targetPath = `/projects/cybeni/${bp.filename}`;
    await saveFile(targetPath, bp.content, 'text/javascript');
    await loadProjectFiles();
    setActiveFilePath(targetPath);
    setFileContent(bp.content);
    setShowBlueprints(false);
    setSaveNotice(`Inserted ${bp.name}`);
    setTimeout(() => setSaveNotice(''), 2500);
  };

  const handleApplyIntegrationFromModal = async (integration) => {
    const targetPath = integration.suggestedPath;
    await saveFile(targetPath, integration.code, 'text/javascript');
    await loadProjectFiles();
    setActiveFilePath(targetPath);
    setFileContent(integration.code);
    setShowIntegrationsModal(false);
    setSaveNotice(`Scaffolded ${integration.title}`);
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const handleAskAiToIntegrate = async (integration) => {
    const targetPath = integration.suggestedPath;
    await saveFile(targetPath, integration.code, 'text/javascript');
    await loadProjectFiles();
    setActiveFilePath(targetPath);
    setFileContent(integration.code);
    setShowIntegrationsModal(false);
    setSaveNotice(`Scaffolded ${integration.title}. Cybeni AI dispatched!`);

    const promptText = `I have scaffolded the verified ${integration.title} architecture into ${targetPath}.
${integration.aiPrompt}

Here is the reference code:
\`\`\`javascript
${integration.code}
\`\`\`

Review our project structure and provide the configuration, environment variables, and any client-side hooks needed to connect this immediately.`;

    const newMsgs = [...agentMessages, { role: 'user', content: promptText }];
    setAgentMessages(newMsgs);
    setIsThinking(true);

    try {
      const systemPrompt = `You are Cybeni, an expert systems architect and staff-level software engineer.
You are assisting the user inside Sovereign OS.
Active File: ${targetPath}
Integration: ${integration.title} (${integration.vendor})
FAQs & Best Practices to follow:
${(integration.faqs || []).map((f, i) => `${i + 1}. Q: ${f.question} -> A: ${f.answer}`).join('\n')}

Give concise, highly accurate, production-ready code solutions.
When outputting code to be inserted or replaced in the file, place it in fenced code blocks.`;

      const response = await kernel?.ai?.chat([
        { role: 'system', content: systemPrompt },
        ...newMsgs.map(m => ({ role: m.role, content: m.content })),
      ], { persona: 'cybeni' });

      setAgentMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setAgentMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Architecture note: ${err.message}. Reference file ${targetPath} is ready in editor.` },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendPrompt = async (e) => {
    e?.preventDefault();
    const promptText = agentInput.trim();
    if (!promptText || isThinking) return;

    const newMsgs = [...agentMessages, { role: 'user', content: promptText }];
    setAgentMessages(newMsgs);
    setAgentInput('');
    setIsThinking(true);

    try {
      const reasoningObj = REASONING_STRATEGIES.find(r => r.id === selectedReasoning) || REASONING_STRATEGIES[0];
      const modelObj = CYBENI_MODEL_SPECTRUM.find(m => m.id === selectedModel) || CYBENI_MODEL_SPECTRUM[3];

      const systemPrompt = `You are Cybeni, an elite software architect and principal code engineer inside Sovereign OS.
Active File: ${activeFilePath}
Active Model Runtime: ${modelObj.name} (${modelObj.params}, ${modelObj.vram} VRAM, C++ Embed: ${modelObj.cppEmbed ? 'Available' : 'N/A'})
Active Reasoning Strategy: ${reasoningObj.name}
Strategy Directive: ${reasoningObj.systemPromptSupplement}
Active Design System Theme: ${selectedTheme}

File Content:
\`\`\`
${fileContent.slice(0, 4000)}
\`\`\`

Give concise, production-ready, zero-mock code solutions. Place replacement code in fenced blocks.`;

      let responseText = '';
      try {
        const dualRes = await dualInference.queryEngine('coder', [
          { role: 'system', content: systemPrompt },
          ...newMsgs.map(m => ({ role: m.role, content: m.content })),
        ], { temperature: 0.2, maxTokens: 2048 });
        if (dualRes && dualRes.text) responseText = dualRes.text;
      } catch (e) {
        console.warn('Dual inference note, falling back to kernel AI:', e);
      }

      if (!responseText) {
        responseText = await kernel?.ai?.chat([
          { role: 'system', content: systemPrompt },
          ...newMsgs.map(m => ({ role: m.role, content: m.content })),
        ], { persona: 'cybeni' });
      }

      setAgentMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      setAgentMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Inference note: ${err.message}. Local heuristics or configured models active.` },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const applyCodeToEditor = (code) => {
    setFileContent(code);
    setSaveNotice('Code applied to editor & canvas refreshed!');
    setPreviewKey(k => k + 1);
    setTimeout(() => setSaveNotice(''), 2500);
  };

  const renderMessageContent = (msg) => {
    if (msg.role !== 'assistant') return <div className="whitespace-pre-wrap">{msg.content}</div>;

    const parts = msg.content.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const lines = part.slice(3, -3).trim().split('\n');
            const lang = lines[0].trim();
            const code = lines.slice(lang.length > 0 && !lang.includes(' ') ? 1 : 0).join('\n');

            return (
              <div key={i} className="my-2 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1 bg-slate-900 border-b border-slate-800 text-[10px] text-cyan-400 font-mono">
                  <span>{lang || 'code'}</span>
                  <button
                    onClick={() => applyCodeToEditor(code)}
                    className="hover:text-white flex items-center gap-1 text-[10px]"
                  >
                    <span>Apply to Editor</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <pre className="p-2.5 text-[11px] font-mono text-slate-200 overflow-x-auto">{code}</pre>
              </div>
            );
          }
          return <div key={i} className="whitespace-pre-wrap">{part}</div>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-12 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          <Code2 className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-xs tracking-tight text-white hidden sm:inline">Cybeni Omni Studio</span>
          <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-mono">
            v2026.10
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Omni Studio Library Button */}
          <button
            onClick={() => setShowIntegrationsModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-purple-700 via-indigo-600 to-cyan-600 hover:from-purple-600 hover:to-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
            title="Browse full catalog of 30+ production architectures (Shopify, AliExpress, IONOS, Name.com, C++ GGUF, YouTube, Reddit)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="hidden md:inline">Omni Studio</span>
            <span>Library</span>
          </button>

          {/* Model Spectrum Selector (2B to 35B models) */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowModelMenu(m => !m); setShowReasoningMenu(false); setShowThemeMenu(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-mono transition-colors"
              title="Select active local or C++ embedded model (2B to 35B)"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="max-w-[110px] truncate">{CYBENI_MODEL_SPECTRUM.find(m => m.id === selectedModel)?.name.split(' ')[0]} {CYBENI_MODEL_SPECTRUM.find(m => m.id === selectedModel)?.params}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showModelMenu && (
              <div className="absolute left-0 mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl max-h-96 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                  <span>Model Spectrum (2B - 35B)</span>
                  <span className="text-cyan-400">C++ Embed Ready</span>
                </div>
                {CYBENI_MODEL_SPECTRUM.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModelMenu(false); }}
                    className={`p-2 rounded-lg text-left transition-colors flex items-start justify-between gap-2 text-xs ${
                      selectedModel === m.id ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-200' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.cppEmbed && (
                          <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                            C++ GGUF
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{m.description}</div>
                    </div>
                    <div className="text-right shrink-0 font-mono text-[10px] text-slate-400">
                      <div>{m.vram}</div>
                      <div className="text-emerald-400">{m.speed}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reasoning Strategy Selector */}
          <div className="relative shrink-0 hidden lg:block">
            <button
              onClick={() => { setShowReasoningMenu(r => !r); setShowModelMenu(false); setShowThemeMenu(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-lg text-xs transition-colors"
              title="Select reasoning strategy (Chain-of-Thought, Tree of Thoughts, Reflexion, DSPy)"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>{REASONING_STRATEGIES.find(r => r.id === selectedReasoning)?.badge}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showReasoningMenu && (
              <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Reasoning Strategy
                </div>
                {REASONING_STRATEGIES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedReasoning(r.id); setShowReasoningMenu(false); }}
                    className={`p-2 rounded-lg text-left transition-colors flex flex-col text-xs ${
                      selectedReasoning === r.id ? 'bg-purple-950/70 border border-purple-500/40 text-purple-200' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-white">{r.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* UI Theme Selector */}
          <div className="relative shrink-0 hidden xl:block">
            <button
              onClick={() => { setShowThemeMenu(t => !t); setShowModelMenu(false); setShowReasoningMenu(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-pink-300 border border-pink-500/30 rounded-lg text-xs transition-colors"
              title="Select design system theme for code generator & live canvas"
            >
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              <span>{DESIGN_SYSTEMS.find(d => d.id === selectedTheme)?.name.split(' ')[0]}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Design System Theme
                </div>
                {DESIGN_SYSTEMS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTheme(t.id); setShowThemeMenu(false); setPreviewKey(k => k + 1); }}
                    className={`p-2 rounded-lg text-left transition-colors flex items-center justify-between text-xs ${
                      selectedTheme === t.id ? 'bg-pink-950/70 border border-pink-500/40 text-pink-200' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white">{t.name}</div>
                      <div className="text-[10px] text-slate-400">{t.description}</div>
                    </div>
                    <div className="w-3 h-3 rounded-full shrink-0 ml-2" style={{ backgroundColor: t.accent }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live Canvas Split Toggle (Lovable / Replit Style) */}
          <button
            onClick={() => setShowLivePreview(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
              showLivePreview
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Toggle Live Visual Sandbox Preview side-by-side with code"
          >
            {showLivePreview ? <Split className="w-3.5 h-3.5 text-emerald-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{showLivePreview ? 'Live Canvas' : 'Preview'}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveActiveFile}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors shrink-0"
            title="Save active file to local database"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Push to Nova Hub */}
          <button
            onClick={handlePushToNovaHub}
            disabled={isPushingToHub}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-xs font-medium transition-all shadow-sm border border-purple-400/30 disabled:opacity-50 shrink-0"
            title="Commit & push project files to decentralized Nova Hub repository"
          >
            <GitCommit className="w-3.5 h-3.5 text-purple-200" />
            <span className="hidden md:inline">{isPushingToHub ? 'Pushing...' : 'Push to Hub'}</span>
          </button>

          {/* Publish to Sovereign Marketplace */}
          <button
            onClick={handlePublishToMarketplace}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-pink-600 hover:from-amber-500 hover:to-pink-500 text-white rounded-lg text-xs font-medium transition-all shadow-sm border border-amber-400/30 shrink-0 cursor-pointer"
            title="Publish this blueprint to the decentralized Sovereign Marketplace & P2P Swarm"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
            <span className="hidden md:inline">Publish to Market</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/60 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Main Workspace Grid: Files + (Monaco + Live Canvas) + Cybeni Agent */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Project File Tree */}
        <div className="w-52 bg-slate-900/40 border-r border-slate-800 flex flex-col p-3 shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Files</span>
            <button
              onClick={handleCreateNewFile}
              className="p-1 hover:bg-slate-800 rounded text-purple-400"
              title="New File"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1">
            {projectFiles.map(file => (
              <button
                key={file.path}
                onClick={() => handleSelectFile(file)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors truncate ${
                  activeFilePath === file.path
                    ? 'bg-purple-950/50 text-purple-300 border border-purple-500/30 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">{file.name || file.path.split('/').pop()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Monaco Editor & Live Visual Sandbox Canvas (Split-Screen / Full) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950">
          {/* Left Split: Monaco Editor */}
          <div className={`${showLivePreview ? 'w-full md:w-1/2' : 'w-full'} h-full flex flex-col overflow-hidden border-r border-slate-800/80`}>
            <div className="h-7 px-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="truncate">{activeFilePath}</span>
              <span className="text-[10px] text-cyan-400">{fileContent.split('\n').length} lines</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                theme="vs-dark"
                language={
                  activeFilePath.endsWith('.js') || activeFilePath.endsWith('.jsx') ? 'javascript' :
                  activeFilePath.endsWith('.ts') || activeFilePath.endsWith('.tsx') ? 'typescript' :
                  activeFilePath.endsWith('.json') ? 'json' :
                  activeFilePath.endsWith('.html') ? 'html' :
                  activeFilePath.endsWith('.css') ? 'css' :
                  activeFilePath.endsWith('.py') ? 'python' :
                  activeFilePath.endsWith('.rs') ? 'rust' :
                  activeFilePath.endsWith('.go') ? 'go' :
                  activeFilePath.endsWith('.cpp') || activeFilePath.endsWith('.hpp') ? 'cpp' : 'markdown'
                }
                value={fileContent}
                onChange={(val) => setFileContent(val || '')}
                options={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                  minimap: { enabled: !showLivePreview },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>
          </div>

          {/* Right Split: Live Visual Sandbox Canvas (Lovable / Replit Style) */}
          {showLivePreview && (
            <div className="w-full md:w-1/2 h-full flex flex-col bg-slate-950 overflow-hidden">
              <div className="h-7 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-slate-200">Live Visual Canvas</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    Hot-Reload
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Theme: {selectedTheme}</span>
                  <button
                    onClick={() => setPreviewKey(k => k + 1)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                    title="Recompile & reload sandbox"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-white relative">
                <iframe
                  key={previewKey}
                  title="Cybeni Live Sandbox Canvas"
                  srcDoc={compileLivePreview(projectFiles, selectedTheme)}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-modals allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Cybeni AI Coding Agent */}
        <div className="w-80 bg-slate-900/60 border-l border-slate-800 flex flex-col overflow-hidden shrink-0">
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-xs">Cybeni Architecture Agent</span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
              Ready ({CYBENI_MODEL_SPECTRUM.find(m => m.id === selectedModel)?.params})
            </span>
          </div>

          {/* Quick Studio Architecture Launchers */}
          <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 text-[10px]">
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/30 text-purple-300 hover:bg-purple-900 shrink-0"
            >
              <span>🔥 Firebase</span>
            </button>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900 shrink-0"
            >
              <span>⚡ C++ LLM</span>
            </button>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900 shrink-0"
            >
              <span>🛍️ E-Commerce</span>
            </button>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/30 text-amber-300 hover:bg-amber-900 shrink-0"
            >
              <span>🎮 GameDev</span>
            </button>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/70 border border-blue-500/30 text-blue-300 hover:bg-blue-900 shrink-0"
            >
              <span>🎙️ Voice</span>
            </button>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-pink-950/70 border border-pink-500/30 text-pink-300 hover:bg-pink-900 shrink-0"
            >
              <span>🎨 PixAI</span>
            </button>
            <button
              onClick={() => setShowIntegrationsModal(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 border border-rose-500/30 text-rose-300 hover:bg-rose-900 shrink-0"
            >
              <span>🌐 IONOS</span>
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
            {agentMessages.map((msg, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-950/40 border border-purple-500/30 text-purple-100 ml-4'
                    : 'bg-slate-950 border border-slate-800 text-slate-300 mr-2 shadow-sm'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                  {msg.role === 'user' ? 'Operator' : 'Cybeni Agent'}
                </div>
                {renderMessageContent(msg)}
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-purple-400 p-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cybeni is analyzing codebase architecture...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Form with Voice Dictation */}
          <form onSubmit={handleSendPrompt} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-1.5 items-center">
            <input
              type="text"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              placeholder="Ask Cybeni to generate or refactor code..."
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-purple-500"
            />
            {/* Voice Dictation (Speech-to-Text) */}
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`p-1.5 rounded-lg border transition-colors ${
                isRecordingVoice
                  ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Voice Dictation (Speech-to-Text)"
            >
              {isRecordingVoice ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              type="submit"
              disabled={isThinking || !agentInput.trim()}
              className="p-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Omni Integrations Studio Modal */}
      <CybeniIntegrationsModal
        isOpen={showIntegrationsModal}
        onClose={() => setShowIntegrationsModal(false)}
        onApplyIntegration={handleApplyIntegrationFromModal}
        onAskAiToIntegrate={handleAskAiToIntegrate}
      />
    </div>
  );
}
