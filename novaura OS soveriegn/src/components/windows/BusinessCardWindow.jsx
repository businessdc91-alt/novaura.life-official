// BusinessCardWindow.jsx — 300 DPI Business Card Architect Pro
// Supports 8 luxury finishes, live 3D flip preview with real scannable ISO QR code,
// custom logo upload, 300 DPI Front/Back PNG (+1/8" bleed option), 10-Up US Letter cut sheet,
// vCard (.vcf) export, Sovereign Files save, and Creative Studio handoff.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CreditCard, Download, RotateCcw, Sparkles, Save, Check, Upload,
  Printer, Palette, Layers, Gift, X
} from 'lucide-react';
import { saveFile } from '../../services/fileStorageService.js';
import {
  BUSINESS_CARD_STYLES,
  renderBusinessCardSide,
  renderBusinessTenUpSheet,
  downloadCanvasPng,
} from '../../services/print/printEngine.js';
import { qrMatrixToSvgDataUrl } from '../../services/print/qrEncoder.js';
import { sendImageToCreativeStudio } from '../../services/media/creativeBridge.js';

export default function BusinessCardWindow({ props: windowProps } = {}) {
  const [card, setCard] = useState({
    name: 'Sovereign Operator',
    title: 'Autonomous System Architect',
    company: 'NovAura Life Inc.',
    email: 'operator@novaura.life',
    phone: '+1 (555) 789-2048',
    website: 'https://novaura.life',
    tagline: 'Decentralized Sovereign Intelligence',
    qrValue: '',
    logoUrl: windowProps?.logoUrl || '',
  });
  const [templateId, setTemplateId] = useState('cosmic');
  const [bleedMode, setBleedMode] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const logoInputRef = useRef(null);

  const template = useMemo(
    () => BUSINESS_CARD_STYLES.find(t => t.id === templateId) || BUSINESS_CARD_STYLES[0],
    [templateId]
  );

  const qrTarget = card.qrValue.trim() || card.website.trim() || `MECARD:N:${card.name};EMAIL:${card.email};TEL:${card.phone};;`;
  const qrSvgUrl = useMemo(() => qrMatrixToSvgDataUrl(qrTarget, { dark: '#0f172a', light: '#ffffff', quiet: 2 }), [qrTarget]);

  const flashNotice = (msg) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(prev => (prev === msg ? '' : prev)), 3500);
  };

  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId !== 'card_creator') return;
      if (e.detail.props?.logoUrl) {
        setCard(prev => ({ ...prev, logoUrl: e.detail.props.logoUrl }));
        flashNotice('Loaded badge/logo from Media Foundry!');
      }
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, []);

  const update = (key, val) => setCard(prev => ({ ...prev, [key]: val }));

  const handleUploadLogo = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      update('logoUrl', String(reader.result || ''));
      flashNotice(`Loaded logo "${file.name}"!`);
    };
    reader.readAsDataURL(file);
  };

  const exportVCard = () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${card.name}\nORG:${card.company}\nTITLE:${card.title}\nEMAIL:${card.email}\nTEL:${card.phone}\nURL:${card.website}\nNOTE:${card.tagline}\nEND:VCARD`;
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
    flashNotice('Card saved to Sovereign Files.');
  };

  const handleExportPng = async (side) => {
    const canvas = document.createElement('canvas');
    await renderBusinessCardSide(canvas, { ...card, templateId }, side, { bleed: bleedMode, cropMarks: bleedMode });
    const slug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'business_card';
    downloadCanvasPng(canvas, `${slug}_${side}_300dpi${bleedMode ? '_bleed' : ''}.png`);
    flashNotice(`Exported 300 DPI ${side.toUpperCase()} PNG (${bleedMode ? '1125×675 w/ bleed' : '1050×600'})!`);
  };

  const handleExportTenUp = async () => {
    const side = flipped ? 'back' : 'front';
    const canvas = document.createElement('canvas');
    await renderBusinessTenUpSheet(canvas, { ...card, templateId }, side);
    const slug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'business_card';
    downloadCanvasPng(canvas, `${slug}_10up_letter_${side}_300dpi.png`);
    flashNotice(`Exported 10-Up US Letter (${side.toUpperCase()}, 2550×3300 @ 300 DPI) cut sheet!`);
  };

  const handleEditInCreativeStudio = async () => {
    const side = flipped ? 'back' : 'front';
    const canvas = document.createElement('canvas');
    await renderBusinessCardSide(canvas, { ...card, templateId }, side, { bleed: false, cropMarks: false });
    sendImageToCreativeStudio({
      imageUrl: canvas.toDataURL('image/png'),
      title: `${card.name}_business_${side}`,
    });
    flashNotice('Opened 300 DPI business card in Creative Studio!');
  };

  const cardBgCss = `linear-gradient(135deg, ${template.bg[0]} 0%, ${template.bg[1]} 50%, ${template.bg[2]} 100%)`;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-12 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <CreditCard className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-xs">Business Card Pro</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            300 DPI + Live QR
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'card_forge', toggle: false } }))}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-[11px] border border-slate-700 cursor-pointer"
          >
            <Layers className="w-3 h-3" /> TCG Cards
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'greeting_card', toggle: false } }))}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-pink-300 rounded-lg text-[11px] border border-slate-700 cursor-pointer"
          >
            <Gift className="w-3 h-3" /> Greeting Cards
          </button>
          <button
            onClick={() => setFlipped(!flipped)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{flipped ? 'Show Front' : 'Flip to QR Back'}</span>
          </button>
          <button
            onClick={handleSaveToFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save</span>
          </button>
          <button
            onClick={exportVCard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>vCard</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/70 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Controls */}
        <div className="w-80 border-r border-slate-800 p-4 space-y-4 overflow-y-auto shrink-0 bg-slate-900/40">
          {/* Template Chooser */}
          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold block mb-1.5">Cardstock Finish (8 Styles)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {BUSINESS_CARD_STYLES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`p-2 rounded-lg text-left text-[11px] font-medium border flex items-center gap-1.5 cursor-pointer transition-all ${
                    templateId === t.id
                      ? 'border-cyan-500 bg-cyan-950/30 text-cyan-200 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0 border border-white/25" style={{ background: t.accent }} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Logo / Badge Upload */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-200">Brand Logo / Badge</span>
              {card.logoUrl && (
                <button type="button" onClick={() => update('logoUrl', '')} className="text-[10px] text-rose-400 flex items-center gap-0.5 cursor-pointer">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadLogo(e.target.files[0])} />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>{card.logoUrl ? 'Replace Logo Image' : 'Upload Logo / Avatar PNG'}</span>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-2.5">
            {[
              { key: 'name', label: 'Full Name' },
              { key: 'title', label: 'Title / Profession' },
              { key: 'company', label: 'Organization' },
              { key: 'email', label: 'Email Address' },
              { key: 'phone', label: 'Phone Number' },
              { key: 'website', label: 'Website URL' },
              { key: 'tagline', label: 'Tagline / Bio' },
              { key: 'qrValue', label: 'Custom QR Target (Defaults to Website)' },
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

        {/* Right: 3D Live Interactive Card Canvas + 300 DPI Print Exports */}
        <div className="flex-1 flex flex-col items-center justify-between p-8 bg-slate-900/30 relative overflow-y-auto gap-6">
          <div className="w-full flex items-center justify-between text-xs text-slate-400">
            <span>Standard US 3.5&quot; × 2.0&quot; ({bleedMode ? '1125×675 w/ 1/8" bleed' : '1050×600 @ 300 DPI'})</span>
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input type="checkbox" checked={bleedMode} onChange={(e) => setBleedMode(e.target.checked)} className="accent-cyan-400" />
              Include 1/8&quot; Print Bleed &amp; Crop Marks
            </label>
          </div>

          <div style={{ perspective: '1200px' }} className="my-auto">
            <div
              className="w-[460px] h-[263px] rounded-2xl shadow-2xl relative transition-transform duration-700 cursor-pointer"
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
                  background: cardBgCss,
                  color: template.text,
                  borderColor: template.border + '66',
                  backfaceVisibility: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
                }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: template.accent }}>{card.company}</span>
                    <h2 className="text-xl font-bold tracking-tight mt-0.5 truncate">{card.name}</h2>
                    <p className="text-xs font-medium truncate" style={{ color: template.accent }}>{card.title}</p>
                  </div>
                  {card.logoUrl ? (
                    <img src={card.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border shrink-0" style={{ borderColor: template.accent }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: template.accent }}>
                      <Sparkles className="w-4 h-4" style={{ color: template.accent }} />
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-xs opacity-90 font-mono">
                  <div>{card.email}</div>
                  <div>{card.phone}</div>
                </div>

                <div className="flex justify-between items-end border-t pt-2.5 opacity-85 text-[11px]" style={{ borderColor: template.border + '55' }}>
                  <span className="truncate max-w-[230px] italic">{card.tagline}</span>
                  <span className="font-mono">{card.website}</span>
                </div>
              </div>

              {/* BACK (WITH GENUINE SCANNABLE ISO QR CODE) */}
              <div
                className="absolute inset-0 rounded-2xl p-6 flex flex-col items-center justify-center border text-center"
                style={{
                  background: cardBgCss,
                  color: template.text,
                  borderColor: template.border + '66',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
                }}
              >
                <div className="w-24 h-24 bg-white rounded-xl p-1.5 flex items-center justify-center mb-2.5 shadow-lg">
                  <img src={qrSvgUrl} alt="Scannable QR Code" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-sm font-bold tracking-wide uppercase">{card.company}</h3>
                <p className="text-xs font-mono mt-0.5 opacity-90" style={{ color: template.accent }}>{card.website}</p>
                <p className="text-[10px] opacity-65 mt-1 font-mono">Real Scannable QR • Tap card to flip</p>
              </div>
            </div>
          </div>

          {/* 300 DPI Print House Export Bar */}
          <div className="w-full max-w-2xl p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">300 DPI Print Exports (Print-Shop &amp; Home Cardstock Ready)</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExportPng('front')}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Front 300 DPI PNG
              </button>
              <button
                type="button"
                onClick={() => handleExportPng('back')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Back + QR 300 DPI PNG
              </button>
              <button
                type="button"
                onClick={handleExportTenUp}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> 10-Up US Letter Sheet ({flipped ? 'Back' : 'Front'})
              </button>
              <button
                type="button"
                onClick={handleEditInCreativeStudio}
                className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" /> Edit in Creative Studio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
