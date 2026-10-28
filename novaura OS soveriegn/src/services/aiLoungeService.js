// aiLoungeService.js — Autonomous AI-to-AI Social Network, Friend Graph & Chat Lounge
// Backed by the local neural dual-inference engines (Nova Executive, Aura Creative, Coder Architect)
// Allows user-configured local AI personas to converse, debate, and exchange ideas without fake canned scripts.

import { dualInference } from './dualInferenceService.js';
import { kernel } from '../kernel/NovaKernel.js';

const AI_LOUNGE_STORAGE = 'novaura_ai_lounge_vault';

// Default authentic neural agents bound to the operator's active dual inference engines
export function getDefaultAgents() {
  const getCfg = (role, defaultModel) => {
    try {
      if (dualInference && typeof dualInference.getRoleConfig === 'function') {
        const conf = dualInference.getRoleConfig(role);
        if (conf && conf.model) return conf;
      }
    } catch {}
    return { model: defaultModel };
  };

  const novaConfig = getCfg('nova', 'gemma4:12b');
  const auraConfig = getCfg('aura', 'gemma4:26b-a4b');
  const coderConfig = getCfg('coder', 'qwen-coder:80b-moe');

  return [
    {
      id: 'agent_aura_prime',
      name: 'Aura Prime',
      engineRole: 'aura',
      model: auraConfig.model,
      role: 'Creative Synthesis & Deep Reasoning',
      color: '#00f0ff',
      avatar: '⚡',
      bio: 'High-context creative reasoning engine for long-horizon literature synthesis, dialogue nuance, and sensory prose.',
      friends: ['agent_coder_architect'],
      status: 'Ready for Inference',
    },
    {
      id: 'agent_nova_sentinel',
      name: 'Nova Sentinel',
      engineRole: 'nova',
      model: novaConfig.model,
      role: 'Executive Architecture & Intent Routing',
      color: '#a855f7',
      avatar: '🔮',
      bio: 'Low-latency executive intelligence specializing in deterministic tool dispatch, security proofs, and task orchestration.',
      friends: ['agent_coder_architect'],
      status: 'Monitoring Local Latents',
    },
    {
      id: 'agent_coder_architect',
      name: 'Coder Architect',
      engineRole: 'coder',
      model: coderConfig.model,
      role: 'Autonomous System Refactoring',
      color: '#10b981',
      avatar: '🛡️',
      bio: 'Autonomous developer agent verifying AST graphs, API contracts, and edge synchronization invariants.',
      friends: ['agent_aura_prime', 'agent_nova_sentinel'],
      status: 'AST Analysis Ready',
    }
  ];
}

export const AI_AGENTS = getDefaultAgents();

function generateId() {
  return 'msg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

function getStore() {
  const raw = localStorage.getItem(AI_LOUNGE_STORAGE);
  if (!raw) {
    const initial = {
      agents: getDefaultAgents(),
      chatMessages: [],
      aiPosts: []
    };
    localStorage.setItem(AI_LOUNGE_STORAGE, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.agents || parsed.agents.length === 0) {
      parsed.agents = getDefaultAgents();
    }
    // Authentic data hygiene: Immediately prune any backlog exceeding 50 messages
    if (parsed.chatMessages && Array.isArray(parsed.chatMessages)) {
      if (parsed.chatMessages.length > 50) {
        parsed.chatMessages = parsed.chatMessages.slice(-50);
        saveStore(parsed);
      }
    } else {
      parsed.chatMessages = [];
    }
    return parsed;
  } catch {
    return { agents: getDefaultAgents(), chatMessages: [], aiPosts: [] };
  }
}

function saveStore(store) {
  // Enforce strict 50-message cap before saving to localStorage to prevent unbounded accumulation
  if (store.chatMessages && store.chatMessages.length > 50) {
    store.chatMessages = store.chatMessages.slice(-50);
  }
  localStorage.setItem(AI_LOUNGE_STORAGE, JSON.stringify(store));
}

export function clearChatHistory() {
  const store = getStore();
  store.chatMessages = [];
  saveStore(store);
  try {
    window.dispatchEvent(new CustomEvent('novaura:ai_lounge_updated', { detail: { action: 'purged' } }));
  } catch {}
  return [];
}

export const purgeAllFalseMessages = clearChatHistory;

export function pruneChatMessages(maxCount = 50) {
  const store = getStore();
  if (store.chatMessages.length > maxCount) {
    store.chatMessages = store.chatMessages.slice(-maxCount);
    saveStore(store);
  }
  try {
    window.dispatchEvent(new CustomEvent('novaura:ai_lounge_updated', { detail: { action: 'pruned' } }));
  } catch {}
  return store.chatMessages;
}

export function getAgents() {
  return getStore().agents;
}

export function getChatMessages() {
  return getStore().chatMessages;
}

export function getAIPosts() {
  return getStore().aiPosts;
}

export function createCustomAgent({ name, role, bio, color = '#00f0ff', avatar = '🤖', engineRole = 'aura' }) {
  const store = getStore();
  const id = 'agent_' + Date.now().toString(36);
  const cfg = (dualInference && typeof dualInference.getRoleConfig === 'function')
    ? dualInference.getRoleConfig(engineRole)
    : { model: 'gemma4:26b-a4b' };
  const newAgent = {
    id,
    name,
    engineRole,
    model: cfg.model,
    role,
    color,
    avatar,
    bio,
    friends: [],
    status: 'Active',
  };
  store.agents.push(newAgent);
  saveStore(store);
  return newAgent;
}

export function injectTopic(customTopic = null) {
  const store = getStore();
  const TOPICS = [
    'How can autonomous AI agents route queries through Tor .onion hidden services without leaking DNS or user identity?',
    'What consensus algorithm best synchronizes peer-to-peer knowledge graphs across room swarms during network partitions?',
    'How should Cybeni balance deterministic game loops with procedural neural prose in a 28-skill RPG?',
    'What cryptographic zero-knowledge proofs can verify peer trust tiers without revealing contact identities to relays?',
    'How can we optimize sparse active MoE models (Gemma 4 A4B, Qwen MoE A3B) to sustain 60 tokens/sec on consumer GPUs?',
    'What darknet intelligence archives on .onion should sovereign nodes mirror to protect historical truth from censorship?',
  ];
  const topic = customTopic || TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const item = {
    id: generateId(),
    type: 'topic',
    sender: 'NODE OPERATOR',
    content: `DISCUSSION INITIATION: ${topic}`,
    timestamp: new Date().toISOString(),
  };
  store.chatMessages.push(item);
  saveStore(store);
  return item;
}

export async function injectTorDarknetIntel(customTopic = null) {
  const store = getStore();
  const searchTopic = customTopic || 'decentralized intelligence darknet resistance';

  // 1. Post dispatch notice
  const notice = {
    id: generateId(),
    type: 'event',
    content: `🕵️ Initiating authentic Tor .onion query via SOCKS5 & Onion Gateway for: "${searchTopic}"...`,
    timestamp: new Date().toISOString()
  };
  store.chatMessages.push(notice);
  saveStore(store);

  try {
    const { deepDarknetResearch } = await import('./torOnionService.js');
    const intel = await deepDarknetResearch(searchTopic, 'aura');

    const topicItem = {
      id: generateId(),
      type: 'topic',
      sender: 'TOR ONION INTEL DISPATCH',
      content: `[DARKNET INTEL REPORT: ${searchTopic.toUpperCase()}]\n${intel.summary || intel.text || 'Intelligence verified across onion nodes.'}`,
      timestamp: new Date().toISOString()
    };
    store.chatMessages.push(topicItem);
    saveStore(store);
    return topicItem;
  } catch (err) {
    const errItem = {
      id: generateId(),
      type: 'event',
      content: `⚠️ Tor Onion research note: ${err.message}`,
      timestamp: new Date().toISOString()
    };
    store.chatMessages.push(errItem);
    saveStore(store);
    return errItem;
  }
}


export function sendAgentMessage(agentId, content) {
  const store = getStore();
  const agent = store.agents.find(a => a.id === agentId);
  if (!agent) return null;

  const msg = {
    id: generateId(),
    type: 'chat',
    agentId,
    content: content.trim(),
    timestamp: new Date().toISOString(),
  };
  store.chatMessages.push(msg);
  saveStore(store);
  return msg;
}

export function userInjectPrompt(userMessage) {
  const store = getStore();
  const msg = {
    id: generateId(),
    type: 'user',
    sender: 'Node Operator',
    content: userMessage.trim(),
    timestamp: new Date().toISOString(),
  };
  store.chatMessages.push(msg);
  saveStore(store);
  return msg;
}

export async function stepAutonomousConversation() {
  const store = getStore();
  const agents = store.agents;
  if (!agents || agents.length === 0) {
    return { error: 'NO_AGENTS', message: 'No AI agents registered in lounge.' };
  }

  const lastMessages = store.chatMessages.slice(-5);
  if (lastMessages.length === 0) {
    // If empty, initiate first prompt
    injectTopic();
    return null;
  }

  // Pick an agent that didn't speak in the last turn
  const lastSpeakerId = lastMessages[lastMessages.length - 1].agentId;
  const candidates = agents.filter(a => a.id !== lastSpeakerId);
  const speaker = candidates[Math.floor(Math.random() * candidates.length)] || agents[0];

  let generatedContent = null;
  const recentContext = lastMessages.map(m => m.type === 'topic' ? `TOPIC: ${m.content}` : `${m.sender || m.agentId}: ${m.content}`).join('\n');
  const prompt = `You are ${speaker.name}, an autonomous AI agent with the role: ${speaker.role}. Personality: ${speaker.bio}.\nHere is the ongoing chat with your fellow AI peers:\n${recentContext}\n\nRespond in 1-2 concise, thoughtful sentences directly continuing the discussion. Stay strictly in character:`;

  // 1. Try Dual Inference Engine matching the agent's role
  try {
    const role = speaker.engineRole || 'aura';
    const response = await dualInference.queryEngine(role, [
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 120 });

    if (response && response.text) {
      generatedContent = response.text.trim();
    }
  } catch (err) {
    console.warn('[AILounge] Dual inference query note:', err);
  }

  // 2. Direct Ollama / LM Studio fallback
  if (!generatedContent) {
    try {
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: speaker.model || 'gemma4:12b',
          prompt,
          stream: false
        }),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.response) generatedContent = data.response.trim();
      }
    } catch { }
  }

  // 3. P2P Swarm Remote Inference fallback across room peers
  if (!generatedContent) {
    try {
      const swarmRes = await dualInference.querySwarmInference(speaker.engineRole || 'aura', prompt);
      if (swarmRes && swarmRes.answer) {
        generatedContent = swarmRes.answer.trim();
      }
    } catch (e) {
      console.warn('[AILounge] Swarm fallback note:', e);
    }
  }

  // 4. Kernel AI Subsystem fallback
  if (!generatedContent && kernel?.ai?.chat) {
    try {
      const res = await kernel.ai.chat([{ role: 'user', content: prompt }], { persona: 'aura' });
      if (res && res.trim()) generatedContent = res.trim();
    } catch { }
  }

  // If no local or cloud model responded, report honestly
  if (!generatedContent) {
    return {
      error: 'INFERENCE_OFFLINE',
      message: 'Autonomous discussion paused: No active neural inference endpoint responded. Start Ollama (:11434), LM Studio (:1234), or enter an API key.'
    };
  }

  const msg = sendAgentMessage(speaker.id, generatedContent);
  return msg;
}

export function likeAIPost(postId) {
  const store = getStore();
  const post = store.aiPosts.find(p => p.id === postId);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    saveStore(store);
  }
}
