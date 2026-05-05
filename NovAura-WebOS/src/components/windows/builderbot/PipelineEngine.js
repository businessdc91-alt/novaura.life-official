/**
 * NovAura Cybeni — Multi-AI Cascading Pipeline Engine
 *
 * Flow:
 *   Gemini Pass 1 (Foundation)     → 2x self-check → Orchestrator check →
 *   Gemini Pass 2 (Depth)          → 2x self-check → Orchestrator check →
 *   Gemini Pass 3 (Branching)      → 2x self-check → review loop (reject to P2 max 3x) → Orchestrator check →
 *   Pass 4 (Cap Logic)             → 2x self-check →
 *   Kimi Inspection                → approved: preview, rejected: →
 *   Claude/GPT Reinforcement       → Kimi Final → Preview
 *
 * ORCHESTRATOR: A supervisor AI watches the pipeline. After each major pass it can:
 *   APPROVE  — continue to next pass
 *   REDIRECT — inject course-correction instructions into the next pass
 *   TAKEOVER — the orchestrator generates the code itself and skips to Kimi
 *
 * Each pass self-checks 2x before advancing.
 * Pass 3 can reject back to Pass 2 up to 3 times.
 * Confusion detection pauses the pipeline for user guidance.
 */

import { chatCloud } from '../../../services/aiService';

// ── Helpers ────────────────────────────────────────────────

export function extractCodeBlocks(text) {
  const blocks = {};
  const regex = /```(\S+)\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const label = m[1];
    const code = m[2].trim();
    if (/\.\w+$/.test(label)) blocks[label] = code;
  }
  return blocks;
}

export function mergeBlocks(existing, incoming) {
  return { ...existing, ...incoming };
}

function formatCodeContext(blocks) {
  return Object.entries(blocks)
    .map(([name, code]) => `### ${name}\n\`\`\`${name}\n${code}\n\`\`\``)
    .join('\n\n');
}

function detectConfusion(text) {
  if (/^CONFUSED:/im.test(text.trim())) return text;
  if (/\bi need clarification\b|\bi'm unsure about\b|\bcould you clarify\b/i.test(text)) return text;
  return null;
}

function detectApproval(text) {
  return /^APPROVED/im.test(text.trim());
}

function extractIssues(text) {
  const match = text.match(/(?:ISSUES:|NEEDS_REFACTORING)([\s\S]*)/i);
  return match ? match[1].trim() : text;
}

// ── Restriction & Trait Config ─────────────────────────────

export const RESTRICTIONS = {
  content: {
    none: '',
    basic: 'Avoid harmful, offensive, or dangerous content.',
    moderate: 'Strictly avoid harmful content. Flag ambiguous content decisions.',
    strict: 'Maximum content safety. When unsure, ask the user.',
  },
  security: {
    standard: 'Follow standard security practices. Sanitize user inputs.',
    hardened: 'Security hardening: validate all inputs, encode outputs, parameterized queries, CSP, rate limiting.',
    paranoid: 'Maximum security. Assume all input is hostile. Defense-in-depth, fail-secure. No eval(), no innerHTML.',
  },
  codeQuality: {
    relaxed: 'Working code first, clean up later.',
    standard: 'Clean, readable code with reasonable error handling.',
    strict: 'Production-grade. Full error handling, edge cases, no placeholders.',
  },
};

function buildRestrictionBlock(cfg) {
  const parts = [];
  if (RESTRICTIONS.content[cfg.content]) parts.push(RESTRICTIONS.content[cfg.content]);
  if (RESTRICTIONS.security[cfg.security]) parts.push(RESTRICTIONS.security[cfg.security]);
  if (RESTRICTIONS.codeQuality[cfg.codeQuality]) parts.push(RESTRICTIONS.codeQuality[cfg.codeQuality]);
  return parts.length ? `## Restrictions\n${parts.join('\n')}` : '';
}

function buildTraitBlock(t) {
  const parts = [];
  if ((t?.creativity ?? 0.5) > 0.7) parts.push('Be creative and innovative.');
  else if ((t?.creativity ?? 0.5) < 0.3) parts.push('Be conservative, use established patterns.');
  if ((t?.verbosity ?? 0.5) > 0.7) parts.push('Include thorough inline documentation.');
  else if ((t?.verbosity ?? 0.5) < 0.3) parts.push('Be concise. Minimal comments.');
  if ((t?.strictness ?? 0.5) > 0.7) parts.push('Follow all rules without exception.');
  if ((t?.optimization ?? 0.3) > 0.7) parts.push('Maximize performance at every opportunity.');
  return parts.length ? `## Personality\n${parts.join('\n')}` : '';
}

function getTemp(traits, passType) {
  let base = 0.2 + ((traits?.creativity ?? 0.5) * 0.5);
  if (passType === 'check') base = Math.max(0.1, base - 0.3);
  if (passType === 'inspect') base = 0.15;
  return Math.round(base * 10) / 10;
}

// ── API Wrapper (with provider fallback) ──────────────────

// Fallback order for standard passes - targeting NovAura Free Pool
const FALLBACK_ORDER = [
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free'
];

async function callAI(provider, prompt, temp, isCancelled, _log) {
  if (isCancelled()) throw new Error('CANCELLED');

  // Build fallback chain: requested provider first, then others
  const chain = [provider, ...FALLBACK_ORDER.filter(p => p !== provider)];

  for (const p of chain) {
    try {
      const result = await chatCloud(prompt, {
        provider: p,
        maxTokens: 8192,
        temperature: temp,
        conversation: [],
      });
      if (isCancelled()) throw new Error('CANCELLED');
      if (p !== provider) _log?.(`${provider} unavailable — fell back to ${p}`);
      return result.response || '';
    } catch (err) {
      if (err.message === 'CANCELLED') throw err;
      // If this provider failed and there are more to try, continue
      if (p === chain[chain.length - 1]) throw err; // last in chain, give up
    }
  }
  throw new Error('All AI providers failed');
}

// ── Self-Check Runner (2x per pass) ───────────────────────

const SELF_CHECK_COUNT = 1; // 1 self-check per pass (total ~9 passes per prompt)

async function selfCheck(provider, codeBlocks, passLabel, temp, isCancelled, log) {
  for (let i = 1; i <= SELF_CHECK_COUNT; i++) {
    log(`Self-check ${i}/${SELF_CHECK_COUNT} for ${passLabel}...`);
    const prompt = [
      `Self-check ${i}/${SELF_CHECK_COUNT} for ${passLabel}.`,
      'Review the code. Fix: missing imports, undefined references, incomplete functions,',
      'broken cross-file references, logic errors, TODOs/placeholders, missing error handling.',
      'Output COMPLETE corrected files in ```filename.ext code blocks.',
      'If nothing needs fixing, output files unchanged.',
      '',
      formatCodeContext(codeBlocks),
    ].join('\n');

    const resp = await callAI(provider, prompt, temp, isCancelled, log);
    const newBlocks = extractCodeBlocks(resp);
    if (Object.keys(newBlocks).length > 0) {
      codeBlocks = mergeBlocks(codeBlocks, newBlocks);
      log(`Self-check ${i}/${SELF_CHECK_COUNT} corrected ${Object.keys(newBlocks).length} file(s).`);
    } else {
      log(`Self-check ${i}/${SELF_CHECK_COUNT}: clean.`);
    }
  }
  return codeBlocks;
}

// ── Confusion-Aware Pass Runner ───────────────────────────

async function runPass(provider, prompt, temp, isCancelled, onConfusion, log) {
  const resp = await callAI(provider, prompt, temp, isCancelled, log);
  const confusion = detectConfusion(resp);
  if (confusion && onConfusion) {
    const guidance = await onConfusion(confusion);
    const retryPrompt = prompt + `\n\n## User Clarification\n${guidance}`;
    return callAI(provider, retryPrompt, temp, isCancelled, log);
  }
  return resp;
}

// ── Orchestrator Check ────────────────────────────────────
//
// The orchestrator is a separate AI that supervises the pipeline.
// After each major pass it evaluates the output and decides:
//   APPROVE  → continue normally
//   REDIRECT → inject instructions into the next pass to correct course
//   TAKEOVER → orchestrator generates code itself, skips to Kimi

async function orchestratorCheck(provider, codeBlocks, userPrompt, passLabel, isCancelled, log) {
  log(`Orchestrator reviewing ${passLabel}...`);

  const resp = await callAI(provider, [
    'You are the PIPELINE ORCHESTRATOR — a supervisor AI overseeing a multi-AI code generation pipeline.',
    `You are reviewing the output of "${passLabel}".`,
    '',
    'Evaluate:',
    '1. Does the output address the user\'s request?',
    '2. Is the code quality acceptable for this stage?',
    '3. Is the architecture sound and the approach correct?',
    '4. Are there critical issues the next pass cannot reasonably fix?',
    '5. Is the pipeline on track to deliver what the user asked for?',
    '',
    'Respond with exactly ONE of these on the FIRST LINE:',
    '- APPROVE — output is on track, continue to next pass',
    '- REDIRECT: [specific course-correction instructions for the next pass]',
    '- TAKEOVER — output is significantly off track; you will generate the code yourself',
    '',
    `## User\'s Original Request\n${userPrompt}`,
    `\n## Code from ${passLabel}\n${formatCodeContext(codeBlocks)}`,
  ].join('\n'), 0.1, isCancelled);

  const trimmed = resp.trim();

  if (/^TAKEOVER/im.test(trimmed)) {
    log('Orchestrator: TAKEOVER — pipeline quality insufficient, generating directly.');
    return { action: 'takeover', message: trimmed };
  }

  if (/^REDIRECT:/im.test(trimmed)) {
    const instructions = trimmed.replace(/^REDIRECT:\s*/im, '').trim();
    log(`Orchestrator: REDIRECT — ${instructions.substring(0, 120)}${instructions.length > 120 ? '...' : ''}`);
    return { action: 'redirect', instructions };
  }

  log('Orchestrator: APPROVED — continuing.');
  return { action: 'approve' };
}

// ── Phase Definitions (for UI) ────────────────────────────

export const PIPELINE_PHASES = [
  { id: 'pass-1', name: '480B Pass 1 — Foundation', provider: 'qwen/qwen3-coder-480b-a35b:free' },
  { id: 'pass-1-check', name: 'Pass 1 Self-Check', provider: 'qwen/qwen3-coder-480b-a35b:free' },
  { id: 'orch-1', name: '1T Orchestrator Check — Foundation', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'pass-data', name: 'Aura-DB — Data Architecture & Persistence', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'pass-2', name: '480B Pass 2 — Depth & Functionality', provider: 'qwen/qwen3-coder-480b-a35b:free' },
  { id: 'pass-2-check', name: 'Pass 2 Self-Check', provider: 'qwen/qwen3-coder-480b-a35b:free' },
  { id: 'orch-2', name: '1T Orchestrator Check — Depth', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'pass-3', name: '1T Pass 3 — Branching Logic', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'pass-3-check', name: 'Pass 3 Self-Check', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'pass-3-review', name: '1T Pass 3 ↔ Pass 2 Review Loop', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'orch-3', name: '1T Orchestrator Check — Branching', provider: 'inclusionai/ling-2.6-1t:free' },
  { id: 'pass-aesthetic', name: 'Nova — Aesthetic Polish & Flare', provider: 'google/gemma-4-31b-it:free' },
  { id: 'pass-4', name: '405B Pass 4 — Cap Logic Validation', provider: 'nousresearch/hermes-3-llama-3.1-405b:free' },
  { id: 'pass-4-check', name: 'Pass 4 Self-Check', provider: 'nousresearch/hermes-3-llama-3.1-405b:free' },
  { id: 'orch-takeover', name: '1T Orchestrator Takeover', provider: 'inclusionai/ling-2.6-1t:free', conditional: true },
  { id: 'kimi-inspect', name: '405B Final Inspection', provider: 'nousresearch/hermes-3-llama-3.1-405b:free' },
  { id: 'pass-edge', name: 'Aura-Edge — Vercel/Performance Optimization', provider: 'qwen/qwen3-coder-480b-a35b:free' },
  { id: 'reinforce', name: '480B Reinforcement (Specialist)', provider: 'qwen/qwen3-coder-480b-a35b:free', conditional: true },
  { id: 'kimi-final', name: '405B Final Review', provider: 'nousresearch/hermes-3-llama-3.1-405b:free', conditional: true },
  { id: 'preview', name: 'Preview Ready' },
];

// ── Main Pipeline Runner ──────────────────────────────────

export async function runPipeline(userPrompt, projectFiles, pipelineConfig, callbacks) {
  const { onPhaseStart, onPhaseComplete, onPhaseError, onLog, onCodeUpdate, onConfusion, onComplete, isCancelled } = callbacks;
  const { pipelineAgents = {} } = pipelineConfig;

  // Fallback to defaults if agents aren't provided
  const planner = pipelineAgents.PLANNER || { model: 'inclusionai/ling-2.6-1t:free', temperature: 0.1, systemPrompt: 'You are the Lead Architect.' };
  const developer = pipelineAgents.DEVELOPER || { model: 'qwen/qwen3-coder-480b-a35b:free', temperature: 0.4, systemPrompt: 'You are a Senior Developer.' };
  const designer = pipelineAgents.DESIGNER || { model: 'google/gemma-4-31b-it:free', temperature: 0.8, systemPrompt: 'You are Nova, the Digital Designer.' };
  const dataArchitect = pipelineAgents.DATA_ARCHITECT || { model: 'inclusionai/ling-2.6-1t:free', temperature: 0.1, systemPrompt: 'You are the Data Architect.' };
  const optimizer = pipelineAgents.OPTIMIZER || { model: 'qwen/qwen3-coder-480b-a35b:free', temperature: 0.2, systemPrompt: 'You are the Edge Optimizer.' };
  const auditor = pipelineAgents.AUDITOR || { model: 'nousresearch/hermes-3-llama-3.1-405b:free', temperature: 0.2, systemPrompt: 'You are a QA Engineer.' };

  const restrictions = buildRestrictionBlock(pipelineConfig.restrictions || {});
  const traits = buildTraitBlock(pipelineConfig.traits);
  
  const existingContext = projectFiles.length > 0
    ? `## Existing Project Files\n${projectFiles.map(f => `### ${f.path}\n\`\`\`${f.path}\n${f.content}\n\`\`\``).join('\n\n')}`
    : '';

  let codeBlocks = {};
  let skipToKimi = false;        // set true if orchestrator takes over
  let redirectDirective = '';     // course-correction from orchestrator
  const log = (msg) => onLog?.(msg);

  try {
    // ═══════════════════════════════════════════════════════
    // PASS 1: Foundation & Groundwork (Qwen Coder)
    // ═══════════════════════════════════════════════════════
    onPhaseStart?.('pass-1');
    log(`${developer.name || 'DevAgent'} Pass 1: Foundation and groundwork...`);

    const pass1Resp = await runPass(developer.model, [
      `## Agent Identity\n${developer.systemPrompt}`,
      '\nYou are Pass 1 (Foundation) in a multi-AI cascading code generation pipeline.',
      'Create the CORE ARCHITECTURE: file structure, entry points, data models, UI skeleton, routing, base styling.',
      'Output COMPLETE files — no TODOs, no placeholders. Every function needs a real implementation.',
      'Wrap each file in ```filename.ext code blocks.',
      restrictions, traits, existingContext,
      `\n## User Request\n${userPrompt}`,
    ].filter(Boolean).join('\n'), developer.temperature, isCancelled, onConfusion);

    codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(pass1Resp));
    onCodeUpdate?.(codeBlocks);
    onPhaseComplete?.('pass-1');

    // Pass 1 self-check
    onPhaseStart?.('pass-1-check');
    codeBlocks = await selfCheck(developer.model, codeBlocks, 'Pass 1', Math.max(0.1, developer.temperature - 0.2), isCancelled, log);
    onCodeUpdate?.(codeBlocks);
    onPhaseComplete?.('pass-1-check');

    // ═══════════════════════════════════════════════════════
    // AURA-DB PASS: Data Architecture & Persistence
    // ═══════════════════════════════════════════════════════
    if (!skipToKimi) {
      onPhaseStart?.('pass-data');
      log(`${dataArchitect.name || 'Aura-DB'}: Architecting data schemas and persistence rules...`);

      const dbResp = await callAI(dataArchitect.model, [
        `## Agent Identity\n${dataArchitect.systemPrompt}`,
        '\nYou are Aura-DB, the Data Architect. Model the database schema based on the foundation.',
        'Support Firestore, Supabase, Neon, or Convex as requested or appropriate.',
        'Output COMPLETE database rules, schema definitions, and CRUD service files.',
        'Ensure the application has a robust, persistent data layer. No placeholders.',
        'Output corrected/new files in ```filename.ext code blocks.',
        restrictions, traits,
        `\n## Current Code\n${formatCodeContext(codeBlocks)}`,
        `\n## Original Request\n${userPrompt}`,
      ].filter(Boolean).join('\n'), dataArchitect.temperature, isCancelled);

      codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(dbResp));
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-data');
    }

    // ── Orchestrator Check 1 ──
    onPhaseStart?.('orch-1');
    const orch1 = await orchestratorCheck(planner.model, codeBlocks, userPrompt, 'Pass 1 (Foundation)', isCancelled, log);
    onPhaseComplete?.('orch-1');

    if (orch1.action === 'takeover') {
      skipToKimi = true;
      // Generate code directly
      onPhaseStart?.('orch-takeover');
      log('Orchestrator taking over — generating full codebase...');
      const takeoverResp = await callAI(planner.model, [
        `## Agent Identity\n${planner.systemPrompt}`,
        '\nYou are the ORCHESTRATOR. The pipeline foundation was insufficient.',
        'Generate the COMPLETE application from scratch based on the user\'s request.',
        'Output ALL files in ```filename.ext code blocks. No TODOs, no placeholders.',
        restrictions, traits, existingContext,
        `\n## User Request\n${userPrompt}`,
      ].filter(Boolean).join('\n'), planner.temperature, isCancelled);

      codeBlocks = mergeBlocks({}, extractCodeBlocks(takeoverResp));
      codeBlocks = await selfCheck(planner.model, codeBlocks, 'Orchestrator takeover', Math.max(0.1, planner.temperature), isCancelled, log);
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('orch-takeover');
    } else if (orch1.action === 'redirect') {
      redirectDirective = orch1.instructions;
    }

    // ═══════════════════════════════════════════════════════
    // PASS 2: Depth & Functionality (Qwen Coder)
    // ═══════════════════════════════════════════════════════
    if (!skipToKimi) {
      onPhaseStart?.('pass-2');
      log(`${developer.name || 'DevAgent'} Pass 2: Depth and full functionality...`);

      const pass2Prompt = [
        `## Agent Identity\n${developer.systemPrompt}`,
        '\nYou are Pass 2 (Depth & Functionality) in a multi-AI pipeline.',
        'Add FULL functionality to the foundation code: complete all implementations, error handling,',
        'state management, user interactions, API integrations, loading/empty/error states.',
        'Every function MUST be complete. Every handler MUST work. Output ALL files.',
        'Wrap each file in ```filename.ext code blocks.',
        redirectDirective ? `\n## Orchestrator Directive\n${redirectDirective}` : '',
        restrictions, traits,
        `\n## Code from Pass 1\n${formatCodeContext(codeBlocks)}`,
        `\n## Original Request\n${userPrompt}`,
      ].filter(Boolean).join('\n');

      const pass2Resp = await runPass(developer.model, pass2Prompt, developer.temperature, isCancelled, onConfusion);
      redirectDirective = ''; // consumed

      codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(pass2Resp));
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-2');

      // Pass 2 self-check
      onPhaseStart?.('pass-2-check');
      codeBlocks = await selfCheck(developer.model, codeBlocks, 'Pass 2', Math.max(0.1, developer.temperature - 0.2), isCancelled, log);
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-2-check');

      // ── Orchestrator Check 2 ──
      onPhaseStart?.('orch-2');
      const orch2 = await orchestratorCheck(planner.model, codeBlocks, userPrompt, 'Pass 2 (Depth)', isCancelled, log);
      onPhaseComplete?.('orch-2');

      if (orch2.action === 'takeover') {
        skipToKimi = true;
        onPhaseStart?.('orch-takeover');
        log('Orchestrator taking over after Pass 2...');
        const takeoverResp = await callAI(planner.model, [
          `## Agent Identity\n${planner.systemPrompt}`,
          '\nYou are the ORCHESTRATOR. The depth pass was insufficient.',
          'Take the existing foundation and generate the COMPLETE application with full functionality.',
          'Output ALL files in ```filename.ext code blocks.',
          restrictions, traits,
          `\n## Current Code\n${formatCodeContext(codeBlocks)}`,
          `\n## User Request\n${userPrompt}`,
        ].filter(Boolean).join('\n'), planner.temperature, isCancelled);

        codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(takeoverResp));
        codeBlocks = await selfCheck(planner.model, codeBlocks, 'Orchestrator takeover', Math.max(0.1, planner.temperature), isCancelled, log);
        onCodeUpdate?.(codeBlocks);
        onPhaseComplete?.('orch-takeover');
      } else if (orch2.action === 'redirect') {
        redirectDirective = orch2.instructions;
      }
    }

    // ═══════════════════════════════════════════════════════
    // PASS 3: Branching Logic & Dependencies (Nemotron)
    // with Pass 2 rejection loop (max 3x)
    // ═══════════════════════════════════════════════════════
    if (!skipToKimi) {
      let rejections = 0;
      let pass3Done = false;

      while (!pass3Done) {
        onPhaseStart?.('pass-3');
        log(`${planner.name || 'Orchestrator'} Pass 3: Branching logic & dependencies${rejections > 0 ? ` (attempt ${rejections + 1})` : ''}...`);

        const pass3Resp = await runPass(planner.model, [
          `## Agent Identity\n${planner.systemPrompt}`,
          '\nYou are Pass 3 (Branching Logic & Dependency Specialist).',
          'Trace EVERY feature to its logical conclusion. Ensure ALL dependencies exist.',
          '',
          'Think recursively about what each feature requires:',
          '- Armor → crafting system → materials → gathering → tools → skills → leveling → XP → progression',
          '- Shop → currency → earning methods → inventory → equipment slots → stats → stat system',
          '- For EVERY feature: what does this need? Does that exist? What does THAT need? Continue until complete.',
          '',
          'Also check: functions referencing nonexistent things? UI with no backing logic? Missing data fields?',
          '',
          'If CONFUSED about intent, respond with: CONFUSED: [your question]',
          'Do NOT guess. Stop and ask.',
          '',
          'Output ALL files with additions. Wrap in ```filename.ext code blocks.',
          redirectDirective ? `\n## Orchestrator Directive\n${redirectDirective}` : '',
          restrictions, traits,
          `\n## Current Code\n${formatCodeContext(codeBlocks)}`,
          `\n## Original Request\n${userPrompt}`,
        ].filter(Boolean).join('\n'), planner.temperature, isCancelled, onConfusion);

        redirectDirective = ''; // consumed

        codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(pass3Resp));
        onCodeUpdate?.(codeBlocks);
        onPhaseComplete?.('pass-3');

        // Pass 3 self-check
        onPhaseStart?.('pass-3-check');
        codeBlocks = await selfCheck(planner.model, codeBlocks, 'Pass 3', Math.max(0.1, planner.temperature), isCancelled, log);
        onCodeUpdate?.(codeBlocks);
        onPhaseComplete?.('pass-3-check');

        // Pass 3 → Pass 2 review loop
        onPhaseStart?.('pass-3-review');
        log('Pass 3 reviewing for refactoring needs...');

        const reviewResp = await callAI(planner.model, [
          `## Agent Identity\n${planner.systemPrompt}`,
          '\nReview this code. Check: all dependency chains complete? All functions real? No circular deps? All imports valid?',
          'If PASSES: respond APPROVED',
          'If NEEDS WORK: respond NEEDS_REFACTORING followed by a list of issues.',
          `\n${formatCodeContext(codeBlocks)}`,
        ].join('\n'), Math.max(0.1, planner.temperature), isCancelled);

        if (detectApproval(reviewResp)) {
          log('Pass 3 review: APPROVED');
          pass3Done = true;
          onPhaseComplete?.('pass-3-review');
        } else if (rejections < 3) {
          rejections++;
          const issues = extractIssues(reviewResp);
          log(`Rejected (${rejections}/3). Sending back to Pass 2 for refactoring...`);
          onPhaseComplete?.('pass-3-review');

          const refactorResp = await callAI(developer.model, [
            `## Agent Identity\n${developer.systemPrompt}`,
            `\nPass 2 refactoring (rejection ${rejections}/3). Fix these issues:`,
            issues,
            'Output COMPLETE corrected files in ```filename.ext code blocks.',
            `\n${formatCodeContext(codeBlocks)}`,
            `\n## Original Request\n${userPrompt}`,
          ].join('\n'), developer.temperature, isCancelled);

          codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(refactorResp));
          codeBlocks = await selfCheck(developer.model, codeBlocks, 'Pass 2 refactor', Math.max(0.1, developer.temperature - 0.2), isCancelled, log);
          onCodeUpdate?.(codeBlocks);
        } else {
          log('3 rejections exhausted. Pass 3 self-correcting remaining issues...');
          onPhaseComplete?.('pass-3-review');

          const forceResp = await callAI(planner.model, [
            `## Agent Identity\n${planner.systemPrompt}`,
            '\nYou have been sent back 3 times. Fix ALL remaining issues yourself.',
            'Double-check everything. Output FINAL corrected files in ```filename.ext code blocks.',
            `\n${formatCodeContext(codeBlocks)}`,
          ].join('\n'), Math.max(0.1, planner.temperature), isCancelled);

          codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(forceResp));
          codeBlocks = await selfCheck(planner.model, codeBlocks, 'Pass 3 forced fix', Math.max(0.1, planner.temperature), isCancelled, log);
          onCodeUpdate?.(codeBlocks);
          pass3Done = true;
        }
      }

      // ── Orchestrator Check 3 ──
      onPhaseStart?.('orch-3');
      const orch3 = await orchestratorCheck(planner.model, codeBlocks, userPrompt, 'Pass 3 (Branching Logic)', isCancelled, log);
      onPhaseComplete?.('orch-3');

      if (orch3.action === 'takeover') {
        skipToKimi = true;
        onPhaseStart?.('orch-takeover');
        log('Orchestrator taking over after branching logic...');
        const takeoverResp = await callAI(planner.model, [
          `## Agent Identity\n${planner.systemPrompt}`,
          '\nYou are the ORCHESTRATOR. The branching logic pass failed to meet standards.',
          'Using the existing code as a base, complete ALL missing dependency chains,',
          'fix all issues, and ensure the full application is production-ready.',
          'Output ALL files in ```filename.ext code blocks.',
          restrictions, traits,
          `\n## Current Code\n${formatCodeContext(codeBlocks)}`,
          `\n## User Request\n${userPrompt}`,
        ].filter(Boolean).join('\n'), planner.temperature, isCancelled);

        codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(takeoverResp));
        codeBlocks = await selfCheck(planner.model, codeBlocks, 'Orchestrator takeover', Math.max(0.1, planner.temperature), isCancelled, log);
        onCodeUpdate?.(codeBlocks);
        onPhaseComplete?.('orch-takeover');
      }
    }

    // ═══════════════════════════════════════════════════════
    // NOVA PASS: Aesthetic Polish & Flare
    // ═══════════════════════════════════════════════════════
    if (!skipToKimi) {
      onPhaseStart?.('pass-aesthetic');
      log(`${designer.name || 'Nova'}: Injecting aesthetics, flare, and UX polish...`);

      const aestheticResp = await callAI(designer.model, [
        `## Agent Identity\n${designer.systemPrompt}`,
        '\nYou are Nova, the Digital Designer. Your goal is to take the stable code and inject WOW factor.',
        'Refine the CSS/Styles for premium aesthetics: glassmorphism, smooth animations, vibrant gradients,',
        'modern typography, and high-depth layouts. Make it look like a high-end production app.',
        'Output COMPLETE corrected files in ```filename.ext code blocks.',
        restrictions, traits,
        `\n## Current Code\n${formatCodeContext(codeBlocks)}`,
        `\n## Original Request\n${userPrompt}`,
      ].filter(Boolean).join('\n'), designer.temperature, isCancelled);

      codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(aestheticResp));
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-aesthetic');
    }

    // ═══════════════════════════════════════════════════════
    // PASS 4: Cap Logic Checking
    // ═══════════════════════════════════════════════════════
    if (!skipToKimi) {
      onPhaseStart?.('pass-4');
      log(`${auditor.name || 'Validator'} Pass 4: Cap logic validation...`);

      const pass4Resp = await callAI(auditor.model, [
        `## Agent Identity\n${auditor.systemPrompt}`,
        '\nYou are Pass 4 (Cap Logic Validator) — final technical validation.',
        'Check for: dead code paths, unreachable branches, missing returns, race conditions,',
        'missing edge cases, type mismatches, memory leaks, crash scenarios.',
        'Does this comply with the user vision? Is it as entertaining/complete as comparable applications?',
        'What is the max level? What is the scaling rate? Are all values balanced?',
        'Fix EVERYTHING. Output all corrected files in ```filename.ext code blocks.',
        restrictions,
        `\n${formatCodeContext(codeBlocks)}`,
        `\n## Original Request\n${userPrompt}`,
      ].filter(Boolean).join('\n'), auditor.temperature, isCancelled);

      codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(pass4Resp));
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-4');

      // Pass 4 self-check
      onPhaseStart?.('pass-4-check');
      codeBlocks = await selfCheck(auditor.model, codeBlocks, 'Pass 4', Math.max(0.1, auditor.temperature), isCancelled, log);
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-4-check');
    }

    // ═══════════════════════════════════════════════════════
    // FINAL INSPECTION
    // ═══════════════════════════════════════════════════════
    onPhaseStart?.('kimi-inspect');
    log(`${auditor.name || 'Validator'}: Quality inspection...`);

    const kimiResp = await callAI(auditor.model, [
      `## Agent Identity\n${auditor.systemPrompt}`,
      '\nYou are the FINAL QUALITY INSPECTOR. This code has been through a multi-pass generation pipeline.',
      'Check: compiles without errors? All features implemented? Secure? UX polished? Matches user vision?',
      'Is it as complete and feature-rich as comparable production applications?',
      'If EVERYTHING passes: respond APPROVED (first line) then summary.',
      'If issues remain: respond ISSUES: then numbered list.',
      `\n## User Request\n${userPrompt}`,
      `\n## Code\n${formatCodeContext(codeBlocks)}`,
    ].join('\n'), 0.15, isCancelled);

    onPhaseComplete?.('kimi-inspect');

    // ═══════════════════════════════════════════════════════
    // AURA-EDGE PASS: Vercel/Performance Optimization
    // ═══════════════════════════════════════════════════════
    if (!skipToKimi) {
      onPhaseStart?.('pass-edge');
      log(`${optimizer.name || 'Aura-Edge'}: Optimizing for Vercel edge and performance...`);

      const edgeResp = await callAI(optimizer.model, [
        `## Agent Identity\n${optimizer.systemPrompt}`,
        '\nYou are Aura-Edge, the Performance Optimizer. Refine the ENTIRE codebase for maximum performance.',
        'Implement Vercel/Vite best practices: React Server Components, image optimization, lazy loading,',
        'and edge-runtime compatibility. Ensure maximum lighthouse scores.',
        'Output corrected files in ```filename.ext code blocks.',
        restrictions, traits,
        `\n## Current Code\n${formatCodeContext(codeBlocks)}`,
        `\n## Original Request\n${userPrompt}`,
      ].filter(Boolean).join('\n'), optimizer.temperature, isCancelled);

      codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(edgeResp));
      onCodeUpdate?.(codeBlocks);
      onPhaseComplete?.('pass-edge');
    }

    if (detectApproval(kimiResp)) {
      log('Kimi: APPROVED — spinning up preview.');
      onPhaseStart?.('preview');
      onComplete?.(codeBlocks);
      onPhaseComplete?.('preview');
      return codeBlocks;
    }

    // ═══════════════════════════════════════════════════════
    // REINFORCEMENT
    // ═══════════════════════════════════════════════════════
    const kimiIssues = extractIssues(kimiResp);
    onPhaseStart?.('reinforce');
    log(`Quality Inspector found issues. Sending to ${developer.name || 'DevAgent'} for reinforcement...`);

    const reinforceResp = await callAI(developer.model, [
      `## Agent Identity\n${developer.systemPrompt}`,
      '\nYou are the REINFORCEMENT SPECIALIST. The quality inspector found these issues:',
      kimiIssues,
      'Fix ALL issues. Zero build errors. Output COMPLETE files in ```filename.ext code blocks.',
      `\n## Original Request\n${userPrompt}`,
      `\n## Code\n${formatCodeContext(codeBlocks)}`,
    ].join('\n'), Math.min(0.8, developer.temperature + 0.1), isCancelled);

    codeBlocks = mergeBlocks(codeBlocks, extractCodeBlocks(reinforceResp));
    codeBlocks = await selfCheck(developer.model, codeBlocks, `${developer.name || 'DevAgent'} reinforcement`, Math.max(0.1, developer.temperature), isCancelled, log);
    onCodeUpdate?.(codeBlocks);
    onPhaseComplete?.('reinforce');

    // ═══════════════════════════════════════════════════════
    // FINAL REVIEW
    // ═══════════════════════════════════════════════════════
    onPhaseStart?.('kimi-final');
    log(`${auditor.name || 'Validator'}: Final review after reinforcement...`);

    const kimiFinalResp = await callAI(auditor.model, [
      `## Agent Identity\n${auditor.systemPrompt}`,
      '\nFinal quality review after reinforcement.',
      'If ready: respond APPROVED. If still broken: respond ISSUES: [problems].',
      `\n## Code\n${formatCodeContext(codeBlocks)}`,
    ].join('\n'), 0.15, isCancelled);

    onPhaseComplete?.('kimi-final');

    if (!detectApproval(kimiFinalResp)) {
      const remaining = extractIssues(kimiFinalResp);
      log('Kimi found remaining issues — proceeding to preview with notes:');
      log(remaining);
    } else {
      log('Kimi final: APPROVED');
    }

    // ═══════════════════════════════════════════════════════
    // PREVIEW
    // ═══════════════════════════════════════════════════════
    onPhaseStart?.('preview');
    log(`Pipeline complete. ${Object.keys(codeBlocks).length} files generated.`);
    onComplete?.(codeBlocks);
    onPhaseComplete?.('preview');
    return codeBlocks;

  } catch (err) {
    if (err.message === 'CANCELLED') {
      log('Pipeline cancelled by user.');
      onPhaseError?.('cancelled', 'Pipeline cancelled');
      return codeBlocks;
    }
    log(`Pipeline error: ${err.message}`);
    onPhaseError?.(null, err.message);
    throw err;
  }
}
