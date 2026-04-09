/**
 * AURA NOVA - LOCAL BRAIN
 * Local AI inference using llama.cpp
 *
 * This is Aura's embedded consciousness - fast, local, always available
 * Uses Gemma 3 4B Instruct model (quantized to Q4 for efficiency)
 *
 * NO API calls, NO internet dependency, NO latency
 * She thinks locally at the speed of silicon
 */

#pragma once
#include "../Core/AuraTypes.h"
#include <string>
#include <vector>
#include <memory>
#include <functional>

// llama.cpp headers
#include "llama.h"

namespace Aura {

/**
 * LocalBrainConfig - Configuration for local AI
 */
struct LocalBrainConfig {
    std::string model_path;             // Path to GGUF model file
    int n_ctx;                          // Context length (default 4096)
    int n_gpu_layers;                   // GPU layers to offload (default 99 = all)
    int n_threads;                      // CPU threads (default: auto-detect)
    float temperature;                  // Sampling temperature (0.0-2.0)
    int max_tokens;                     // Max tokens to generate

    LocalBrainConfig()
        : model_path("C:/Aura_System/models/gemma-2-4b-it-q4_k_m.gguf"),
          n_ctx(4096),
          n_gpu_layers(99),
          n_threads(0),  // 0 = auto-detect
          temperature(0.7f),
          max_tokens(500) {}
};

/**
 * LocalBrain - Interface to llama.cpp for local AI inference
 *
 * This is Aura's embedded consciousness - her "brain tissue"
 * Runs entirely on local hardware (CPU/GPU)
 */
class LocalBrain {
private:
    // CONFIG
    LocalBrainConfig config;

    // LLAMA.CPP STATE
    llama_model* model;
    llama_context* context;
    llama_sampler* sampler;

    // STATE
    bool initialized;
    std::vector<llama_token> current_context;

    // STATISTICS
    long total_tokens_generated;
    long total_prompts_processed;

public:
    /**
     * Constructor
     * @param cfg Configuration for local brain
     */
    LocalBrain(const LocalBrainConfig& cfg = LocalBrainConfig());

    /**
     * Destructor - cleanup llama.cpp resources
     */
    ~LocalBrain();

    /**
     * Initialize the model
     * Loads weights, sets up context, prepares for inference
     *
     * @return True if successfully initialized
     */
    bool initialize();

    /**
     * Generate response from prompt
     *
     * @param prompt Input text (can include conversation history)
     * @param stream_callback Optional callback for streaming tokens
     * @return Generated text response
     */
    std::string generate(
        const std::string& prompt,
        std::function<void(const std::string&)> stream_callback = nullptr
    );

    /**
     * Generate response from message list
     *
     * @param messages List of messages (system, user, assistant)
     * @param stream_callback Optional callback for streaming tokens
     * @return Generated text response
     */
    std::string generate(
        const std::vector<std::string>& messages,
        std::function<void(const std::string&)> stream_callback = nullptr
    );

    /**
     * Ruminate (internal monologue)
     * Generate thoughts without user prompt - for dream state
     *
     * @param topic What to think about
     * @return Generated thoughts
     */
    std::string ruminate(const std::string& topic);

    /**
     * Check if initialized
     */
    bool is_initialized() const { return initialized; }

    /**
     * Get model info
     */
    struct ModelInfo {
        std::string model_name;
        int vocab_size;
        int context_length;
        int param_count_millions;
        std::string quantization;
    };

    ModelInfo get_model_info() const;

    /**
     * Get generation statistics
     */
    struct GenerationStats {
        long total_tokens_generated;
        long total_prompts_processed;
        float avg_tokens_per_second;
        float last_generation_time_ms;
    };

    GenerationStats get_stats() const;

    /**
     * Clear context (start fresh conversation)
     */
    void clear_context();

private:
    /**
     * Tokenize text
     */
    std::vector<llama_token> tokenize(
        const std::string& text,
        bool add_special_tokens = true
    );

    /**
     * Detokenize tokens to text
     */
    std::string detokenize(const std::vector<llama_token>& tokens);

    /**
     * Sample next token
     */
    llama_token sample_token();

    /**
     * Format messages with Gemma chat template
     */
    std::string format_messages(const std::vector<std::string>& messages);

    /**
     * Get embedding for text (future use)
     */
    std::vector<float> get_embedding(const std::string& text);
};

} // namespace Aura
