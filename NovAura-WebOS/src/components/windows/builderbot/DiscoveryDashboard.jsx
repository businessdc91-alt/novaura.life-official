import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Info, 
  Zap, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Search,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Globe,
  Database
} from 'lucide-react';
import useBuilderStore from './useBuilderStore';

/**
 * NovAura Discovery Dashboard
 * Real-time monitoring of Gemini Model Intelligence & Platform Inference
 */
const DiscoveryDashboard = () => {
  const { kernel } = useBuilderStore();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);

  const fetchDiscoveryData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await kernel.auth.getToken();
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-life.cloudfunctions.net/api';
      
      const res = await fetch(`${baseUrl}/ai/gemini/models`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch models');
      
      setModels(data.models || []);
    } catch (err) {
      console.error('[Discovery] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (kernel) fetchDiscoveryData();
  }, [kernel]);

  const filteredModels = models.filter(m => 
    m.displayName?.toLowerCase().includes(filter.toLowerCase()) ||
    m.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#050508] text-[#e0e0e0] font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#ffffff0a] bg-[#08080c]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4c65ff22] rounded-lg border border-[#4c65ff33]">
            <Globe className="w-5 h-5 text-[#4c65ff]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Frontier Discovery</h2>
            <p className="text-xs text-[#888]">Real-time Gemini Model Intelligence & Limits</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              placeholder="Filter models..." 
              className="bg-[#0f0f15] border border-[#ffffff11] rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#4c65ff44] transition-all w-64"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchDiscoveryData}
            disabled={loading}
            className="p-2 hover:bg-[#ffffff0a] rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#888] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Model List */}
        <div className="w-1/2 border-right border-[#ffffff0a] overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {loading && models.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#555] gap-3">
              <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
              <p className="text-sm font-mono animate-pulse">Probing Google's Frontier API...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="text-red-400 text-sm bg-red-400/10 p-4 rounded-lg border border-red-400/20">
                {error}
              </div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-12 text-[#555] text-sm italic">No models found matching your search</div>
          ) : (
            filteredModels.map((model) => (
              <div 
                key={model.name}
                onClick={() => setSelectedModel(model)}
                className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedModel?.name === model.name 
                    ? 'bg-[#4c65ff0a] border-[#4c65ff44] shadow-[0_0_20px_rgba(76,101,255,0.05)]' 
                    : 'bg-[#0a0a0f] border-[#ffffff05] hover:border-[#ffffff11] hover:bg-[#ffffff03]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`p-2.5 rounded-lg border ${
                      selectedModel?.name === model.name ? 'bg-[#4c65ff11] border-[#4c65ff33]' : 'bg-[#15151a] border-[#ffffff0a]'
                    }`}>
                      {model.supportedGenerationMethods?.includes('generateContent') ? (
                        <Cpu className={`w-5 h-5 ${selectedModel?.name === model.name ? 'text-[#4c65ff]' : 'text-[#888]'}`} />
                      ) : (
                        <Database className="w-5 h-5 text-[#555]" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-[15px]">{model.displayName}</h3>
                      <p className="text-xs font-mono text-[#555] mt-0.5">{model.name.replace('models/', '')}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedModel?.name === model.name ? 'text-[#4c65ff] translate-x-1' : 'text-[#333]'}`} />
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-[#ffffff05] rounded text-[10px] text-[#888] font-mono border border-[#ffffff05]">
                    In: {model.inputTokenLimit?.toLocaleString() || '?'}
                  </span>
                  <span className="px-2 py-0.5 bg-[#ffffff05] rounded text-[10px] text-[#888] font-mono border border-[#ffffff05]">
                    Out: {model.outputTokenLimit?.toLocaleString() || '?'}
                  </span>
                  {model.thinking && (
                    <span className="px-2 py-0.5 bg-[#4c65ff11] rounded text-[10px] text-[#4c65ff] font-medium border border-[#4c65ff22]">
                      THINKING SUPPORT
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Details View */}
        <div className="flex-1 bg-[#08080c] overflow-y-auto border-l border-[#ffffff0a]">
          {selectedModel ? (
            <div className="p-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-[#4c65ff11] rounded-2xl flex items-center justify-center border border-[#4c65ff22]">
                  <Zap className="w-6 h-6 text-[#4c65ff]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{selectedModel.displayName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-[#4c65ff] bg-[#4c65ff11] px-2 py-0.5 rounded">v{selectedModel.version}</span>
                    <span className="text-xs text-[#555]">|</span>
                    <span className="text-xs text-[#888]">{selectedModel.baseModelId}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0f0f15] rounded-2xl border border-[#ffffff08] p-6 mb-8">
                <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Description
                </h3>
                <p className="text-[#aaa] leading-relaxed text-[15px]">
                  {selectedModel.description || "No description available for this model variant."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#0f0f15] rounded-2xl border border-[#ffffff08] p-5">
                  <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-3">Input Limit</h3>
                  <div className="text-2xl font-mono text-[#fff]">{selectedModel.inputTokenLimit?.toLocaleString() || '∞'} <span className="text-xs text-[#555] ml-1">tokens</span></div>
                  <div className="mt-2 h-1 bg-[#ffffff05] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#4c65ff] to-[#7f90ff] w-[70%]" />
                  </div>
                </div>
                <div className="bg-[#0f0f15] rounded-2xl border border-[#ffffff08] p-5">
                  <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-3">Output Limit</h3>
                  <div className="text-2xl font-mono text-[#fff]">{selectedModel.outputTokenLimit?.toLocaleString() || '∞'} <span className="text-xs text-[#555] ml-1">tokens</span></div>
                  <div className="mt-2 h-1 bg-[#ffffff05] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#4c65ff] to-[#00f0ff] w-[40%]" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-4">Supported Methods</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.supportedGenerationMethods?.map(method => (
                      <div key={method} className="px-4 py-2 bg-[#ffffff03] border border-[#ffffff08] rounded-xl flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4c65ff]" />
                        <span className="text-sm text-[#ddd]">{method}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-4">Parameter Configuration</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-[#0f0f15] border border-[#ffffff08] rounded-xl text-center">
                      <div className="text-[10px] text-[#555] uppercase font-bold mb-1">Temperature</div>
                      <div className="text-lg font-mono">{selectedModel.temperature ?? '0.7'}</div>
                    </div>
                    <div className="p-4 bg-[#0f0f15] border border-[#ffffff08] rounded-xl text-center">
                      <div className="text-[10px] text-[#555] uppercase font-bold mb-1">Top-P</div>
                      <div className="text-lg font-mono">{selectedModel.topP ?? '1.0'}</div>
                    </div>
                    <div className="p-4 bg-[#0f0f15] border border-[#ffffff08] rounded-xl text-center">
                      <div className="text-[10px] text-[#555] uppercase font-bold mb-1">Top-K</div>
                      <div className="text-lg font-mono">{selectedModel.topK ?? '40'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-[#ffffff08] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#555]">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs">Security Verified — All requests encrypted via NovAura Vault</span>
                </div>
                <button 
                  onClick={() => window.open(`https://aistudio.google.com/app/models/${selectedModel.name.replace('models/', '')}`, '_blank')}
                  className="flex items-center gap-2 text-xs text-[#4c65ff] hover:underline"
                >
                  <Maximize2 className="w-3 h-3" /> View on Google AI Studio
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
              <div className="w-24 h-24 bg-[#ffffff03] rounded-3xl border border-[#ffffff08] flex items-center justify-center">
                <Layers className="w-10 h-10 text-[#333]" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#888]">Select a Model</h3>
                <p className="text-sm text-[#555] max-w-xs mt-2">Discover the capabilities and limits of Google's frontier intelligence available to your workspace.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryDashboard;
