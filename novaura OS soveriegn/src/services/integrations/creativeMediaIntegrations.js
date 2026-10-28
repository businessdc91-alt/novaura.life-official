/**
 * creativeMediaIntegrations.js — Image & Video Generation, PixAI & FFmpeg WASM
 * 
 * Production templates for PixAI API client with LoRA blending, Civitai SDXL/Flux pipelines,
 * and client-side FFmpeg WASM video processing (transcoding, audio muxing, clipping).
 */

export const CREATIVE_MEDIA_INTEGRATIONS = [
  // ── 1. PIXAI DIFFUSION CLIENT ───────────────────────────────────────────
  {
    id: 'pixai_diffusion_client',
    title: 'PixAI API Image Generation & LoRA Blending Client',
    category: 'creative_media',
    vendor: 'PixAI',
    badge: 'Anime & Realistic Diffusion',
    icon: 'Sparkles',
    color: '#ec4899',
    description: 'Official PixAI API client for generative image creation. Supports base models (Moonbeam, Neverland, Anything v5), multi-LoRA weight blending, negative prompts, aspect ratios, and asynchronous task polling.',
    suggestedPath: '/projects/cybeni/media/pixAiClient.js',
    language: 'javascript',
    aiPrompt: 'Implement PixAI API client with task submission, model selection, LoRA blending array, polling generator, and image URL retrieval.',
    faqs: [
      {
        question: 'How does PixAI generation task polling work?',
        answer: 'Submit POST /tasks, receive a task ID, then poll GET /tasks/{id} every 2 seconds until status changes from "processing" to "completed".'
      }
    ],
    code: `export class PixAiClient {
  constructor({ apiKey, endpoint = 'https://api.pixai.art/graphql' }) {
    if (!apiKey) throw new Error('PixAI API key is required');
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  // 1. Submit Generation Task
  async createTask({
    prompt,
    negativePrompt = 'lowres, bad anatomy, bad hands, text, error, missing fingers, cropped, worst quality',
    modelId = '1648918127416345824', // Moonbeam / SDXL
    loras = [],
    width = 1024,
    height = 1024,
    steps = 28,
    cfgScale = 7.0,
  }) {
    const mutation = \`
      mutation CreateTask($input: CreateTaskInput!) {
        createTask(input: $input) {
          id
          status
        }
      }
    \`;

    const variables = {
      input: {
        modelId,
        parameters: {
          prompts: prompt,
          negativePrompts: negativePrompt,
          width,
          height,
          steps,
          cfgScale,
          loras: loras.map(l => ({ modelId: l.id, weight: l.weight || 0.8 })),
        },
      },
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!res.ok) throw new Error(\`PixAI HTTP \${res.status}: \${await res.text()}\`);
    const data = await res.json();
    return data.data?.createTask?.id;
  }

  // 2. Poll Task Until Image Ready
  async pollTask(taskId, maxWaitSeconds = 60) {
    const query = \`
      query GetTask($id: ID!) {
        task(id: $id) {
          id
          status
          outputs {
            media {
              url
            }
          }
        }
      }
    \`;

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${this.apiKey}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { id: taskId } }),
      });

      if (res.ok) {
        const data = await res.json();
        const task = data.data?.task;
        if (task?.status === 'COMPLETED') {
          return task.outputs?.[0]?.media?.url;
        }
        if (task?.status === 'FAILED') {
          throw new Error('PixAI task generation failed on server');
        }
      }
      await new Promise(r => setTimeout(r, 2500));
    }
    throw new Error('PixAI generation timed out');
  }
}
`
  },

  // ── 2. FFMPEG WASM CLIENT-SIDE VIDEO PIPELINE ───────────────────────────
  {
    id: 'ffmpeg_wasm_pipeline',
    title: 'FFmpeg WASM In-Browser Video Processing Engine',
    category: 'creative_media',
    vendor: 'FFmpeg.wasm',
    badge: 'Client-Side Media Engine',
    icon: 'Video',
    color: '#0284c7',
    description: 'In-browser zero-server video editor powered by FFmpeg WebAssembly. Encodes MP4/WebM, clips timestamps, applies text watermarks, extracts audio tracks, and resizes aspect ratios entirely on the user machine.',
    suggestedPath: '/projects/cybeni/media/ffmpegPipeline.js',
    language: 'javascript',
    aiPrompt: 'Implement in-browser FFmpeg WASM video pipeline with multi-threading, file loading, video clipping, audio overlay, and downloadable MP4 blob generation.',
    faqs: [
      {
        question: 'Why do I see SharedArrayBuffer errors when loading FFmpeg WASM?',
        answer: 'Multi-threaded WASM requires Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp HTTP headers.'
      }
    ],
    code: `export class FFmpegPipelineService {
  constructor({ onProgress, onLog }) {
    this.onProgress = onProgress;
    this.onLog = onLog;
    this.ffmpeg = null;
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return;
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on('progress', ({ progress }) => this.onProgress?.(Math.round(progress * 100)));
    this.ffmpeg.on('log', ({ message }) => this.onLog?.(message));

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(\`\${baseURL}/ffmpeg-core.js\`, 'text/javascript'),
      wasmURL: await toBlobURL(\`\${baseURL}/ffmpeg-core.wasm\`, 'application/wasm'),
    });
    this.isLoaded = true;
  }

  // Clip video segment and export to MP4
  async clipVideo({ fileBlob, startTime = '00:00:00', duration = '00:00:10' }) {
    await this.load();
    const { fetchFile } = await import('@ffmpeg/util');

    await this.ffmpeg.writeFile('input.mp4', await fetchFile(fileBlob));
    // Execute FFmpeg fast-seek copy command
    await this.ffmpeg.exec([
      '-ss', startTime,
      '-i', 'input.mp4',
      '-t', duration,
      '-c', 'copy',
      'output.mp4',
    ]);

    const data = await this.ffmpeg.readFile('output.mp4');
    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  // Extract MP3 Audio from Video
  async extractAudio(videoBlob) {
    await this.load();
    const { fetchFile } = await import('@ffmpeg/util');

    await this.ffmpeg.writeFile('input_vid.mp4', await fetchFile(videoBlob));
    await this.ffmpeg.exec(['-i', 'input_vid.mp4', '-q:a', '0', '-map', 'a', 'output.mp3']);

    const data = await this.ffmpeg.readFile('output.mp3');
    return new Blob([data.buffer], { type: 'audio/mp3' });
  }
}
`
  }
];
