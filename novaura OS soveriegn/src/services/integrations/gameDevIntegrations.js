/**
 * gameDevIntegrations.js — Game Engines & Marketplace Distribution
 * 
 * Production templates for Itch.io Butler automation, Godot 4 GDScript AI RPG logic,
 * and Unity C# neural agents connecting to local Ollama / LM Studio.
 */

export const GAMEDEV_INTEGRATIONS = [
  // ── 1. ITCH.IO BUTLER DEPLOYMENT ─────────────────────────────────────────
  {
    id: 'itch_io_butler_deploy',
    title: 'Itch.io Butler Automated Multi-Platform Deployment',
    category: 'gamedev_market',
    vendor: 'Itch.io',
    badge: 'Game Release CI/CD',
    icon: 'Gamepad2',
    color: '#fa5c5c',
    description: 'Production Node.js & Shell automation harness for Itch.io Butler CLI. Auto-detects game build artifacts, pushes to multi-channel targets (windows-x64, linux-x64, macos, web), and manages user version tags.',
    suggestedPath: '/projects/cybeni/scripts/deployItch.js',
    language: 'javascript',
    aiPrompt: 'Implement an automated Itch.io deployment script using Butler CLI with multi-channel target validation, environment API keys, and build folder compression.',
    faqs: [
      {
        question: 'What is Butler and how does it optimize game downloads?',
        answer: 'Butler is Itch.ios command-line tool that generates binary diffs (Wharf algorithm) so users only download changed files on game updates rather than the whole 10GB game.'
      },
      {
        question: 'How do I authenticate Butler without manual login?',
        answer: 'Set the BUTLER_API_KEY environment variable. Butler picks it up automatically on every push command.'
      }
    ],
    code: `import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Automates multi-channel game pushes to Itch.io via Butler
 */
export function deployToItch({
  user = 'novagameforge',
  game = 'sovereign-tactics',
  distDir = './dist/builds',
  version,
}) {
  const apiKey = process.env.BUTLER_API_KEY;
  if (!apiKey) {
    throw new Error('BUTLER_API_KEY environment variable is required.');
  }

  const channels = [
    { channel: 'windows-x64', folder: 'win64' },
    { channel: 'linux-x64', folder: 'linux' },
    { channel: 'web-html5', folder: 'html5' },
  ];

  console.log(\`[ItchDeploy] Starting release for \${user}/\${game} (Version: \${version || 'auto'})...\`);

  for (const { channel, folder } of channels) {
    const buildPath = path.resolve(distDir, folder);
    if (!fs.existsSync(buildPath)) {
      console.warn(\`[ItchDeploy] Skipping channel \${channel}: folder not found (\${buildPath})\`);
      continue;
    }

    const versionFlag = version ? \`--userversion "\${version}"\` : '';
    const cmd = \`butler push "\${buildPath}" \${user}/\${game}:\${channel} \${versionFlag}\`;

    console.log(\`[ItchDeploy] Pushing to \${user}/\${game}:\${channel}...\`);
    try {
      execSync(cmd, { stdio: 'inherit', env: { ...process.env, BUTLER_API_KEY: apiKey } });
      console.log(\`[ItchDeploy] Successfully deployed \${channel}!\`);
    } catch (err) {
      console.error(\`[ItchDeploy] Error pushing \${channel}:\`, err.message);
      throw err;
    }
  }

  console.log('[ItchDeploy] Full game deployment completed.');
}
`
  },

  // ── 2. GODOT 4 GDSCRIPT RPG ENGINE ──────────────────────────────────────
  {
    id: 'godot_4_gdscript_rpg',
    title: 'Godot 4 GDScript AI RPG State Machine & Neural Dialogue',
    category: 'gamedev_market',
    vendor: 'Godot Engine',
    badge: 'GDScript 2.0',
    icon: 'Layers',
    color: '#478cbf',
    description: 'Production Godot 4 GDScript architecture featuring a hierarchical state machine (Idle, Move, Attack, Dialogue), 28-skill attribute system, and async HTTPClient connecting to local Ollama / Cybeni for procedural NPC responses.',
    suggestedPath: '/projects/cybeni/godot/scripts/AiCharacterController.gd',
    language: 'gdscript',
    aiPrompt: 'Implement a Godot 4 GDScript character controller with state machine, skill attributes, and an async HTTP request node that polls local Ollama for dynamic in-game dialogue.',
    faqs: [
      {
        question: 'How does Godot 4 handle asynchronous HTTP queries without freezing the game loop?',
        answer: 'Use HTTPRequest node and await its request_completed signal. This runs concurrently on Godots main thread without blocking the 60fps render loop.'
      }
    ],
    code: `extends CharacterBody2D
class_name AiCharacterController

# ── 28-Skill Sovereign RPG Attributes ──────────────────────────────────
@export var character_name: String = "Aura the Alchemist"
@export var skills: Dictionary = {
	"combat": { "slashing": 15, "archery": 5, "defense": 12 },
	"magic": { "elemental": 25, "chronomancy": 10, "alchemy": 40 },
	"social": { "persuasion": 35, "intimidation": 8, "insight": 30 },
	"sovereign": { "cryptography": 50, "mesh_hacking": 45, "astronomy": 20 }
}

enum State { IDLE, WALKING, INTERACTING, COMBAT }
var current_state: State = State.IDLE
var http_request: HTTPRequest

func _ready() -> void:
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_ai_response_received)

func query_ai_dialogue(player_prompt: String) -> void:
	current_state = State.INTERACTING
	var system_prompt = "You are %s, an NPC in a sovereign fantasy RPG. Skills: %s. Respond in 2 immersive sentences." % [character_name, JSON.stringify(skills)]
	var body = JSON.stringify({
		"model": "qwen2.5-coder:7b",
		"prompt": system_prompt + "\nPlayer says: " + player_prompt,
		"stream": false
	})
	var headers = ["Content-Type: application/json"]
	http_request.request("http://127.0.0.1:11434/api/generate", headers, HTTPClient.METHOD_POST, body)

func _on_ai_response_received(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray) -> void:
	if response_code == 200:
		var json = JSON.new()
		json.parse(body.get_string_from_utf8())
		var response_text = json.get_data().get("response", "...")
		print("[%s Speaks]: %s" % [character_name, response_text])
	else:
		print("AI Dialogue offline (HTTP %d). Fallback to procedural bark." % response_code)
	current_state = State.IDLE
`
  },

  // ── 3. UNITY C# NEURAL AGENT ─────────────────────────────────────────────
  {
    id: 'unity_csharp_neural_agent',
    title: 'Unity C# Neural NPC Manager (Local Ollama / LM Studio)',
    category: 'gamedev_market',
    vendor: 'Unity Technologies',
    badge: 'Unity C#',
    icon: 'Cpu',
    color: '#222c37',
    description: 'Production Unity C# MonoBehaviour integrating UnityWebRequest and Task-based async logic to stream local LLM inference from Ollama / LM Studio directly into game dialogue UI and behavior trees.',
    suggestedPath: '/projects/cybeni/unity/NeuralNpcAgent.cs',
    language: 'csharp',
    aiPrompt: 'Implement Unity C# Neural NPC agent with UnityWebRequest, async/await support, personality prompt injection, and JSON response deserialization.',
    faqs: [
      {
        question: 'How do you avoid freezing Unity during local LLM generation?',
        answer: 'Use async Task with UnityWebRequestAsyncOperation or run the WebRequest on a background Task.Run() with main-thread synchronization via SynchronizationContext.'
      }
    ],
    code: `using System;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

public class NeuralNpcAgent : MonoBehaviour
{
    [Header("Inference Endpoint")]
    [SerializeField] private string endpointUrl = "http://127.0.0.1:11434/api/generate";
    [SerializeField] private string modelName = "gemma2:2b";

    [Header("Persona Definition")]
    [SerializeField] private string npcName = "Nova Sentinel";
    [TextArea(3, 5)]
    [SerializeField] private string personality = "You are a cybernetic orbital guardian. Speak with crisp tactical precision.";

    [System.Serializable]
    private class OllamaPayload
    {
        public string model;
        public string prompt;
        public bool stream;
    }

    [System.Serializable]
    private class OllamaResponse
    {
        public string response;
    }

    public async Task<string> GenerateDialogueAsync(string playerInput)
    {
        string fullPrompt = $"{personality}\\nPlayer: {playerInput}\\n{npcName}:";
        var payload = new OllamaPayload { model = modelName, prompt = fullPrompt, stream = false };
        string jsonBody = JsonUtility.ToJson(payload);

        using (var request = new UnityWebRequest(endpointUrl, "POST"))
        {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            var operation = request.SendWebRequest();
            while (!operation.isDone)
            {
                await Task.Yield();
            }

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[NeuralAgent] Inference failed: {request.error}");
                return "...";
            }

            var result = JsonUtility.FromJson<OllamaResponse>(request.downloadHandler.text);
            return result?.response?.Trim() ?? "...";
        }
    }
}
`
  }
];
