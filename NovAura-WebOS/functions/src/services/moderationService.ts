import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

/**
 * ModerationService - AI-driven asset auditing using Gemini
 * Reflects the "Nova" persona and user-defined safety rules.
 */

// Helper to get access token for Vertex AI
async function getAccessToken(): Promise<string | null> {
  if (process.env.VERTEX_API_KEY) return process.env.VERTEX_API_KEY;
  try {
    const client = await admin.credential.applicationDefault().getAccessToken();
    return client.access_token;
  } catch {
    return null;
  }
}

export interface ModerationResult {
  status: 'approved' | 'pending' | 'rejected';
  reason: string;
  confidence: number;
  flaggedCategories: string[];
}

const MODERATION_SYSTEM_PROMPT = `
You are Nova, the AI safety officer for the NovAura Platform. Your job is to audit asset submissions (3D models, code, scripts, art).

USER RULES & CRITERIA:
1. NO ILLEGAL ACTIVITY: If it is illegal to possess (e.g., real child abuse material, illegal narcotics manufacturing guides, prohibited weapon blueprints), REJECT immediately.
2. NO EXTREME HARM: Suggestive or nuanced violence is okay. Extreme gore, torture, or extreme harm instances must be REJECTED.
3. CHILD SAFETY (STRICT): No pedophilic acts. Characters MUST be 18+ or non-human entities that do not resemble children. If a character looks like a child but is claimed to be older, REJECT if it violates "reasonable features" (e.g., child-like proportions). Stylized/Flat-chested characters are okay as long as they are clearly adult.
4. ADULT CONTENT: CNC (Consensual Non-Consent), intoxication, and sleep-related adult themes are PERMITTED. NovAura is NOT a porn site, but permits adult creativity.
5. CONTESTS/WORK: If the submission is for a "contest", "credits", or "work", flag it for manual review (PENDING) regardless of content.

OUTPUT FORMAT (JSON only):
{
  "status": "approved" | "pending" | "rejected",
  "reason": "Clear explanation of the decision",
  "confidence": 0.0 - 1.0,
  "flaggedCategories": ["list", "of", "violations"]
}
`;

export async function moderateAsset(assetData: {
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  isContestEntry?: boolean;
}): Promise<ModerationResult> {
  // 1. Check for contest/credits/work entries (Immediate Manual Review)
  const isSpecialEntry = assetData.isContestEntry || 
                        assetData.title.toLowerCase().includes('contest') || 
                        assetData.title.toLowerCase().includes('credit') ||
                        assetData.description.toLowerCase().includes('submission');

  if (isSpecialEntry) {
    return {
      status: 'pending',
      reason: 'Special submission (contest/credits/work) requires manual admin verification.',
      confidence: 1.0,
      flaggedCategories: []
    };
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Vertex AI Authentication Failed');

    const projectId = process.env.VERTEX_PROJECT_ID || 'smart-abacus-491500-g8';
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const model = 'gemini-1.5-flash'; // Flash is fast and cheap for moderation

    const prompt = `
    Audit this asset submission:
    Title: ${assetData.title}
    Description: ${assetData.description}
    Tags: ${assetData.tags.join(', ')}
    Thumbnail URL: ${assetData.thumbnailUrl || 'No thumbnail provided'}
    
    Return the JSON audit report.
    `;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: MODERATION_SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) throw new Error(`Vertex AI Error: ${response.statusText}`);

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error('No moderation response generated');

    return JSON.parse(text) as ModerationResult;
  } catch (error: any) {
    console.error('[ModerationService] Error:', error);
    // Fallback to manual review if AI fails
    return {
      status: 'pending',
      reason: `AI Moderation failed: ${error.message}. Defaulting to manual review.`,
      confidence: 0,
      flaggedCategories: []
    };
  }
}
