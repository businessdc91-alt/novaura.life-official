/**
 * PixAI Service - SECURE VERSION (Backend Proxy Only)
 * 
 * All PixAI API calls go through NovAura backend proxy.
 * NO API KEYS in frontend - keys are stored securely in Firebase Functions.
 * 
 * Backend routes used:
 * - POST /api/generation/image - Submit generation
 * - GET  /api/generation/status/:taskId - Check status
 * - POST /api/generation/poll - Wait for completion
 */

import { apiClient } from './apiClient';

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL CONFIGURATIONS (for reference - same as backend)
// ═══════════════════════════════════════════════════════════════════════════════

export const PIXAI_MODELS = {
  TSUBAKI_2: {
    id: '1983308862240288769',
    name: 'Tsubaki.2',
    type: 'DIT',
    url: 'https://pixai.art/model/1982880136609467518-Tsubaki.2',
    defaultSize: '768x1280',
    sizes: ['768x1280', '1024x1024', '896x1152', '1280x768'],
    description: 'Strong prompt understanding, seamless anatomy'
  },
  
  HARUKA_V2: {
    id: '1861558740588989558',
    name: 'Haruka v2',
    type: 'SDXL',
    url: 'https://pixai.art/model/1861558737426484240-Haruka-v2',
    defaultSize: '768x1280',
    sizes: ['768x1280', '1024x1024', '896x1152', '1280x768'],
    description: 'Stable quality, accurate hands'
  },
  
  HOSHINO_V2: {
    id: '1954632828118619567',
    name: 'Hoshino v2',
    type: 'SDXL',
    url: 'https://pixai.art/model/1954632827019711809-Hoshino-v2',
    defaultSize: '768x1280',
    sizes: ['768x1280', '1024x1024', '896x1152', '1280x768'],
    description: 'Popular Japanese style'
  }
};

const DEFAULT_MODEL_ID = PIXAI_MODELS.TSUBAKI_2.id;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  BASE_POLL_INTERVAL: 2000,
  MAX_POLL_INTERVAL: 10000,
  MAX_POLL_ATTEMPTS: 60,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function validatePrompt(prompt) {
  const blockedTerms = ['child', 'minor', 'underage', 'loli', 'shota'];
  const lower = prompt.toLowerCase();
  const violations = blockedTerms.filter(term => lower.includes(term));
  if (violations.length > 0) {
    return { valid: false, reason: 'Content policy violation', violations };
  }
  return { valid: true };
}

function getSizeFromAspectRatio(aspectRatio) {
  const sizeMap = {
    '1:1': '1024x1024',
    '9:16': '768x1280',
    '16:9': '1280x768',
    '3:4': '896x1152',
    '4:3': '1152x896',
    '2:3': '768x1152'
  };
  return sizeMap[aspectRatio] || '768x1280';
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURE API METHODS (via Backend Proxy)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit image generation task via secure backend proxy
 * NO API KEY in frontend - backend handles authentication
 */
export async function generateImage({
  prompt,
  modelId = DEFAULT_MODEL_ID,
  aspectRatio = '9:16',
  size,
  negativePrompt = '',
  mode = 'standard'
}) {
  // Validate
  const validation = validatePrompt(prompt);
  if (!validation.valid) {
    throw new Error(`Content blocked: ${validation.reason}`);
  }

  const finalSize = size || getSizeFromAspectRatio(aspectRatio);

  try {
    // Call backend proxy - NO API KEY needed here!
    const data = await apiClient.post('/generation/image', {
      prompt,
      modelId,
      aspectRatio,
      negativePrompt,
      mode
    });

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      id: data.taskId,
      taskId: data.taskId,
      status: data.status,
      createdAt: data.createdAt,
      success: data.success,
      message: data.message
    };
  } catch (err) {
    console.error('PixAI generation error:', err);
    throw err;
  }
}

/**
 * Check task status via backend proxy
 */
export async function checkTaskStatus(taskId) {
  try {
    const data = await apiClient.get(`/generation/status/${taskId}`);
    
    return {
      id: data.taskId,
      taskId: data.taskId,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      imageUrl: data.imageUrl,
      mediaUrls: data.mediaUrls || [],
      mediaIds: data.mediaIds || []
    };
  } catch (err) {
    console.error('Status check error:', err);
    throw err;
  }
}

/**
 * Poll until completion using backend convenience endpoint
 */
export async function waitForCompletion(taskId, options = {}) {
  const { maxAttempts = CONFIG.MAX_POLL_ATTEMPTS, onProgress } = options;

  try {
    const data = await apiClient.post('/generation/poll', {
      taskId,
      maxAttempts
    });

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      success: data.success,
      taskId: data.taskId,
      status: data.status,
      imageUrl: data.imageUrl,
      mediaUrls: data.mediaUrls || [],
      attempts: data.attempts
    };
  } catch (err) {
    console.error('Poll error:', err);
    throw err;
  }
}

/**
 * Generate and wait (convenience method)
 */
export async function generateAndWait(params, options = {}) {
  const { onProgress, onRetry } = options;

  // Submit generation
  const task = await generateImage(params);
  
  if (onProgress) {
    onProgress({ stage: 'submitted', taskId: task.taskId });
  }

  // Wait for completion
  const result = await waitForCompletion(task.taskId, {
    onProgress: (status) => {
      if (onProgress) {
        onProgress({ 
          stage: 'generating', 
          status: status.status,
          taskId: task.taskId 
        });
      }
    }
  });

  if (onProgress) {
    onProgress({ 
      stage: 'completed', 
      taskId: task.taskId,
      imageUrl: result.imageUrl 
    });
  }

  return result;
}

/**
 * Quick generate - simplest API for most use cases
 */
export async function quickGenerate(prompt, aspectRatio = '9:16') {
  return generateAndWait({ prompt, aspectRatio });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  generateImage,
  checkTaskStatus,
  waitForCompletion,
  generateAndWait,
  quickGenerate,
  PIXAI_MODELS
};
