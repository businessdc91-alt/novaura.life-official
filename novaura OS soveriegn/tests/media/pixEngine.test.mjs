import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRESET_CATEGORIES,
  VISUAL_PRESETS,
  VIDEO_MOTION_PRESETS,
  compilePresetPrompt,
  getPresetPreviewSvg,
} from '../../src/services/media/presetCatalog.js';
import {
  snapDimension,
  toAspectRatioString,
  toOpenAiSize,
  buildComfyTxt2ImgWorkflow,
  buildComfyImg2ImgWorkflow,
  buildComfyWanI2VWorkflow,
  parseComfyMediaOutputs,
  generateMultiCandidates,
  generateVideoFromImage,
} from '../../src/services/media/pixEngine.js';
import { setSecurityPolicyLocal } from '../../src/services/security/complianceService.js';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('presetCatalog compiles structured presets and generates valid offline SVG reference previews', () => {
  assert.ok(PRESET_CATEGORIES.length >= 6);
  assert.ok(VISUAL_PRESETS.length >= 14);
  assert.ok(VIDEO_MOTION_PRESETS.length >= 5);

  const af = VISUAL_PRESETS.find(p => p.id === 'action_figure_blister');
  assert.ok(af, 'action_figure_blister preset must exist');
  const compiled = compilePresetPrompt(af, {
    subject: 'a bearded engineer in a black hoodie',
    figureName: 'ARCHITECT ZERO',
    figureTagline: 'FOUNDERS EDITION',
    figureAccessories: 'mini server rack, neon mug, mechanical keyboard',
    figureBoxColor: 'matte carbon and cyan',
    extraDetails: 'dramatic rim glow',
  });
  assert.match(compiled.prompt, /ARCHITECT ZERO/);
  assert.match(compiled.prompt, /FOUNDERS EDITION/);
  assert.match(compiled.prompt, /mini server rack/);
  assert.match(compiled.prompt, /matte carbon and cyan/);
  assert.match(compiled.prompt, /dramatic rim glow/);

  for (const preset of VISUAL_PRESETS) {
    const svgUri = getPresetPreviewSvg(preset);
    assert.ok(svgUri.startsWith('data:image/svg+xml;charset=utf-8,'), `Invalid SVG preview for ${preset.id}`);
    assert.ok(decodeURIComponent(svgUri).includes('<svg'));
  }
});

test('ComfyUI txt2img, img2img (RepeatLatentBatch), and Wan 2.1 I2V workflow builders produce valid node graphs', () => {
  assert.equal(snapDimension(777, 1024, 64), 768);
  assert.equal(toAspectRatioString(1280, 720), '16:9');
  assert.equal(toAspectRatioString(768, 1088), '3:4');
  assert.equal(toOpenAiSize(1280, 720, 'gpt-image-1'), '1536x1024');

  const txt = buildComfyTxt2ImgWorkflow({
    prompt: 'cyberpunk oracle',
    width: 832,
    height: 1152,
    batchSize: 4,
    checkpointName: 'sd_xl_base_1.0.safetensors',
    seed: 12345,
  });
  assert.equal(txt['5'].inputs.batch_size, 4);
  assert.equal(txt['5'].inputs.width, 832);
  assert.equal(txt['5'].inputs.height, 1152);
  assert.equal(txt['3'].inputs.seed, 12345);

  const imgSingle = buildComfyImg2ImgWorkflow({
    prompt: 'anime style',
    imageFilename: 'portrait.png',
    denoise: 0.52,
    batchSize: 1,
    checkpointName: 'sd_xl_base_1.0.safetensors',
  });
  assert.equal(imgSingle['10'].class_type, 'LoadImage');
  assert.equal(imgSingle['13'], undefined);
  assert.deepEqual(imgSingle['3'].inputs.latent_image, ['12', 0]);

  const imgMulti = buildComfyImg2ImgWorkflow({
    prompt: 'pencil caricature',
    imageFilename: 'portrait.png',
    denoise: 0.64,
    batchSize: 4,
    checkpointName: 'sd_xl_base_1.0.safetensors',
  });
  assert.equal(imgMulti['13'].class_type, 'RepeatLatentBatch');
  assert.equal(imgMulti['13'].inputs.amount, 4);
  assert.deepEqual(imgMulti['3'].inputs.latent_image, ['13', 0]);

  const wan = buildComfyWanI2VWorkflow({
    prompt: 'slow orbital holo shimmer',
    imageFilename: 'card.png',
    frames: 35, // snaps to 4k+1 -> 37 or 33
  });
  assert.equal(wan['9'].class_type, 'WanImageToVideo');
  assert.equal((wan['9'].inputs.length - 1) % 4, 0);
  assert.equal(wan['12'].class_type, 'SaveAnimatedWEBP');

  const parsed = parseComfyMediaOutputs(
    {
      outputs: {
        '9': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] },
        '12': { gifs: [{ filename: 'clip.webp', subfolder: 'i2v', type: 'output' }] },
        '15': { videos: [{ filename: 'vid.mp4', subfolder: '', type: 'output' }] },
      },
    },
    'http://127.0.0.1:8188'
  );
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].kind, 'image');
  assert.equal(parsed[1].kind, 'animated');
  assert.equal(parsed[2].kind, 'video');
});

test('generateMultiCandidates supports ComfyUI img2img batch, Gemini multimodal edit, OpenAI edits, and enforces Air-Gap Lock', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. Air-Gap Lock must block cloud providers
    setSecurityPolicyLocal({ airGappedAiOnly: true });
    await assert.rejects(
      () => generateMultiCandidates({ provider: 'gemini', apiKey: 'test-key', prompt: 'test', count: 1 }),
      /Air-Gapped Local-Only AI/i
    );
    setSecurityPolicyLocal({ airGappedAiOnly: false });

    // 2. Local ComfyUI img2img multi-output (2 variations)
    let uploadedImage = false;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.endsWith('/upload/image')) {
        uploadedImage = true;
        return new Response(JSON.stringify({ name: 'uploaded_ref.png' }), { status: 200 });
      }
      if (u.endsWith('/prompt')) {
        const body = JSON.parse(init.body);
        assert.equal(body.prompt['10'].inputs.image, 'uploaded_ref.png');
        assert.equal(body.prompt['13'].inputs.amount, 2);
        return new Response(JSON.stringify({ prompt_id: 'pid_1' }), { status: 200 });
      }
      if (u.includes('/history/pid_1')) {
        return new Response(
          JSON.stringify({
            pid_1: {
              outputs: {
                '9': {
                  images: [
                    { filename: 'out_1.png', subfolder: '', type: 'output' },
                    { filename: 'out_2.png', subfolder: '', type: 'output' },
                  ],
                },
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    };

    const comfyCands = await generateMultiCandidates({
      provider: 'comfy',
      prompt: 'anime portrait',
      referenceImageUrl: TINY_PNG_DATA_URL,
      checkpointName: 'sd_xl_base_1.0.safetensors',
      comfyEndpoint: 'http://127.0.0.1:8199',
      count: 2,
      seed: 100,
    });
    assert.equal(uploadedImage, true);
    assert.equal(comfyCands.length, 2);
    assert.equal(comfyCands[0].seed, 100);
    assert.equal(comfyCands[1].seed, 101);
    assert.equal(comfyCands[0].hasReference, true);

    // 3. Gemini Native Multimodal photo-to-action-figure edit
    let geminiCalls = 0;
    globalThis.fetch = async (url, init) => {
      geminiCalls += 1;
      assert.match(String(url), /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash-image:generateContent/);
      const body = JSON.parse(init.body);
      assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
      assert.ok(body.contents[0].parts.some(p => p.inlineData?.mimeType === 'image/png'));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }],
              },
            },
          ],
        }),
        { status: 200 }
      );
    };

    const geminiCands = await generateMultiCandidates({
      provider: 'gemini',
      apiKey: 'AIzaTestKey',
      model: 'gemini-2.5-flash-image',
      prompt: 'collector action figure blister pack',
      referenceImageUrl: TINY_PNG_DATA_URL,
      count: 2,
    });
    assert.equal(geminiCalls, 2);
    assert.equal(geminiCands.length, 2);
    assert.ok(geminiCands[0].url.startsWith('data:image/png;base64,'));

    // 4. OpenAI multipart /images/edits photo transform
    let openAiEditCalled = false;
    globalThis.fetch = async (url, init) => {
      openAiEditCalled = true;
      assert.match(String(url), /\/v1\/images\/edits$/);
      assert.ok(init.body instanceof FormData);
      return new Response(
        JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }, { b64_json: 'iVBORw0KGgo=' }] }),
        { status: 200 }
      );
    };

    const openaiCands = await generateMultiCandidates({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-image-1',
      prompt: 'hand-drawn pencil caricature',
      referenceImageUrl: TINY_PNG_DATA_URL,
      count: 2,
    });
    assert.equal(openAiEditCalled, true);
    assert.equal(openaiCands.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    setSecurityPolicyLocal({ airGappedAiOnly: false });
  }
});

test('generateVideoFromImage supports ComfyUI Wan 2.1 I2V and Custom BYOK video API', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. ComfyUI Wan 2.1 I2V
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.endsWith('/upload/image')) return new Response(JSON.stringify({ name: 'keyframe.png' }), { status: 200 });
      if (u.endsWith('/prompt')) return new Response(JSON.stringify({ prompt_id: 'i2v_1' }), { status: 200 });
      if (u.includes('/history/i2v_1')) {
        return new Response(
          JSON.stringify({
            i2v_1: { outputs: { '12': { gifs: [{ filename: 'holo.webp', subfolder: '', type: 'output' }] } } },
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    };

    const wanRes = await generateVideoFromImage({
      provider: 'comfy_wan',
      imageUrl: TINY_PNG_DATA_URL,
      prompt: 'prismatic foil shimmer orbit',
      comfyEndpoint: 'http://127.0.0.1:8199',
    });
    assert.equal(wanRes.kind, 'animated');
    assert.match(wanRes.url, /holo\.webp/);

    // 2. Custom BYOK Video API
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ video_url: 'https://cdn.example.com/clip.mp4' }), { status: 200 });

    const customRes = await generateVideoFromImage({
      provider: 'custom_video',
      imageUrl: TINY_PNG_DATA_URL,
      prompt: 'cinematic dolly zoom',
      customEndpointUrl: 'https://api.example.com/v1/i2v',
      apiKey: 'secret-token',
    });
    assert.equal(customRes.kind, 'video');
    assert.equal(customRes.url, 'https://cdn.example.com/clip.mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
