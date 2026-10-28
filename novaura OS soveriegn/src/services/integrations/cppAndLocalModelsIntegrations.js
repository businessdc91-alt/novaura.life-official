/**
 * cppAndLocalModelsIntegrations.js — Embedded C++ & 2B to 35B Local Models Catalog
 * 
 * Production templates for embedding llama.cpp directly into C++20 / desktop / edge apps,
 * zero external daemon needed, zero-copy memory mapping, and Node.js N-API C++ bindings.
 */

export const CPP_AND_LOCAL_MODELS_INTEGRATIONS = [
  {
    id: 'cpp_llama_embedded_engine',
    title: 'Embedded C++20 llama.cpp In-App Inference Engine (2B to 35B GGUF)',
    category: 'embedded_cpp_ai',
    vendor: 'llama.cpp Native',
    badge: 'C++ Embedded Core',
    icon: 'Cpu',
    color: '#06b6d4',
    description: 'Direct C++20 embedded inference engine using libllama. Embeds Gemma 4 (E2B, E4B, 12B, 26B A4B MoE, 31B), Qwen3-Coder (30B MoE), Qwen 2.5 Coder (1.5B-32B), or Codestral (22B) directly into native apps without Ollama or external daemons.',
    suggestedPath: '/projects/cybeni/native/engine/llama_engine.hpp',
    language: 'cpp',
    aiPrompt: 'Scaffold an embedded C++20 inference engine using libllama. Configure GGUF model loading, context batching, KV caching, token streaming callbacks, and multi-threaded CPU/GPU dispatch.',
    faqs: [
      {
        question: 'How do 2B vs 35B models scale in memory with this C++ engine?',
        answer: 'A 2B edge model (e.g. Gemma 4 E2B or Qwen 2.5 Coder 1.5B) in Q4_K_M requires ~1.4GB RAM and runs at 100+ tok/s on CPU. A 26B-31B model (Gemma 4 26B A4B MoE or Gemma 4 31B Dense) in Q4_K_M requires ~16-19GB RAM and offloads layers to CUDA/Metal/Vulkan for 25-50 tok/s.'
      },
      {
        question: 'Does this require any background services or network ports?',
        answer: 'No. The model file (.gguf) is mapped directly into application memory via mmap(), eliminating inter-process latency and port conflicts.'
      },
      {
        question: 'How do I compile this with CMake?',
        answer: 'Link against llama (target_link_libraries(my_app PRIVATE llama)) and pass -DLLAMA_CUDA=ON or -DLLAMA_VULKAN=ON during CMake configuration.'
      }
    ],
    code: `#pragma once
/**
 * Sovereign C++20 Embedded LLM Inference Engine (llama.cpp)
 * Compatible with GGUF models: Gemma 4 (E2B, E4B, 12B, 26B A4B MoE, 31B), Qwen3-Coder (30B MoE), Qwen 2.5 Coder (1.5B-32B)
 */
#include "llama.h"
#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <stdexcept>
#include <iostream>

namespace sovereign::ai {

struct ModelConfig {
    std::string model_path;      // Path to .gguf file (e.g., ./models/qwen2.5-coder-14b-q4_k_m.gguf)
    int n_ctx = 8192;            // Context window size (tokens)
    int n_threads = 8;           // CPU evaluation threads
    int n_gpu_layers = 99;       // Offload layers to GPU (Vulkan, Metal, CUDA)
    float temperature = 0.2f;    // Sampling temperature for code generation
    float top_p = 0.95f;         // Top-P nucleus sampling
};

using TokenCallback = std::function<bool(const std::string& token)>;

class EmbeddedLlamaEngine {
public:
    explicit EmbeddedLlamaEngine(const ModelConfig& config) : config_(config) {
        init_backend();
        load_model();
    }

    ~EmbeddedLlamaEngine() {
        if (ctx_) llama_free(ctx_);
        if (model_) llama_free_model(model_);
        llama_backend_free();
    }

    // Non-copyable for RAII pointer safety
    EmbeddedLlamaEngine(const EmbeddedLlamaEngine&) = delete;
    EmbeddedLlamaEngine& operator=(const EmbeddedLlamaEngine&) = delete;

    /**
     * Generate text completions with streaming token callback
     */
    std::string generate(const std::string& prompt, TokenCallback on_token = nullptr) {
        if (!ctx_ || !model_) {
            throw std::runtime_error("Llama engine not initialized");
        }

        // 1. Tokenize prompt
        const int n_prompt_max = -llama_n_ctx(ctx_);
        std::vector<llama_token> tokens(config_.n_ctx);
        int n_tokens = llama_tokenize(model_, prompt.c_str(), prompt.length(), tokens.data(), tokens.size(), true, true);
        if (n_tokens < 0) {
            tokens.resize(-n_tokens);
            n_tokens = llama_tokenize(model_, prompt.c_str(), prompt.length(), tokens.data(), tokens.size(), true, true);
        }
        tokens.resize(n_tokens);

        // 2. Clear KV Cache for fresh generation
        llama_kv_cache_clear(ctx_);

        // 3. Batch evaluation
        llama_batch batch = llama_batch_init(tokens.size(), 0, 1);
        for (size_t i = 0; i < tokens.size(); ++i) {
            llama_batch_add(batch, tokens[i], i, { 0 }, false);
        }
        batch.logits[batch.n_tokens - 1] = true;

        if (llama_decode(ctx_, batch) != 0) {
            llama_batch_free(batch);
            throw std::runtime_error("Failed to decode initial prompt batch");
        }
        llama_batch_free(batch);

        // 4. Autoregressive Sampling Loop
        std::string full_response = "";
        llama_token curr_token = 0;
        int n_cur = tokens.size();

        while (n_cur < config_.n_ctx) {
            auto* logits = llama_get_logits_ith(ctx_, -1);
            const int n_vocab = llama_n_vocab(model_);

            std::vector<llama_token_data> candidates;
            candidates.reserve(n_vocab);
            for (llama_token token_id = 0; token_id < n_vocab; token_id++) {
                candidates.emplace_back(llama_token_data{ token_id, logits[token_id], 0.0f });
            }

            llama_token_data_array candidates_p = { candidates.data(), candidates.size(), false };

            // Sample token
            curr_token = llama_sample_token_greedy(ctx_, &candidates_p);

            // Check for EOS
            if (llama_token_is_eog(model_, curr_token)) break;

            // Convert to string
            char piece[128];
            const int n_chars = llama_token_to_piece(model_, curr_token, piece, sizeof(piece), 0, true);
            if (n_chars > 0) {
                std::string token_str(piece, n_chars);
                full_response += token_str;
                if (on_token && !on_token(token_str)) {
                    break; // Caller cancelled stream
                }
            }

            // Evaluate single next token
            llama_batch next_batch = llama_batch_get_one(&curr_token, 1);
            if (llama_decode(ctx_, next_batch) != 0) {
                break;
            }
            n_cur++;
        }

        return full_response;
    }

private:
    ModelConfig config_;
    llama_model* model_ = nullptr;
    llama_context* ctx_ = nullptr;

    void init_backend() {
        llama_backend_init();
    }

    void load_model() {
        llama_model_params mparams = llama_model_default_params();
        mparams.n_gpu_layers = config_.n_gpu_layers;
        mparams.use_mmap = true;

        model_ = llama_load_model_from_file(config_.model_path.c_str(), mparams);
        if (!model_) {
            throw std::runtime_error("Failed to load GGUF model: " + config_.model_path);
        }

        llama_context_params cparams = llama_context_default_params();
        cparams.n_ctx = config_.n_ctx;
        cparams.n_threads = config_.n_threads;
        cparams.n_threads_batch = config_.n_threads;

        ctx_ = llama_new_context_with_model(model_, cparams);
        if (!ctx_) {
            llama_free_model(model_);
            model_ = nullptr;
            throw std::runtime_error("Failed to initialize llama context");
        }
    }
};

} // namespace sovereign::ai
`
  },
  {
    id: 'cpp_node_addon_binding',
    title: 'Node.js N-API C++ Binding for Embedded LLM Inference',
    category: 'embedded_cpp_ai',
    vendor: 'Node-API (C++)',
    badge: 'Desktop / Native Glue',
    icon: 'Layers',
    color: '#10b981',
    description: 'Production C++ Node-API native addon that wraps the embedded llama.cpp engine, giving Node.js/Electron/Tauri apps synchronous or worker-thread token generation with zero HTTP overhead.',
    suggestedPath: '/projects/cybeni/native/binding/llama_addon.cpp',
    language: 'cpp',
    aiPrompt: 'Generate a production Node-API (node-addon-api) wrapper around the C++ embedded llama.cpp engine with async worker token streaming.',
    faqs: [
      {
        question: 'Why use a native C++ addon instead of calling an HTTP port?',
        answer: 'Native addons bypass HTTP socket overhead, eliminate JSON serialize/deserialize cycles, prevent port hijacking, and allow memory-mapped buffer sharing.'
      },
      {
        question: 'How do I build the addon in my project?',
        answer: 'Include "node-addon-api": "^8.0.0" in package.json and run "npx cmake-js compile" or "node-gyp rebuild".'
      }
    ],
    code: `/**
 * Node-API Native Addon: Embedded Llama.cpp JavaScript Bridge
 */
#include <napi.h>
#include "llama_engine.hpp"

class LlamaWorker : public Napi::AsyncProgressQueueWorker<std::string> {
public:
    LlamaWorker(Napi::Function& callback, 
                sovereign::ai::EmbeddedLlamaEngine* engine, 
                std::string prompt)
        : Napi::AsyncProgressQueueWorker<std::string>(callback),
          engine_(engine),
          prompt_(std::move(prompt)) {}

    void Execute(const ExecutionProgress& progress) override {
        engine_->generate(prompt_, [&progress](const std::string& token) {
            progress.Send(&token, 1);
            return true;
        });
    }

    void OnProgress(const std::string* data, size_t count) override {
        Napi::HandleScope scope(Env());
        for (size_t i = 0; i < count; ++i) {
            Callback().Call({ Env().Null(), Napi::String::New(Env(), data[i]), Napi::Boolean::New(Env(), false) });
        }
    }

    void OnOK() override {
        Napi::HandleScope scope(Env());
        Callback().Call({ Env().Null(), Napi::String::New(Env(), ""), Napi::Boolean::New(Env(), true) });
    }

private:
    sovereign::ai::EmbeddedLlamaEngine* engine_;
    std::string prompt_;
};

Napi::Value RunInferenceAsync(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsFunction()) {
        Napi::TypeError::New(env, "Expected: (modelPath, prompt, tokenCallback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string modelPath = info[0].As<Napi::String>().Utf8Value();
    std::string prompt = info[1].As<Napi::String>().Utf8Value();
    Napi::Function callback = info[2].As<Napi::Function>();

    static std::unique_ptr<sovereign::ai::EmbeddedLlamaEngine> engine = nullptr;
    if (!engine) {
        sovereign::ai::ModelConfig cfg;
        cfg.model_path = modelPath;
        engine = std::make_unique<sovereign::ai::EmbeddedLlamaEngine>(cfg);
    }

    auto* worker = new LlamaWorker(callback, engine.get(), prompt);
    worker->Queue();
    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("runInferenceAsync", Napi::Function::New(env, RunInferenceAsync));
    return exports;
}

NODE_API_MODULE(sovereign_llama, Init)
`
  }
];
