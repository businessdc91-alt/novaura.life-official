import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Swords, Copy, Download, Play, Code2, Sparkles, Wand2,
  Save, FolderOpen, FileArchive, Cloud, GitBranch,
  CheckSquare, Lightbulb, Zap, RefreshCw, Search, Globe,
  Database, Upload, Folder, FileText, Image, Box, Layers,
  BookOpen, Cpu, Code, Settings, ChevronRight, ChevronDown,
  Plus, Trash2, ExternalLink, Loader2, AlertCircle,
  Grid3X3, Mountain, TreePine, Waves, Wind
} from 'lucide-react';
import { exportProjectAsZip, downloadFile } from '../../utils/exportUtils';

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED DOJO - Game Development Powerhouse
// Knowledge base, web research, asset management, 3D world generation
// ═══════════════════════════════════════════════════════════════════════════════

const ENGINES = [
  { id: 'unreal', label: 'Unreal Engine 5', lang: 'C++', ext: '.cpp', icon: '🎮', color: 'text-blue-400', supports: ['3d', 'blueprint', 'nanite', 'lumen'] },
  { id: 'unity', label: 'Unity 6', lang: 'C#', ext: '.cs', icon: '🔷', color: 'text-cyan-400', supports: ['3d', 'urp', 'hdrp', 'dots'] },
  { id: 'godot', label: 'Godot 4', lang: 'GDScript', ext: '.gd', icon: '🤖', color: 'text-green-400', supports: ['3d', 'gdextension', 'visual'] },
];

const ASSET_TYPES = [
  { id: 'world-3d', label: '3D World/Level', desc: 'Complete 3D environment with terrain, props, lighting', complexity: 'very-high', category: 'world' },
  { id: 'character-controller', label: 'Character Controller', desc: 'Player movement, jumping, camera', complexity: 'medium', category: 'gameplay' },
  { id: 'enemy-ai', label: 'Enemy AI', desc: 'Patrol, chase, attack behaviors', complexity: 'high', category: 'ai' },
  { id: 'inventory', label: 'Inventory System', desc: 'Item slots, stacking, equipping', complexity: 'medium', category: 'systems' },
  { id: 'ui-hud', label: 'UI / HUD', desc: 'Health bar, minimap, score display', complexity: 'low', category: 'ui' },
  { id: 'dialogue', label: 'Dialogue System', desc: 'NPC conversations, branching choices', complexity: 'medium', category: 'systems' },
  { id: 'combat', label: 'Combat System', desc: 'Melee/ranged attacks, damage, abilities', complexity: 'high', category: 'gameplay' },
  { id: 'save-load', label: 'Save / Load', desc: 'Game state persistence and recovery', complexity: 'medium', category: 'systems' },
  { id: 'particles', label: 'Particle Effects', desc: 'Fire, smoke, magic, explosions', complexity: 'low', category: 'fx' },
  { id: 'procedural', label: 'Procedural Generation', desc: 'Random levels, items, terrain', complexity: 'high', category: 'world' },
  { id: 'multiplayer', label: 'Multiplayer Networking', desc: 'Sync, lobby, matchmaking', complexity: 'very-high', category: 'networking' },
  { id: 'shader', label: 'Custom Shaders', desc: 'HLSL/GLSL/Shader Graph materials', complexity: 'high', category: 'fx' },
  { id: 'animation', label: 'Animation System', desc: 'State machines, blending, IK', complexity: 'high', category: 'gameplay' },
  { id: 'physics', label: 'Physics Interactions', desc: 'Ragdolls, joints, vehicles', complexity: 'high', category: 'gameplay' },
];

const WORLD_GENERATORS = [
  { id: 'forest', name: 'Enchanted Forest', icon: TreePine, biomes: ['dense woods', 'clearings', 'ancient ruins'], features: ['procedural trees', 'fog volumes', 'particle wildlife'] },
  { id: 'desert', name: 'Cyber Desert', icon: Waves, biomes: ['dunes', 'oasis', 'abandoned structures'], features: ['sand shaders', 'heat haze', 'dynamic shadows'] },
  { id: 'mountain', name: 'Snowy Peaks', icon: Mountain, biomes: ['peaks', 'valleys', 'frozen lakes'], features: ['snow deformation', 'avalanche fx', 'icicle systems'] },
  { id: 'ocean', name: 'Underwater Realm', icon: Waves, biomes: ['coral reefs', 'deep trenches', 'sunken cities'], features: ['caustics', 'bubble particles', 'kelp forests'] },
  { id: 'city', name: 'Neo Tokyo', icon: Grid3X3, biomes: ['streets', 'rooftops', 'underground'], features: ['neon signs', 'rain fx', 'crowd systems'] },
  { id: 'space', name: 'Space Station', icon: Box, biomes: ['hangars', 'labs', 'docking bays'], features: ['zero-g physics', 'holograms', 'airlock systems'] },
];

const RESEARCH_SOURCES = [
  { id: 'docs', name: 'Engine Documentation', icon: BookOpen },
  { id: 'github', name: 'GitHub Repositories', icon: Code },
  { id: 'tutorials', name: 'Video Tutorials', icon: Play },
  { id: 'forums', name: 'Community Forums', icon: Globe },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DOJO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DojoWindow({ onAIChat }) {
  // ── Core State ───────────────────────────────────────────────────────────────
  const [engine, setEngine] = useState('godot');
  const [assetType, setAssetType] = useState('world-3d');
  const [code, setCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('generate'); // generate | knowledge | research | assets
  
  // World generation state
  const [selectedWorldType, setSelectedWorldType] = useState('forest');
  const [worldSize, setWorldSize] = useState('medium'); // small | medium | large
  const [worldComplexity, setWorldComplexity] = useState('balanced'); // simple | balanced | complex
  const [worldFeatures, setWorldFeatures] = useState([]);
  
  // Knowledge base state
  const [knowledgeBase, setKnowledgeBase] = useState({
    codeSnippets: [],
    uploadedAssets: [],
    documentation: [],
    projectReferences: []
  });
  const [selectedKnowledge, setSelectedKnowledge] = useState([]);
  
  // Research state
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState([]);
  const [researching, setResearching] = useState(false);
  
  // Asset upload state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // Generation config
  const [customPrompt, setCustomPrompt] = useState('');
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [useWebResearch, setUseWebResearch] = useState(false);
  const [generationMode, setGenerationMode] = useState('asset'); // asset | world | research

  const currentEngine = ENGINES.find(e => e.id === engine);
  const currentAsset = ASSET_TYPES.find(a => a.id === assetType);
  const currentWorld = WORLD_GENERATORS.find(w => w.id === selectedWorldType);

  // ═══════════════════════════════════════════════════════════════════════════════
  // KNOWLEDGE BASE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  const TEXT_CATEGORIES = ['code', 'other'];
  const MAX_TEXT_BYTES = 256 * 1024; // read up to 256KB of text per file for AI context

  const handleFileUpload = useCallback(async (files) => {
    const fileArr = Array.from(files);
    const newFiles = [];

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      const category = categorizeFile(file.name);
      const entry = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        category,
        uploadDate: new Date().toISOString(),
        content: null,
        status: 'uploaded',
      };

      // Read text-like files so generation prompts can include real content
      if (TEXT_CATEGORIES.includes(category) && file.size <= MAX_TEXT_BYTES) {
        try {
          entry.content = await file.text();
        } catch { /* binary or unreadable — keep as metadata reference */ }
      }

      newFiles.push(entry);
      setUploadProgress(Math.round(((i + 1) / fileArr.length) * 100));
    }

    setUploadedFiles(prev => {
      const next = [...prev, ...newFiles];
      // Persist knowledge base across sessions (content capped, so this stays small)
      try { localStorage.setItem('dojo_knowledge_files', JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
    setUploadProgress(0);
  }, []);

  // Restore knowledge base on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dojo_knowledge_files') || '[]');
      if (saved.length > 0) setUploadedFiles(saved);
    } catch { /* corrupt — start fresh */ }
  }, []);

  const categorizeFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['fbx', 'obj', 'gltf', 'glb', 'blend', 'ma', 'mb'].includes(ext)) return '3d-model';
    if (['png', 'jpg', 'jpeg', 'tga', 'psd', 'exr'].includes(ext)) return 'texture';
    if (['cs', 'cpp', 'h', 'hpp', 'gd', 'py', 'js', 'ts'].includes(ext)) return 'code';
    if (['wav', 'mp3', 'ogg', 'flac'].includes(ext)) return 'audio';
    if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
    if (['prefab', 'unitypackage', 'uasset', 'umap'].includes(ext)) return 'engine-asset';
    return 'other';
  };

  const removeFile = (id) => {
    setUploadedFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      try { localStorage.setItem('dojo_knowledge_files', JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // WEB RESEARCH
  // ═══════════════════════════════════════════════════════════════════════════════

  const performResearch = useCallback(async () => {
    if (!researchQuery.trim() || !onAIChat) return;
    
    setResearching(true);
    try {
      const prompt = `Search and summarize information about: "${researchQuery}"
      
Context: Game development for ${currentEngine.label}
Focus on: Implementation details, best practices, code examples, and common pitfalls.

Provide:
1. Quick summary (2-3 sentences)
2. Key implementation points
3. Code snippet example (if applicable)
4. Relevant documentation links
5. Community forum discussions summary`;

      const result = await onAIChat(prompt, 'research');
      
      const newResult = {
        id: Date.now(),
        query: researchQuery,
        response: result?.response || 'Research completed',
        timestamp: new Date().toISOString(),
        engine: engine
      };
      
      setResearchResults(prev => [newResult, ...prev]);
    } catch (err) {
      console.error('Research failed:', err);
    } finally {
      setResearching(false);
      setResearchQuery('');
    }
  }, [researchQuery, onAIChat, engine, currentEngine]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // AI GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  const generateWorld = useCallback(async () => {
    if (!onAIChat) {
      setCode(generateWorldTemplate(engine, selectedWorldType, worldSize, worldComplexity));
      return;
    }

    setGenerating(true);
    try {
      const worldConfig = WORLD_GENERATORS.find(w => w.id === selectedWorldType);
      
      const knowledgeContext = useKnowledgeBase && uploadedFiles.length > 0
        ? `\n\nReference Assets Available:\n${uploadedFiles.map(f => `- ${f.name} (${f.category})`).join('\n')}` +
          uploadedFiles.filter(f => f.content).slice(0, 5)
            .map(f => `\n\n--- ${f.name} ---\n${f.content.slice(0, 4000)}`).join('')
        : '';

      const prompt = `Generate a complete ${worldSize} ${worldConfig.name} for ${currentEngine.label}.

Configuration:
- Engine: ${currentEngine.label} (${currentEngine.lang})
- Complexity: ${worldComplexity}
- Size: ${worldSize}
- Biomes: ${worldConfig.biomes.join(', ')}
- Features: ${worldConfig.features.join(', ')}
${worldFeatures.length > 0 ? `- Custom Features: ${worldFeatures.join(', ')}` : ''}
${knowledgeContext}

Generate:
1. Scene setup code with proper node hierarchy
2. Procedural generation scripts
3. Lighting and environment setup
4. Player spawn and basic navigation
5. Optimization settings
6. Comments explaining each section

This should be a complete, runnable world that can be dropped into a project.`;

      const result = await onAIChat(prompt, 'coding');
      setCode(result?.code || result?.response || generateWorldTemplate(engine, selectedWorldType, worldSize, worldComplexity));
    } catch (err) {
      console.error('World generation failed:', err);
      setCode(generateWorldTemplate(engine, selectedWorldType, worldSize, worldComplexity));
    } finally {
      setGenerating(false);
    }
  }, [engine, selectedWorldType, worldSize, worldComplexity, worldFeatures, onAIChat, currentEngine, uploadedFiles, useKnowledgeBase]);

  const generateAsset = useCallback(async () => {
    if (assetType === 'world-3d') {
      generateWorld();
      return;
    }

    if (!onAIChat) {
      setCode(generatePlaceholder(engine, assetType));
      return;
    }

    setGenerating(true);
    try {
      const codeFiles = uploadedFiles.filter(f => f.category === 'code');
      const knowledgeContext = useKnowledgeBase && codeFiles.length > 0
        ? `\n\nReference Code Snippets:\n${codeFiles.map(f => `- ${f.name}`).join('\n')}` +
          codeFiles.filter(f => f.content).slice(0, 5)
            .map(f => `\n\n--- ${f.name} ---\n${f.content.slice(0, 4000)}`).join('')
        : '';

      const prompt = `Generate production-ready ${currentAsset.label} for ${currentEngine.label} in ${currentEngine.lang}.

Requirements:
${currentAsset.desc}
Complexity: ${currentAsset.complexity}
${knowledgeContext}

Include:
- Complete implementation with error handling
- Performance optimizations
- Integration examples
- Comments explaining architecture
- Best practices for ${currentEngine.label}

The code should be production-ready and follow engine conventions.`;

      const result = await onAIChat(prompt, 'coding');
      setCode(result?.code || result?.response || generatePlaceholder(engine, assetType));
    } catch (err) {
      console.error('Asset generation failed:', err);
      setCode(generatePlaceholder(engine, assetType));
    } finally {
      setGenerating(false);
    }
  }, [assetType, engine, onAIChat, currentAsset, currentEngine, uploadedFiles, useKnowledgeBase, generateWorld]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const exportAsset = async () => {
    const files = [
      { name: `${assetType}${currentEngine.ext}`, content: code },
      { name: 'README.md', content: generateReadme() },
      { name: '.novaura/dojo-config.json', content: JSON.stringify({
        engine, assetType, selectedWorldType, worldSize, worldComplexity,
        generatedAt: new Date().toISOString()
      }, null, 2)}
    ];

    await exportProjectAsZip({
      files,
      projectName: `dojo-${currentAsset?.label || 'asset'}-${currentEngine.label}`,
      metadata: { engine, assetType, type: 'dojo-asset' }
    });
  };

  const generateReadme = () => `# ${currentAsset?.label || 'Game Asset'}

**Engine:** ${currentEngine.label}  
**Type:** ${currentAsset?.label || 'Custom'}  
**Generated:** ${new Date().toLocaleString()}

## Overview
${currentAsset?.desc || 'Custom generated game asset'}

## Files
- Main implementation: \`${assetType}${currentEngine.ext}\`
- Configuration: \`.novaura/dojo-config.json\`

## Installation
1. Import/copy the code into your ${currentEngine.label} project
2. Follow setup instructions in code comments
3. Configure any exposed parameters

## Dependencies
- ${currentEngine.label} (latest stable)
- See code comments for specific dependencies

---
Generated with NovAura Dojo 🎮
`;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-900/30 to-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center">
            <Swords className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="font-bold text-white">Dojo</h1>
            <p className="text-xs text-slate-500">AI Game Development Studio</p>
          </div>
        </div>
        
        {/* Main Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          {[
            { id: 'generate', icon: Sparkles, label: 'Generate' },
            { id: 'knowledge', icon: Database, label: 'Knowledge' },
            { id: 'research', icon: Search, label: 'Research' },
            { id: 'assets', icon: Folder, label: 'Assets' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                activeTab === tab.id ? 'bg-orange-600/30 text-orange-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-slate-800 overflow-y-auto p-4 space-y-4 shrink-0">
          
          {/* Engine Selection */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
              Game Engine
            </label>
            <div className="space-y-2">
              {ENGINES.map(e => (
                <button
                  key={e.id}
                  onClick={() => setEngine(e.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                    engine === e.id
                      ? 'bg-orange-600/20 border-orange-600/50 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-2xl">{e.icon}</span>
                  <div>
                    <div className={`font-medium ${engine === e.id ? 'text-orange-300' : 'text-slate-300'}`}>
                      {e.label}
                    </div>
                    <div className="text-xs text-slate-500">{e.lang}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generation Mode */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
              Generation Mode
            </label>
            <div className="space-y-1">
              {[
                { id: 'asset', label: 'Game Asset', desc: 'Scripts, systems, components' },
                { id: 'world', label: '3D World', desc: 'Complete environments' },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setGenerationMode(mode.id);
                    if (mode.id === 'world') setAssetType('world-3d');
                  }}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors border ${
                    generationMode === mode.id
                      ? 'bg-blue-600/20 border-blue-600/50 text-blue-300'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-xs text-slate-500">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Context Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useKnowledgeBase}
                onChange={e => setUseKnowledgeBase(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-600"
              />
              Use Knowledge Base
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useWebResearch}
                onChange={e => setUseWebResearch(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-600"
              />
              Enable Web Research
            </label>
          </div>

          {/* Stats */}
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500 mb-2">Knowledge Base</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Assets</span>
                <span className="text-orange-400">{uploadedFiles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Research</span>
                <span className="text-blue-400">{researchResults.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'generate' && generationMode === 'world' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">3D World Generator</h2>
                <p className="text-slate-400">Generate complete game environments with AI</p>
              </div>

              {/* World Type Selection */}
              <div className="grid grid-cols-3 gap-4">
                {WORLD_GENERATORS.map(world => (
                  <button
                    key={world.id}
                    onClick={() => setSelectedWorldType(world.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedWorldType === world.id
                        ? 'bg-blue-600/20 border-blue-600/50'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <world.icon className={`w-8 h-8 mb-3 ${selectedWorldType === world.id ? 'text-blue-400' : 'text-slate-500'}`} />
                    <div className={`font-medium ${selectedWorldType === world.id ? 'text-blue-300' : 'text-slate-300'}`}>
                      {world.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{world.biomes.length} biomes</div>
                  </button>
                ))}
              </div>

              {/* World Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <label className="text-sm font-medium text-slate-300 mb-2 block">World Size</label>
                  <div className="flex gap-2">
                    {['small', 'medium', 'large'].map(size => (
                      <button
                        key={size}
                        onClick={() => setWorldSize(size)}
                        className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors ${
                          worldSize === size
                            ? 'bg-blue-600/30 text-blue-300 border border-blue-600/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Complexity</label>
                  <div className="flex gap-2">
                    {['simple', 'balanced', 'complex'].map(comp => (
                      <button
                        key={comp}
                        onClick={() => setWorldComplexity(comp)}
                        className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors ${
                          worldComplexity === comp
                            ? 'bg-blue-600/30 text-blue-300 border border-blue-600/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {comp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Features */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <label className="text-sm font-medium text-slate-300 mb-3 block">Custom Features</label>
                <textarea
                  value={worldFeatures.join('\n')}
                  onChange={e => setWorldFeatures(e.target.value.split('\n').filter(f => f.trim()))}
                  placeholder="Add specific features (one per line)...&#10;e.g.,&#10;underwater cave system&#10;ancient temple ruins&#10;dynamic weather system"
                  className="w-full h-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={generateWorld}
                disabled={generating}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 rounded-xl text-lg font-semibold text-white transition-all flex items-center justify-center gap-3"
              >
                {generating ? (
                  <><RefreshCw className="w-6 h-6 animate-spin" /> Generating World...</>
                ) : (
                  <><Wand2 className="w-6 h-6" /> Generate 3D World</>
                )}
              </button>
            </div>
          )}

          {activeTab === 'generate' && generationMode === 'asset' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Game Asset Generator</h2>
                <p className="text-slate-400">Generate scripts, systems, and components</p>
              </div>

              {/* Asset Type Grid */}
              <div className="grid grid-cols-2 gap-3">
                {ASSET_TYPES.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => setAssetType(asset.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      assetType === asset.id
                        ? 'bg-orange-600/20 border-orange-600/50'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${assetType === asset.id ? 'text-orange-300' : 'text-slate-300'}`}>
                        {asset.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        asset.complexity === 'low' ? 'bg-green-900/50 text-green-400' :
                        asset.complexity === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                        asset.complexity === 'high' ? 'bg-orange-900/50 text-orange-400' :
                        'bg-red-900/50 text-red-400'
                      }`}>
                        {asset.complexity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{asset.desc}</div>
                  </button>
                ))}
              </div>

              {/* Custom Prompt */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <label className="text-sm font-medium text-slate-300 mb-2 block">Custom Requirements</label>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="Add specific requirements...&#10;e.g., 'Include double jump mechanic' or 'Use state machine pattern'"
                  className="w-full h-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={generateAsset}
                disabled={generating}
                className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 rounded-xl text-lg font-semibold text-white transition-all flex items-center justify-center gap-3"
              >
                {generating ? (
                  <><RefreshCw className="w-6 h-6 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-6 h-6" /> Generate {currentAsset?.label}</>
                )}
              </button>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Knowledge Base</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Code className="w-5 h-5 text-blue-400" />
                    <h3 className="font-medium text-white">Code Snippets</h3>
                  </div>
                  <p className="text-sm text-slate-500">Saved code examples and patterns</p>
                  <div className="mt-3 text-2xl font-bold text-blue-400">
                    {uploadedFiles.filter(f => f.category === 'code').length}
                  </div>
                </div>

                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Box className="w-5 h-5 text-green-400" />
                    <h3 className="font-medium text-white">3D Models</h3>
                  </div>
                  <p className="text-sm text-slate-500">Reference models and assets</p>
                  <div className="mt-3 text-2xl font-bold text-green-400">
                    {uploadedFiles.filter(f => f.category === '3d-model').length}
                  </div>
                </div>

                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Image className="w-5 h-5 text-purple-400" />
                    <h3 className="font-medium text-white">Textures & Materials</h3>
                  </div>
                  <p className="text-sm text-slate-500">Reference textures and shaders</p>
                  <div className="mt-3 text-2xl font-bold text-purple-400">
                    {uploadedFiles.filter(f => f.category === 'texture').length}
                  </div>
                </div>

                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <BookOpen className="w-5 h-5 text-yellow-400" />
                    <h3 className="font-medium text-white">Documentation</h3>
                  </div>
                  <p className="text-sm text-slate-500">Saved research and docs</p>
                  <div className="mt-3 text-2xl font-bold text-yellow-400">
                    {researchResults.length}
                  </div>
                </div>
              </div>

              {/* Uploaded Files List */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-medium text-white">Uploaded Assets</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={e => handleFileUpload(e.target.files)}
                  className="hidden"
                />
                
                {uploadProgress > 0 && (
                  <div className="px-4 py-2 bg-slate-800/30">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="divide-y divide-slate-800">
                  {uploadedFiles.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-500">
                      <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No assets uploaded yet</p>
                      <p className="text-sm mt-1">Upload code, models, or textures to use as reference</p>
                    </div>
                  ) : (
                    uploadedFiles.map(file => (
                      <div key={file.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                          {file.category === 'code' && <Code className="w-4 h-4 text-blue-400" />}
                          {file.category === '3d-model' && <Box className="w-4 h-4 text-green-400" />}
                          {file.category === 'texture' && <Image className="w-4 h-4 text-purple-400" />}
                          {file.category === 'audio' && <span className="text-pink-400">♪</span>}
                          {!['code', '3d-model', 'texture', 'audio'].includes(file.category) && <FileText className="w-4 h-4 text-slate-400" />}
                          <div>
                            <div className="text-sm text-slate-300">{file.name}</div>
                            <div className="text-xs text-slate-500">{file.category} • {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1.5 hover:bg-red-600/20 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'research' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Web Research</h2>
              
              {/* Search Box */}
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={researchQuery}
                  onChange={e => setResearchQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && performResearch()}
                  placeholder="Search for solutions, patterns, best practices..."
                  className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={performResearch}
                  disabled={researching || !researchQuery.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-medium flex items-center gap-2"
                >
                  {researching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Research
                </button>
              </div>

              {/* Sources */}
              <div className="flex gap-2 mb-6">
                {RESEARCH_SOURCES.map(source => (
                  <div
                    key={source.id}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-400 flex items-center gap-2"
                  >
                    <source.icon className="w-4 h-4" />
                    {source.name}
                  </div>
                ))}
              </div>

              {/* Results */}
              <div className="space-y-4">
                {researchResults.map(result => (
                  <div key={result.id} className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-white">{result.query}</h3>
                      <span className="text-xs text-slate-500">
                        {new Date(result.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-slate-300 text-sm">
                        {result.response}
                      </pre>
                    </div>
                  </div>
                ))}
                
                {researchResults.length === 0 && !researching && (
                  <div className="text-center py-12 text-slate-500">
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Search the web for game dev solutions</p>
                    <p className="text-sm mt-1">Try "inventory system pattern" or "Unity movement physics"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Asset Library</h2>
              
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: 'Characters', count: 0, icon: '👤' },
                  { name: 'Environments', count: 0, icon: '🌍' },
                  { name: 'Props', count: 0, icon: '📦' },
                  { name: 'Vehicles', count: 0, icon: '🚗' },
                  { name: 'Weapons', count: 0, icon: '⚔️' },
                  { name: 'Effects', count: 0, icon: '✨' },
                ].map(category => (
                  <div key={category.name} className="p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="text-3xl mb-2">{category.icon}</div>
                    <div className="font-medium text-white">{category.name}</div>
                    <div className="text-sm text-slate-500">{category.count} assets</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-700 text-center">
                <Database className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">Connect asset store integrations</p>
                <p className="text-sm text-slate-600 mt-1">Unity Asset Store, Unreal Marketplace, Sketchfab</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Code Output */}
        {code && (
          <div className="w-96 border-l border-slate-800 bg-slate-950 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">
                  {generationMode === 'world' ? 'Generated World' : currentAsset?.label}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => navigator.clipboard.writeText(code)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={exportAsset} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                  <FileArchive className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <pre className="p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap">
                {code}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

function generateWorldTemplate(engine, worldType, size, complexity) {
  const world = WORLD_GENERATORS.find(w => w.id === worldType);
  const dim = size === 'small' ? 128 : size === 'medium' ? 256 : 512;
  const freq = complexity === 'simple' ? 0.01 : complexity === 'balanced' ? 0.02 : 0.04;
  const octaves = complexity === 'simple' ? 3 : complexity === 'balanced' ? 5 : 8;
  const propCount = complexity === 'simple' ? 100 : complexity === 'balanced' ? 400 : 1200;
  // Per-world-type tuning: height scale and biome color bands
  const heightScale = worldType === 'mountain' ? 80 : worldType === 'desert' ? 12 : worldType === 'ocean' ? 20 : 30;

  if (engine === 'godot') {
    return `# ${world.name} — Godot 4 procedural world
# Size: ${size} (${dim}x${dim}) | Complexity: ${complexity}
# Biomes: ${world.biomes.join(', ')}
extends Node3D

@export var world_size: int = ${dim}
@export var height_scale: float = ${heightScale}.0
@export var prop_count: int = ${propCount}

var noise := FastNoiseLite.new()
var biome_noise := FastNoiseLite.new()

func _ready() -> void:
    _setup_noise()
    _generate_terrain()
    _scatter_props()
    _setup_lighting()
    _spawn_player()

func _setup_noise() -> void:
    noise.seed = randi()
    noise.frequency = ${freq}
    noise.fractal_octaves = ${octaves}
    biome_noise.seed = noise.seed + 1
    biome_noise.frequency = ${(freq / 4).toFixed(4)}  # broad biome regions

func _height_at(x: float, z: float) -> float:
    return noise.get_noise_2d(x, z) * height_scale

func _biome_at(x: float, z: float) -> int:
    # 0..${world.biomes.length - 1} => ${world.biomes.join(' / ')}
    var b := (biome_noise.get_noise_2d(x, z) + 1.0) * 0.5
    return clampi(int(b * ${world.biomes.length}), 0, ${world.biomes.length - 1})

func _generate_terrain() -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for z in world_size:
        for x in world_size:
            var h00 := _height_at(x, z)
            var h10 := _height_at(x + 1, z)
            var h01 := _height_at(x, z + 1)
            var h11 := _height_at(x + 1, z + 1)
            var c := _biome_color(_biome_at(x, z), h00)
            st.set_color(c)
            # two triangles per grid cell
            st.add_vertex(Vector3(x, h00, z))
            st.add_vertex(Vector3(x + 1, h10, z))
            st.add_vertex(Vector3(x, h01, z + 1))
            st.add_vertex(Vector3(x + 1, h10, z))
            st.add_vertex(Vector3(x + 1, h11, z + 1))
            st.add_vertex(Vector3(x, h01, z + 1))
    st.generate_normals()
    var mesh_instance := MeshInstance3D.new()
    mesh_instance.mesh = st.commit()
    var mat := StandardMaterial3D.new()
    mat.vertex_color_use_as_albedo = true
    mesh_instance.material_override = mat
    mesh_instance.create_trimesh_collision()
    add_child(mesh_instance)

func _biome_color(biome: int, h: float) -> Color:
    var base: Color
    match biome:
${world.biomes.map((b, i) => `        ${i}: base = Color(${(0.2 + i * 0.15).toFixed(2)}, ${(0.5 - i * 0.1).toFixed(2)}, ${(0.25 + i * 0.05).toFixed(2)})  # ${b}`).join('\n')}
        _: base = Color(0.4, 0.4, 0.4)
    # lighten with altitude
    return base.lerp(Color.WHITE, clampf(h / height_scale, 0.0, 0.6))

func _scatter_props() -> void:
    # MultiMesh scatter — swap the box for your tree/rock/prop scene
    var mm := MultiMesh.new()
    mm.transform_format = MultiMesh.TRANSFORM_3D
    var box := BoxMesh.new()
    box.size = Vector3(0.6, 2.0, 0.6)
    mm.mesh = box
    mm.instance_count = prop_count
    for i in prop_count:
        var x := randf() * world_size
        var z := randf() * world_size
        var t := Transform3D(Basis().rotated(Vector3.UP, randf() * TAU), Vector3(x, _height_at(x, z) + 1.0, z))
        mm.set_instance_transform(i, t)
    var mmi := MultiMeshInstance3D.new()
    mmi.multimesh = mm
    add_child(mmi)

func _setup_lighting() -> void:
    # ${world.features.join(', ')}
    var light := DirectionalLight3D.new()
    light.rotation_degrees = Vector3(-50, -30, 0)
    light.shadow_enabled = true
    add_child(light)
    var env := WorldEnvironment.new()
    var e := Environment.new()
    e.background_mode = Environment.BG_SKY
    e.sky = Sky.new()
    e.sky.sky_material = ProceduralSkyMaterial.new()
    e.fog_enabled = true
    e.fog_density = ${complexity === 'complex' ? '0.005' : '0.002'}
    env.environment = e
    add_child(env)

func _spawn_player() -> void:
    var spawn := Marker3D.new()
    spawn.name = "PlayerSpawn"
    var cx := world_size * 0.5
    spawn.position = Vector3(cx, _height_at(cx, cx) + 2.0, cx)
    add_child(spawn)
`;
  }

  if (engine === 'unity') {
    return `using UnityEngine;

// ${world.name} — Unity procedural world
// Size: ${size} (${dim}x${dim}) | Complexity: ${complexity}
// Biomes: ${world.biomes.join(', ')}
[RequireComponent(typeof(MeshFilter), typeof(MeshRenderer), typeof(MeshCollider))]
public class WorldGenerator : MonoBehaviour
{
    [Header("World Settings")]
    public int worldSize = ${dim};
    public float heightScale = ${heightScale}f;
    public int propCount = ${propCount};

    [Header("Noise Settings")]
    public float noiseScale = ${freq}f;
    public int octaves = ${octaves};

    [Header("Props")]
    public GameObject propPrefab; // assign a tree/rock prefab; falls back to cubes

    private float seedX, seedZ;

    void Start()
    {
        seedX = Random.Range(0f, 9999f);
        seedZ = Random.Range(0f, 9999f);
        GenerateTerrain();
        ScatterProps();
        SetupLighting();
    }

    float HeightAt(float x, float z)
    {
        float amp = 1f, f = noiseScale, h = 0f, norm = 0f;
        for (int o = 0; o < octaves; o++)
        {
            h += Mathf.PerlinNoise(seedX + x * f, seedZ + z * f) * amp;
            norm += amp;
            amp *= 0.5f; f *= 2f;
        }
        return (h / norm) * heightScale;
    }

    int BiomeAt(float x, float z)
    {
        float b = Mathf.PerlinNoise(seedX + x * noiseScale * 0.25f, seedZ + z * noiseScale * 0.25f);
        return Mathf.Clamp((int)(b * ${world.biomes.length}), 0, ${world.biomes.length - 1});
    }

    Color BiomeColor(int biome, float h)
    {
        // ${world.biomes.join(' / ')}
        Color[] bases = {
${world.biomes.map((b, i) => `            new Color(${(0.2 + i * 0.15).toFixed(2)}f, ${(0.5 - i * 0.1).toFixed(2)}f, ${(0.25 + i * 0.05).toFixed(2)}f), // ${b}`).join('\n')}
        };
        return Color.Lerp(bases[biome], Color.white, Mathf.Clamp01(h / heightScale) * 0.6f);
    }

    void GenerateTerrain()
    {
        var verts = new Vector3[(worldSize + 1) * (worldSize + 1)];
        var colors = new Color[verts.Length];
        var tris = new int[worldSize * worldSize * 6];

        for (int z = 0, i = 0; z <= worldSize; z++)
            for (int x = 0; x <= worldSize; x++, i++)
            {
                float h = HeightAt(x, z);
                verts[i] = new Vector3(x, h, z);
                colors[i] = BiomeColor(BiomeAt(x, z), h);
            }

        for (int z = 0, t = 0, v = 0; z < worldSize; z++, v++)
            for (int x = 0; x < worldSize; x++, v++, t += 6)
            {
                tris[t] = v; tris[t + 1] = v + worldSize + 1; tris[t + 2] = v + 1;
                tris[t + 3] = v + 1; tris[t + 4] = v + worldSize + 1; tris[t + 5] = v + worldSize + 2;
            }

        var mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
        mesh.vertices = verts; mesh.colors = colors; mesh.triangles = tris;
        mesh.RecalculateNormals();
        GetComponent<MeshFilter>().mesh = mesh;
        GetComponent<MeshCollider>().sharedMesh = mesh;
        // Use a vertex-color shader (URP: create one via Shader Graph) on the renderer material.
    }

    void ScatterProps()
    {
        var parent = new GameObject("Props").transform;
        parent.SetParent(transform, false);
        for (int i = 0; i < propCount; i++)
        {
            float x = Random.Range(0f, worldSize);
            float z = Random.Range(0f, worldSize);
            var pos = new Vector3(x, HeightAt(x, z), z);
            var rot = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
            if (propPrefab != null) Instantiate(propPrefab, pos, rot, parent);
            else
            {
                var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                cube.transform.SetPositionAndRotation(pos + Vector3.up, rot);
                cube.transform.localScale = new Vector3(0.6f, 2f, 0.6f);
                cube.transform.SetParent(parent, true);
            }
        }
    }

    void SetupLighting()
    {
        // ${world.features.join(', ')}
        var lightGO = new GameObject("Sun");
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Directional;
        light.shadows = LightShadows.Soft;
        lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        RenderSettings.fog = ${complexity === 'complex' ? 'true' : 'false'};
        RenderSettings.fogDensity = 0.005f;
    }
}
`;
  }

  // Unreal Engine 5 (and default): complete C++ actor
  return `// ${world.name} — Unreal Engine 5 procedural world
// Size: ${size} (${dim}x${dim}) | Complexity: ${complexity}
// Biomes: ${world.biomes.join(', ')}
// Requires the ProceduralMeshComponent module (add "ProceduralMeshComponent" to Build.cs).

#include "WorldGenerator.h"
#include "ProceduralMeshComponent.h"
#include "Kismet/KismetMathLibrary.h"

AWorldGenerator::AWorldGenerator()
{
    PrimaryActorTick.bCanEverTick = false;
    Mesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("TerrainMesh"));
    RootComponent = Mesh;
    WorldSize = ${dim};
    HeightScale = ${heightScale}.f;
    NoiseScale = ${freq}f;
    PropCount = ${propCount};
}

float AWorldGenerator::HeightAt(float X, float Y) const
{
    float Amp = 1.f, Freq = NoiseScale, H = 0.f, Norm = 0.f;
    for (int32 O = 0; O < ${octaves}; ++O)
    {
        H += FMath::PerlinNoise2D(FVector2D(X * Freq, Y * Freq)) * Amp;
        Norm += Amp; Amp *= 0.5f; Freq *= 2.f;
    }
    return (H / Norm) * HeightScale;
}

void AWorldGenerator::BeginPlay()
{
    Super::BeginPlay();
    TArray<FVector> Vertices;
    TArray<int32> Triangles;
    TArray<FVector> Normals;
    TArray<FVector2D> UVs;
    TArray<FLinearColor> Colors;
    TArray<FProcMeshTangent> Tangents;

    for (int32 Y = 0; Y <= WorldSize; ++Y)
        for (int32 X = 0; X <= WorldSize; ++X)
        {
            const float H = HeightAt(X, Y);
            Vertices.Add(FVector(X * 100.f, Y * 100.f, H * 100.f)); // cm units
            UVs.Add(FVector2D(X, Y));
            const float T = FMath::Clamp(H / HeightScale, 0.f, 1.f);
            Colors.Add(FLinearColor::LerpUsingHSV(FLinearColor(0.2f, 0.5f, 0.25f), FLinearColor::White, T * 0.6f));
        }

    for (int32 Y = 0; Y < WorldSize; ++Y)
        for (int32 X = 0; X < WorldSize; ++X)
        {
            const int32 I = Y * (WorldSize + 1) + X;
            Triangles.Append({ I, I + WorldSize + 1, I + 1, I + 1, I + WorldSize + 1, I + WorldSize + 2 });
        }

    Mesh->CreateMeshSection_LinearColor(0, Vertices, Triangles, Normals, UVs, Colors, Tangents, true);

    // Scatter props (swap for your foliage/ISM setup — features: ${world.features.join(', ')})
    for (int32 i = 0; i < PropCount; ++i)
    {
        const float X = FMath::FRandRange(0.f, (float)WorldSize);
        const float Y = FMath::FRandRange(0.f, (float)WorldSize);
        const FVector Loc(X * 100.f, Y * 100.f, HeightAt(X, Y) * 100.f + 100.f);
        // SpawnActor<AYourPropActor>(Loc, FRotator(0, FMath::FRandRange(0.f, 360.f), 0));
    }
}
`;
}

function generatePlaceholder(engine, assetType) {
  const asset = ASSET_TYPES.find(a => a.id === assetType);
  const label = asset?.label || 'Game Asset';
  const className = label.replace(/[^a-zA-Z0-9]/g, '');

  // Fully-implemented character controller per engine — the most-requested asset
  if (assetType === 'character-controller') {
    if (engine === 'godot') {
      return `# Character Controller — Godot 4
extends CharacterBody3D

@export var speed: float = 5.5
@export var sprint_speed: float = 8.5
@export var jump_velocity: float = 4.8
@export var mouse_sensitivity: float = 0.002

@onready var camera: Camera3D = $Camera3D

func _ready() -> void:
    Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseMotion:
        rotate_y(-event.relative.x * mouse_sensitivity)
        camera.rotate_x(-event.relative.y * mouse_sensitivity)
        camera.rotation.x = clampf(camera.rotation.x, -1.4, 1.4)
    if event.is_action_pressed("ui_cancel"):
        Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _physics_process(delta: float) -> void:
    if not is_on_floor():
        velocity += get_gravity() * delta
    if Input.is_action_just_pressed("ui_accept") and is_on_floor():
        velocity.y = jump_velocity

    var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
    var current_speed := sprint_speed if Input.is_action_pressed("sprint") else speed
    if direction:
        velocity.x = direction.x * current_speed
        velocity.z = direction.z * current_speed
    else:
        velocity.x = move_toward(velocity.x, 0, current_speed)
        velocity.z = move_toward(velocity.z, 0, current_speed)
    move_and_slide()
`;
    }
    if (engine === 'unity') {
      return `using UnityEngine;

// Character Controller — Unity (attach to a capsule with a CharacterController component)
[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    [Header("Movement")]
    public float speed = 5.5f;
    public float sprintSpeed = 8.5f;
    public float jumpHeight = 1.4f;
    public float gravity = -19.6f;

    [Header("Look")]
    public Transform cameraTransform;
    public float mouseSensitivity = 2f;

    private CharacterController controller;
    private Vector3 velocity;
    private float pitch;

    void Start()
    {
        controller = GetComponent<CharacterController>();
        Cursor.lockState = CursorLockMode.Locked;
    }

    void Update()
    {
        // Look
        float mx = Input.GetAxis("Mouse X") * mouseSensitivity;
        float my = Input.GetAxis("Mouse Y") * mouseSensitivity;
        transform.Rotate(Vector3.up * mx);
        pitch = Mathf.Clamp(pitch - my, -80f, 80f);
        if (cameraTransform) cameraTransform.localEulerAngles = new Vector3(pitch, 0, 0);

        // Move
        bool grounded = controller.isGrounded;
        if (grounded && velocity.y < 0) velocity.y = -2f;
        Vector3 move = transform.right * Input.GetAxis("Horizontal") + transform.forward * Input.GetAxis("Vertical");
        float s = Input.GetKey(KeyCode.LeftShift) ? sprintSpeed : speed;
        controller.Move(move * s * Time.deltaTime);
        if (grounded && Input.GetButtonDown("Jump"))
            velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
        velocity.y += gravity * Time.deltaTime;
        controller.Move(velocity * Time.deltaTime);
    }
}
`;
    }
  }

  // Structured, compilable skeleton for everything else
  const lang = engine === 'godot' ? 'gdscript' : engine === 'unity' ? 'csharp' : 'cpp';
  if (lang === 'gdscript') {
    return `# ${label} — Godot 4 scaffold
# ${asset?.desc || ''}
# Complexity: ${asset?.complexity || 'unknown'}
extends Node

signal ${className.toLowerCase()}_ready

func _ready() -> void:
    _initialize()
    ${className.toLowerCase()}_ready.emit()

func _initialize() -> void:
    # Core setup for: ${asset?.desc || label}
    pass

# Connect an AI provider in Dojo settings for a complete,
# production-ready implementation generated to your spec.
`;
  }
  if (lang === 'csharp') {
    return `using UnityEngine;

/// <summary>
/// ${label} — ${asset?.desc || ''}
/// Complexity: ${asset?.complexity || 'unknown'}
/// </summary>
public class ${className} : MonoBehaviour
{
    void Awake()
    {
        Initialize();
    }

    void Initialize()
    {
        // Core setup for: ${asset?.desc || label}
    }

    // Connect an AI provider in Dojo settings for a complete,
    // production-ready implementation generated to your spec.
}
`;
  }
  return `// ${label} — Unreal Engine 5 scaffold
// ${asset?.desc || ''}
// Complexity: ${asset?.complexity || 'unknown'}

#include "${className}.h"

A${className}::A${className}()
{
    PrimaryActorTick.bCanEverTick = false;
}

void A${className}::BeginPlay()
{
    Super::BeginPlay();
    // Core setup for: ${asset?.desc || label}
}

// Connect an AI provider in Dojo settings for a complete,
// production-ready implementation generated to your spec.
`;
}
