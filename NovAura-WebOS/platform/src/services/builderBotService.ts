import { aiOrchestrator } from './aiOrchestrator';
import type { MembershipTier } from '../config/tierConfig';

const MAX_ITERATIONS = 3;
const CONVERGENCE_THRESHOLD = 0.05; // 5% diff — stop if change is tiny

export type LogType = 'system' | 'command' | 'output' | 'success' | 'error' | 'info' | 'build';

export interface PipelineOptions {
  tier?: MembershipTier;
}

/** Character-level diff ratio: 0 = identical, 1 = completely different */
export function computeDiff(a: string, b: string): number {
  if (a === b) return 0;
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 0;

  // Levenshtein-lite: count char-level changes via LCS length
  const shorter = a.length < b.length ? a : b;
  const longerStr = a.length < b.length ? b : a;
  let matches = 0;
  let si = 0;
  for (let li = 0; li < longerStr.length && si < shorter.length; li++) {
    if (longerStr[li] === shorter[si]) { matches++; si++; }
  }
  return 1 - matches / longer;
}

/** Strip markdown code fences from AI responses */
export function extractCode(text: string): string {
  // Match ```html ... ``` or ``` ... ``` blocks
  const fenced = text.match(/```(?:html|css|js|javascript|tsx?|jsx?)?\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // If no fences but looks like HTML, return as-is
  if (text.trimStart().startsWith('<')) return text.trim();
  return text.trim();
}

const TIER_RANK: Record<MembershipTier, number> = {
  free: 0, spark: 1, emergent: 2, catalyst: 3, nova: 4, 'catalytic-crew': 5,
};

/**
 * Studio Refinement Sweep — Kimi as the creative architect.
 * Reviews the full project, fills gaps, enhances visuals.
 * Never deletes — only enhances and replaces with better.
 */
async function runKimiRefinementSweep(
  code: string,
  originalPrompt: string,
  onLog: (type: LogType, text: string) => void
): Promise<string> {
  onLog('system', '');
  onLog('system', '[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]');
  onLog('system', '[KIMI-SWEEP] Studio Refinement Layer activated');
  onLog('system', '[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]');
  onLog('info',   '[KIMI-SWEEP] Kimi taking over as creative architect...');
  onLog('build',  '[KIMI-SWEEP] Reading entire project — scanning for gaps, dead ends, and opportunities...');

  const kimiPrompt = `
You are the final architect of this project. The generation pipeline has produced a working first draft. Your role is to take it to production quality.

THE ORIGINAL REQUEST WAS:
"${originalPrompt}"

YOUR LAWS — non-negotiable:
1. NEVER delete, remove, or simplify any existing functionality. Only ENHANCE, REFINE, and REPLACE with something better.
2. Find every logical gap — incomplete event handlers, missing edge cases, broken flows, dead-end states, placeholder text, hardcoded dummy data — and fill them with real, working, shippable logic.
3. No mocks. No stubs. No TODO comments left behind. If you write it, it must work.
4. Read the visual soul of this project deeply — feel the colors, the spacing, the typography, the motion, the energy. Let your creativity flow. Make it more visually beautiful while staying true to its aesthetic identity.
5. Complexity is beauty. Do not simplify what is meant to be detailed. Layer depth where depth is deserved.
6. If you see an animation that could be smoother, make it smoother. If you see a transition that could be more elegant, make it elegant. If you see a color that could sing more, make it sing.
7. Return the COMPLETE, ENHANCED project — every line, nothing omitted.

AESTHETIC CONTEXT (NovAura Platform):
- Dark void background (#080810, #0D0D1A)
- Neon cyan accent (#00F0FF) — primary glow, interactive elements
- Neon violet (#8B5CF6) — secondary, AI/creative features
- Amber/gold (#FBBF24) — premium, Catalyst tier
- Font: Sharp geometric, monospace for data/labels, bold headlines
- Design language: Futuristic, ethical, sci-fi OS aesthetic
- Borders: Subtle (white/5 to white/10), glowing accents on hover
- Motion: Smooth, purposeful — framer-motion style ease curves
- Everything feels like a living digital system, not a static webpage

Here is the code to elevate:
\`\`\`html
${code}
\`\`\`

Return ONLY the complete enhanced code wrapped in a single \`\`\`html block. No explanation, no commentary. Just the elevated code.
`.trim();

  onLog('build', '[KIMI-SWEEP] Applying creative architect pass — visual enhancement + logic completion...');

  const response = await aiOrchestrator.proxyChat('kimi', kimiPrompt, 'moonshot-v1-8k');

  if (response.error) {
    onLog('error', `[KIMI-SWEEP] Kimi sweep failed: ${response.error}`);
    onLog('info',  '[KIMI-SWEEP] Returning previous pipeline output unchanged.');
    return code;
  }

  const refined = extractCode(response.content);

  if (!refined || refined.length < code.length * 0.5) {
    // If Kimi returned something suspiciously short, keep the original
    onLog('error', '[KIMI-SWEEP] Refinement returned incomplete output — keeping pipeline result.');
    return code;
  }

  const diffRatio = computeDiff(code, refined);
  onLog('info',    `[KIMI-SWEEP] Refinement delta: ${(diffRatio * 100).toFixed(1)}% changed`);
  onLog('success', '[KIMI-SWEEP] Studio refinement complete. Your project has been elevated.');
  onLog('system', '[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]');
  onLog('system', '');

  return refined;
}

/**
 * BuilderBot Pipeline — generate → critique → improve (capped).
 * Studio+ tiers additionally run a Kimi creative architect sweep.
 *
 * @param initialPrompt  The user's build/feature request
 * @param currentCode    The existing editor code (used as base context)
 * @param onLog          Callback for terminal output (type, text)
 * @param options        Pipeline options (tier, kimiKey for Studio+ sweep)
 * @returns              Final refined code string
 */
export async function runPipeline(
  initialPrompt: string,
  currentCode: string,
  onLog: (type: LogType, text: string) => void,
  options?: PipelineOptions
): Promise<string> {
  const tier = options?.tier ?? 'free';
  const isStudioPlus = TIER_RANK[tier] >= TIER_RANK['emergent'];

  onLog('system', '[BUILDERBOT] Pipeline started.');
  onLog('info',   `[BUILDERBOT] Tier: ${tier.toUpperCase()} | Iterations cap: ${MAX_ITERATIONS} | Convergence: ${(CONVERGENCE_THRESHOLD * 100).toFixed(0)}%`);
  if (isStudioPlus) {
    onLog('info', '[BUILDERBOT] Studio Refinement Sweep enabled — Kimi will review and elevate after generation.');
  }

  // ── BRANCH 1: Generate initial code from prompt ──────────────────────────
  onLog('build',  '[GEN-1] Generating initial blueprint from prompt...');
  const genPrompt = `
You are BuilderBot, an expert web developer. The user wants to:
"${initialPrompt}"

Here is the current code to build upon:
\`\`\`html
${currentCode}
\`\`\`

Generate improved, complete HTML/CSS/JS code that fulfills the request.
Return ONLY the raw code, no explanation. Wrap it in a single \`\`\`html block.
`.trim();

  const genResponse = await aiOrchestrator.sendMessage(genPrompt, 'BuilderBot Generation Pass');
  if (genResponse.error) {
    onLog('error', `[GEN-1] Failed: ${genResponse.error}`);
    return currentCode;
  }

  let workingCode = extractCode(genResponse.content);
  onLog('success', '[GEN-1] Initial blueprint generated.');

  // ── ITERATIVE CRITIQUE + IMPROVE LOOP ────────────────────────────────────
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    onLog('build', `[CRITIQUE-${i}] Analyzing code for gaps and improvements...`);

    const critiquePrompt = `
You are a senior code reviewer. Critique the following code for:
1. Missing features from the original request: "${initialPrompt}"
2. Bugs, accessibility issues, or broken logic
3. Visual/style improvements

Code to review:
\`\`\`html
${workingCode}
\`\`\`

List 3-5 specific, actionable improvements. Be concise.
`.trim();

    const critiqueResponse = await aiOrchestrator.sendMessage(critiquePrompt, 'BuilderBot Critique Pass');
    if (critiqueResponse.error) {
      onLog('error', `[CRITIQUE-${i}] Failed: ${critiqueResponse.error}`);
      break;
    }

    const critique = critiqueResponse.content;
    onLog('output', `[CRITIQUE-${i}] Issues found:\n${critique.substring(0, 400)}...`);
    onLog('build', `[IMPROVE-${i}] Applying fixes based on critique...`);

    const improvePrompt = `
You are BuilderBot. Apply the following critique to improve the code.

Critique:
${critique}

Current code:
\`\`\`html
${workingCode}
\`\`\`

Return ONLY the complete improved code wrapped in a \`\`\`html block. No explanations.
`.trim();

    const improveResponse = await aiOrchestrator.sendMessage(improvePrompt, 'BuilderBot Improve Pass');
    if (improveResponse.error) {
      onLog('error', `[IMPROVE-${i}] Failed: ${improveResponse.error}`);
      break;
    }

    const improvedCode = extractCode(improveResponse.content);

    // ── CAPPING LOGIC ─────────────────────────────────────────────────────
    const diffRatio = computeDiff(workingCode, improvedCode);
    onLog('info', `[DELTA-${i}] Code diff ratio: ${(diffRatio * 100).toFixed(1)}%`);

    if (diffRatio < CONVERGENCE_THRESHOLD) {
      onLog('success', `[BUILDERBOT] Converged at iteration ${i} (diff < ${(CONVERGENCE_THRESHOLD * 100).toFixed(0)}%). Stopping.`);
      workingCode = improvedCode;
      break;
    }

    workingCode = improvedCode;
    onLog('success', `[IMPROVE-${i}] Applied. Moving to next iteration...`);
  }

  // ── STUDIO+ REFINEMENT SWEEP (Kimi) ──────────────────────────────────────
  if (isStudioPlus) {
    workingCode = await runKimiRefinementSweep(workingCode, initialPrompt, onLog);
  }

  onLog('success', '[BUILDERBOT] Pipeline complete. Code deployed to editor.');
  return workingCode;
}
