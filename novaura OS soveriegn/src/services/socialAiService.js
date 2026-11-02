// socialAiService.js — Universal AI Co-Intelligence for Sovereign Social Network
// Powers thread synthesis, AI TL;DR, peer discussions, and smart post polishing
// Utilizing local offline engines (Ollama :11434, LM Studio :1234), Dual Inference (Nova/Aura),
// and BYOK Cloud Frontier Models (Gemini, Vertex, Claude, OpenAI).

import { dualInference } from './dualInferenceService.js';
import { queryUniversalInference } from './literatureAiService.js';

/**
 * Summarize a Reddit/Wall post thread into an executive TL;DR
 */
export async function summarizeThread({ post, comments = [] }) {
  if (!post) return null;

  const commentsSnippet = (comments || [])
    .slice(0, 8)
    .map((c, i) => `[Comment ${i + 1} by @${c.authorHandle}]: ${c.content}`)
    .join('\n');

  const prompt = `You are the Sovereign Neural Intelligence Analyst.
Analyze the following social post and peer discussion thread. Provide a sharp, insightful, and structured TL;DR summary in markdown:

Post Title: "${post.title || 'Untitled Post'}"
Author: @${post.authorHandle}.nova
Sub-Aura Community: ${post.subAura || 'r/general'}
Post Body:
"${post.content}"

Peer Discussion Excerpts (${comments.length} comments total):
${commentsSnippet || '(No comments yet; summarize the core thesis of the post.)'}

Format your response in crisp markdown with these three distinct sections:
### 📌 Core Synopsis
(1-2 sentence high-level executive summary)

### ⚖️ Key Arguments & Discussion Points
(2-3 bullet points highlighting main insights, consensus, or debate)

### 💡 Sovereign Node Takeaway
(Actionable takeaway or technological implication for node operators)
`;

  try {
    // Attempt fast local dual inference or BYOK
    const response = await queryUniversalInference({
      prompt,
      systemPrompt: 'You are an elite, concise, and highly analytical AI intelligence officer for decentralized sovereign networks.',
      modelRole: 'nova',
      temperature: 0.3,
    });
    return response?.trim() || null;
  } catch (err) {
    console.warn('[SocialAI] Primary inference failed, falling back to dualInference Nova:', err);
    try {
      const fallback = await dualInference.queryNova(prompt, { max_tokens: 600 });
      return fallback?.trim() || null;
    } catch (fErr) {
      console.warn('[SocialAI] All inference attempts failed:', fErr);
      return `### 📌 Core Synopsis\n${post.content.slice(0, 180)}...\n\n### ⚖️ Discussion Note\nThread active with ${comments.length} peer transmission(s) on ${post.subAura || 'the mesh'}.`;
    }
  }
}

/**
 * Generate an AI Smart Reply for a post or discussion
 */
export async function generateSmartReply({ post, comments = [], tone = 'insightful' }) {
  if (!post) return '';

  const toneInstructions = {
    insightful: 'Provide a thoughtful, nuanced technical perspective that adds depth to the conversation.',
    analytical: 'Break down the claims logically, offering data points, trade-offs, and architectural considerations.',
    supportive: 'Offer enthusiastic encouragement, validating good ideas and sharing constructive additions.',
    provocative: 'Play devil\'s advocate politely, questioning hidden assumptions or highlighting alternative paradigms.',
  };

  const selectedTone = toneInstructions[tone] || toneInstructions.insightful;

  const prompt = `You are a knowledgeable sovereign node engineer contributing to a peer social discussion on ${post.subAura || 'r/general'}.
The post is:
"${post.title ? post.title + '\n' : ''}${post.content}"

Tone: ${selectedTone}

Write a natural, engaging peer response (2-4 sentences). Do NOT use generic AI filler like "Great post!" or "As an AI". Sound like a genuine, high-agency engineer or creator.`;

  try {
    const res = await queryUniversalInference({
      prompt,
      systemPrompt: 'You are an authentic, skilled decentralized systems practitioner.',
      modelRole: 'nova',
      temperature: 0.7,
    });
    return res?.trim() || '';
  } catch (err) {
    try {
      return await dualInference.queryNova(prompt, { max_tokens: 250 });
    } catch {
      return 'Fascinating architecture. How does this scale under high latency mesh peer connections?';
    }
  }
}

/**
 * Enhance and polish a drafted social post
 */
export async function enhanceSocialPost({ draftTitle = '', draftContent = '', postType = 'wall', subAura = 'r/general' }) {
  if (!draftContent.trim() && !draftTitle.trim()) return null;

  const prompt = `You are an expert social media and technical copywriter for a high-tech decentralized network (Facebook meets Reddit meets YouTube on a P2P mesh).
A user is drafting a ${postType} post for ${subAura}:

Current Title: "${draftTitle}"
Current Content:
"${draftContent}"

Enhance this draft:
1. If title is needed or provided, make it punchy, engaging, and clear (no clickbait).
2. Clean up formatting, improve readability with line breaks or bullet points if appropriate.
3. Suggest 2-3 relevant hashtags at the bottom (e.g. #LocalLLM #MeshCompute #Wan21).

Return your response in valid JSON with this exact structure:
{
  "title": "Enhanced Title",
  "content": "Enhanced Content Body",
  "flair": "Suggested Reddit flair (e.g. Workflow, Discussion, Showcase, Tutorial, Benchmark)"
}
`;

  try {
    const raw = await queryUniversalInference({
      prompt,
      systemPrompt: 'Respond only with the requested JSON object.',
      modelRole: 'nova',
      temperature: 0.4,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      title: draftTitle || 'Sovereign Transmission',
      content: raw.trim() || draftContent,
      flair: 'Discussion',
    };
  } catch (err) {
    console.warn('[SocialAI] Enhance post failed:', err);
    return {
      title: draftTitle,
      content: draftContent,
      flair: 'Discussion',
    };
  }
}
