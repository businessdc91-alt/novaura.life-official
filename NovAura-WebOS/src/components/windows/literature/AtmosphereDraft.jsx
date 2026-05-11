import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Wand2, Send, Zap, Brain, History, Settings2, X } from 'lucide-react';
import RichEditor from './RichEditor';
import { BACKEND_URL } from '../../../services/aiService';
import { kernelStorage } from '../../../kernel/kernelStorage.js';
import axios from 'axios';

export default function AtmosphereDraft({ 
  content, 
  onContentChange, 
  settings,
  storyBible,
  onVisualContextChange
}) {
  const [prompt, setPrompt] = useState('');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState('Neutral');

  const handleAiCommand = async (commandPrompt) => {
    if (!commandPrompt && !prompt) return;
    setLoading(true);
    
    const finalPrompt = commandPrompt || prompt;
    
    try {
      const token = kernelStorage.getItem('auth_token');
      const res = await axios.post(`${BACKEND_URL}/ai/chat`, {
        provider: 'gemini',
        prompt: `Act as a world-class literary co-writer. 
                 Current Mood: ${mood}
                 Context: ${content.substring(Math.max(0, content.length - 2000))}
                 Request: ${finalPrompt}
                 
                 Provide your response in two parts:
                 1. "DRAFT": A continuation or rewrite of the prose.
                 2. "THOUGHTS": Your reasoning or suggestions for the story direction.`,
        temperature: 0.8,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const responseText = res.data.content;
      setAiSuggestions(prev => [{
        id: Date.now(),
        text: responseText,
        type: 'response'
      }, ...prev]);
      
      setPrompt('');
    } catch (err) {
      console.error("AI Draft Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const insertSuggestion = (text) => {
    // Extract DRAFT part if exists
    const draftMatch = text.match(/DRAFT:([\s\S]*?)(?=THOUGHTS:|$)/i);
    const contentToInsert = draftMatch ? draftMatch[1].trim() : text;
    
    onContentChange(content + "\n" + contentToInsert);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#050510]">
      {/* Main Editor Section */}
      <div className={`flex-1 flex flex-col transition-all duration-500 ${isAiPanelOpen ? 'mr-0' : ''}`}>
        <div className="flex-1 flex justify-center overflow-hidden">
          <RichEditor 
            content={content}
            onContentChange={onContentChange}
            settings={settings}
            onVisualContextChange={onVisualContextChange}
            tabs={[]} // Standalone mode
            activeTabId="atmosphere"
            hideToolbar={false}
          />
        </div>

        {/* Bottom Floating Command Bar */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
          <div className="glass-panel p-2 rounded-2xl flex items-center gap-3 border border-white/10 shadow-2xl">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <input 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiCommand()}
              placeholder="Ask Atmosphere AI to draft, describe, or twist..." 
              className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-gray-500"
            />
            <button 
              onClick={() => handleAiCommand()}
              disabled={loading}
              className="p-2 bg-primary hover:bg-primary-dark rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? <Zap className="w-4 h-4 text-white animate-pulse" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Side AI Intelligence Panel */}
      {isAiPanelOpen && (
        <div className="w-80 bg-[#0a0a1a] border-l border-white/5 flex flex-col animate-in slide-in-from-right-full duration-300">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-primary" />
              Intelligence
            </h3>
            <button onClick={() => setIsAiPanelOpen(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase">Current Atmosphere</label>
              <div className="grid grid-cols-2 gap-2">
                {['Tense', 'Melancholy', 'Epic', 'Whimsical'].map(m => (
                  <button 
                    key={m}
                    onClick={() => setMood(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${mood === m ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
            {aiSuggestions.length === 0 && (
              <div className="text-center py-10">
                <Wand2 className="w-8 h-8 text-gray-700 mx-auto mb-3 opacity-20" />
                <p className="text-gray-600 text-xs italic">No interactions yet. Ask something below.</p>
              </div>
            )}
            {aiSuggestions.map((sig) => (
              <div key={sig.id} className="glass-panel p-3 rounded-xl space-y-3 animate-in fade-in zoom-in-95">
                <div className="text-[11px] text-gray-300 line-clamp-6 italic leading-relaxed whitespace-pre-wrap">
                  {sig.text}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => insertSuggestion(sig.text)}
                    className="flex-1 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <History className="w-3 h-3" /> Insert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle to open lateral panel if closed */}
      {!isAiPanelOpen && (
        <button 
          onClick={() => setIsAiPanelOpen(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 glass-panel rounded-full text-gray-500 hover:text-white z-50"
        >
          <History className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
