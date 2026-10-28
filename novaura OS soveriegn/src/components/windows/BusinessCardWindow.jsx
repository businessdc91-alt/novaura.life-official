import React, { useState } from 'react';
import {
  CreditCard, Download, Palette, Type, Eye, RotateCcw,
  Sparkles, Save, Check, QrCode
} from 'lucide-react';
import { saveFile } from '../../services/fileStorageService.js';

const TEMPLATES = [
  { id: 'cosmic', name: 'Cosmic Holo', bg: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0369a1 100%)', text: '#ffffff', accent: '#38bdf8', border: '#38bdf840' },
  { id: 'carbon', name: 'Executive Carbon', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', text: '#f8fafc', accent: '#94a3b8', border: '#475569' },
  { id: 'gold', name: 'Obsidian Gold', bg: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)', text: '#fef08a', accent: '#eab308', border: '#eab30850' },
  { id: 'neon', name: 'Cyberpunk Neon', bg: 'linear-gradient(135deg, #050510 0%, #2e0854 100%)', text: '#ffffff', accent: '#f43f5e', border: '#f43f5e50' },
  { id: 'minimal', name: 'Clean Titanium', bg: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)', text: '#f4f4f5', accent: '#22c55e', border: '#22c55e40' },
];

export default function BusinessCardWindow() {
  const [card, setCard] = useState({
    name: 'Sovereign Operator',
    title: 'Autonomous System Architect',
    company: 'NovAura Life Inc.',
    email: 'operator@novaura.life',
    phone: '+1 (555) 789-2048',
    website: 'https://novaura.life',
    tagline: 'Decentralized Sovereign Intelligence',
  });
  const [templateId, setTemplateId] = useState('cosmic');
  const [flipped, setFlipped] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

  const update = (key, val) => setCard(prev => ({ ...prev, [key]: val }));

  const exportVCard = () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${card.name}
ORG:${card.company}
TITLE:${card.title}
EMAIL:${card.email}
TEL:${card.phone}
URL:${card.website}
NOTE:${card.tagline}
END:VCARD`;

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${card.name.replace(/\s+/g, '_')}_contact.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToFiles = async () => {
    const cardData = JSON.stringify({ card, templateId }, null, 2);
    await saveFile(`/documents/${card.name.replace(/\s+/g, '_')}_card.json`, cardData, 'application/json');
    setSaveNotice('Card saved to Sovereign Files.');
    setTimeout(() => setSaveNotice(''), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-12 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-xs">Business Card Architect</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFlipped(!flipped)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Flip Card</span>
          </button>

          <button
            onClick={handleSaveToFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save</span>
          </button>

          <button
            onClick={exportVCard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export vCard</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/60 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Controls */}
        <div className="w-80 border-r border-slate-800 p-4 space-y-4 overflow-y-auto shrink-0">
          {/* Template Chooser */}
          <div>
            <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1.5">Theme Finish</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all ${
                    templateId === t.id
                      ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            {[
              { key: 'name', label: 'Full Name' },
              { key: 'title', label: 'Title / Profession' },
              { key: 'company', label: 'Organization' },
              { key: 'email', label: 'Email Address' },
              { key: 'phone', label: 'Phone Number' },
              { key: 'website', label: 'Website URL' },
              { key: 'tagline', label: 'Tagline / Bio' },
            ].map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-[10px] text-slate-400 font-medium block uppercase">{field.label}</label>
                <input
                  type="text"
                  value={card[field.key]}
                  onChange={(e) => update(field.key, e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: 3D Live Interactive Card Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-900/30 relative">
          <div style={{ perspective: '1200px' }}>
            <div
              className="w-[460px] h-[260px] rounded-2xl shadow-2xl relative transition-transform duration-700 cursor-pointer"
              style={{
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
              onClick={() => setFlipped(!flipped)}
            >
              {/* FRONT */}
              <div
                className="absolute inset-0 rounded-2xl p-7 flex flex-col justify-between border"
                style={{
                  background: template.bg,
                  color: template.text,
                  borderColor: template.border,
                  backfaceVisibility: 'hidden',
                  boxShadow: `0 20px 50px rgba(0,0,0,0.5)`,
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono tracking-widest uppercase opacity-70">IDENTITY</span>
                    <h2 className="text-xl font-bold tracking-tight mt-0.5">{card.name}</h2>
                    <p className="text-xs font-medium" style={{ color: template.accent }}>{card.title}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: template.accent }}>
                    <Sparkles className="w-4 h-4" style={{ color: template.accent }} />
                  </div>
                </div>

                <div className="space-y-1 text-xs opacity-90 font-mono">
                  <div>{card.company}</div>
                  <div>{card.email}</div>
                  <div>{card.phone}</div>
                </div>

                <div className="flex justify-between items-end border-t pt-2.5 opacity-80 text-[11px]" style={{ borderColor: template.border }}>
                  <span>{card.tagline}</span>
                  <span className="font-mono">{card.website}</span>
                </div>
              </div>

              {/* BACK */}
              <div
                className="absolute inset-0 rounded-2xl p-7 flex flex-col items-center justify-center border text-center"
                style={{
                  background: template.bg,
                  color: template.text,
                  borderColor: template.border,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  boxShadow: `0 20px 50px rgba(0,0,0,0.5)`,
                }}
              >
                <div className="w-20 h-20 bg-white/10 rounded-xl p-2.5 flex items-center justify-center mb-3 border" style={{ borderColor: template.accent }}>
                  <QrCode className="w-full h-full" style={{ color: template.accent }} />
                </div>
                <h3 className="text-sm font-bold tracking-wide uppercase">{card.company}</h3>
                <p className="text-xs font-mono mt-1 opacity-80" style={{ color: template.accent }}>{card.website}</p>
                <p className="text-[10px] opacity-60 mt-3 font-mono">Scan or tap to connect via Sovereign P2P Mesh</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
