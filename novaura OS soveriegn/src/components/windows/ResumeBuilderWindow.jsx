import React, { useState } from 'react';
import {
  FileText, Sparkles, Download, Plus, Trash2, Check,
  Printer, Briefcase, GraduationCap, Wrench, Award, Eye, Save, Loader2
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { saveFile } from '../../services/fileStorageService.js';

export default function ResumeBuilderWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'preview'
  const [saveNotice, setSaveNotice] = useState('');
  const [enhancingIndex, setEnhancingIndex] = useState(null);

  const [resume, setResume] = useState({
    name: 'Alexandra Sterling',
    title: 'Lead Distributed Systems & AI Architect',
    email: 'alexandra@novaura.life',
    phone: '+1 (415) 890-3412',
    location: 'San Francisco, CA (Remote)',
    linkedin: 'linkedin.com/in/alex-sterling',
    github: 'github.com/alex-sterling',
    summary: 'Senior software architect with 9+ years engineering resilient, local-first operating systems, decentralized protocols, and autonomous AI agents. Passionate about privacy, high-throughput systems, and zero-compromise cryptographic architectures.',
    experiences: [
      {
        id: '1',
        role: 'Principal Systems Architect',
        company: 'NovAura Sovereign Labs',
        location: 'San Francisco, CA',
        period: '2023 – Present',
        bullets: [
          'Architected Sovereign OS: a decentralized, zero-cloud desktop operating system serving thousands of sovereign operators.',
          'Engineered dual-engine AI subsystem orchestrating local Ollama/LM Studio inference alongside cloud Gemini/Claude fallback.',
          'Reduced inter-process communication latency by 42% utilizing zero-copy message buffers and native Rust event channels.'
        ]
      },
      {
        id: '2',
        role: 'Senior Distributed Systems Engineer',
        company: 'Apex Computing',
        location: 'New York, NY',
        period: '2019 – 2023',
        bullets: [
          'Led design and rollout of multi-region Cassandra cluster handling 250M+ daily events with 99.999% availability.',
          'Mentored 12 engineers and standardized CI/CD pipelines reducing deployment failure rates from 6% to 0.2%.'
        ]
      }
    ],
    education: [
      {
        id: '1',
        degree: 'B.S. in Computer Science',
        institution: 'University of California, Berkeley',
        year: '2019',
        honors: 'Summa Cum Laude, Dean’s Honors'
      }
    ],
    skills: [
      'Rust', 'TypeScript / Node.js', 'Go', 'Distributed Databases', 'Local LLM Inference',
      'WebGPU / WebLLM', 'Tauri / Electron', 'Docker / Kubernetes', 'P2P Protocols', 'Cryptographic Proofs'
    ]
  });

  const updateField = (field, val) => setResume(prev => ({ ...prev, [field]: val }));

  const addExperience = () => {
    const newExp = {
      id: Date.now().toString(),
      role: 'Role Title',
      company: 'Organization Name',
      location: 'City, State',
      period: '2024 – Present',
      bullets: ['Describe your impact and achievements with quantifiable metrics.']
    };
    setResume(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
  };

  const removeExperience = (id) => {
    setResume(prev => ({ ...prev, experiences: prev.experiences.filter(e => e.id !== id) }));
  };

  const updateExperience = (id, key, val) => {
    setResume(prev => ({
      ...prev,
      experiences: prev.experiences.map(e => e.id === id ? { ...e, [key]: val } : e)
    }));
  };

  const updateBullet = (expId, bIdx, val) => {
    setResume(prev => ({
      ...prev,
      experiences: prev.experiences.map(e => {
        if (e.id !== expId) return e;
        const copy = [...e.bullets];
        copy[bIdx] = val;
        return { ...e, bullets: copy };
      })
    }));
  };

  const addBullet = (expId) => {
    setResume(prev => ({
      ...prev,
      experiences: prev.experiences.map(e => {
        if (e.id !== expId) return e;
        return { ...e, bullets: [...e.bullets, 'New impact achievement.'] };
      })
    }));
  };

  const enhanceBulletWithAI = async (expId, bIdx) => {
    const exp = resume.experiences.find(e => e.id === expId);
    if (!exp) return;
    const currentBullet = exp.bullets[bIdx];

    setEnhancingIndex(`${expId}-${bIdx}`);
    try {
      const response = await kernel?.ai?.chat([
        {
          role: 'system',
          content: 'You are an executive resume coach and ATS optimization specialist. Rewrite the user\'s bullet point to be high-impact, starting with a strong action verb, highlighting measurable results, and eliminating fluff. Return ONLY the single polished bullet point without quotes.'
        },
        { role: 'user', content: currentBullet }
      ], { persona: 'nova' });

      updateBullet(expId, bIdx, response.trim());
    } catch (err) {
      alert(`AI polish error: ${err.message}`);
    } finally {
      setEnhancingIndex(null);
    }
  };

  const handleSaveToFiles = async () => {
    const md = `# ${resume.name}
**${resume.title}**
${resume.email} | ${resume.phone} | ${resume.location}
${resume.linkedin} | ${resume.github}

## Professional Summary
${resume.summary}

## Experience
${resume.experiences.map(e => `### ${e.role} — ${e.company} (${e.period})
*${e.location}*
${e.bullets.map(b => `- ${b}`).join('\n')}`).join('\n\n')}

## Education
${resume.education.map(ed => `- **${ed.degree}**, ${ed.institution} (${ed.year}) — *${ed.honors}*`).join('\n')}

## Technical Skills
${resume.skills.join(', ')}
`;

    await saveFile(`/documents/${resume.name.replace(/\s+/g, '_')}_resume.md`, md, 'text/markdown');
    setSaveNotice('Resume saved to Sovereign Files (/documents).');
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Header */}
      <div className="h-12 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-xs">Executive Resume Architect (ATS-Ready)</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs mr-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'editor' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'preview' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Preview
            </button>
          </div>

          <button
            onClick={handleSaveToFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Save to Files</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-1.5 bg-emerald-950/60 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'editor' ? (
          <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto space-y-6">
            {/* Contact Header */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Candidate Coordinates</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={resume.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={resume.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Email</label>
                  <input
                    type="text"
                    value={resume.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={resume.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Executive Summary</h3>
              <textarea
                rows={3}
                value={resume.summary}
                onChange={(e) => updateField('summary', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500 leading-relaxed"
              />
            </div>

            {/* Work Experience */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Experience</h3>
                <button
                  onClick={addExperience}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Role</span>
                </button>
              </div>

              {resume.experiences.map((exp) => (
                <div key={exp.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="grid grid-cols-2 gap-2 flex-1 mr-3">
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => updateExperience(exp.id, 'role', e.target.value)}
                        placeholder="Role Title"
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-cyan-300 font-semibold"
                      />
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                        placeholder="Company"
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <button onClick={() => removeExperience(exp.id)} className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bullet Points */}
                  <div className="space-y-2 pl-2">
                    {exp.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        <input
                          type="text"
                          value={b}
                          onChange={(e) => updateBullet(exp.id, bIdx, e.target.value)}
                          className="flex-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={() => enhanceBulletWithAI(exp.id, bIdx)}
                          disabled={enhancingIndex === `${exp.id}-${bIdx}`}
                          className="p-1 hover:bg-slate-800 rounded text-cyan-400"
                          title="Enhance with AI"
                        >
                          {enhancingIndex === `${exp.id}-${bIdx}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addBullet(exp.id)}
                      className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3 h-3" /> Add bullet
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Technical Skills (Comma separated)</h3>
              <input
                type="text"
                value={resume.skills.join(', ')}
                onChange={(e) => updateField('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        ) : (
          /* Live Document Preview */
          <div className="flex-1 bg-slate-900/60 overflow-y-auto p-8 flex justify-center">
            <div className="w-[800px] min-h-[1050px] bg-white text-slate-900 shadow-2xl p-12 font-sans rounded-sm print:p-0 print:shadow-none print:w-full">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <h1 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight">{resume.name}</h1>
                <p className="text-sm font-semibold text-cyan-700 mt-1 uppercase tracking-wider">{resume.title}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-3 font-medium">
                  <span>{resume.email}</span>
                  <span>•</span>
                  <span>{resume.phone}</span>
                  <span>•</span>
                  <span>{resume.location}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b pb-1 mb-2">
                  Executive Profile
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed">{resume.summary}</p>
              </div>

              {/* Experience */}
              <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b pb-1 mb-3">
                  Professional Experience
                </h2>
                <div className="space-y-4">
                  {resume.experiences.map((exp) => (
                    <div key={exp.id}>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-900">{exp.role}</span>
                        <span className="text-[11px] font-semibold text-slate-500">{exp.period}</span>
                      </div>
                      <div className="text-[11px] font-medium text-cyan-800 mb-1.5">{exp.company} — {exp.location}</div>
                      <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-700 leading-normal">
                        {exp.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b pb-1 mb-2">
                  Core Competencies & Technologies
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {resume.skills.map(s => (
                    <span key={s} className="text-[10px] font-medium bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-200">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b pb-1 mb-2">
                  Education & Credentials
                </h2>
                {resume.education.map(ed => (
                  <div key={ed.id} className="text-xs text-slate-800">
                    <span className="font-bold">{ed.degree}</span>, {ed.institution} ({ed.year})
                    {ed.honors && <span className="italic text-slate-500 block text-[11px]">{ed.honors}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
