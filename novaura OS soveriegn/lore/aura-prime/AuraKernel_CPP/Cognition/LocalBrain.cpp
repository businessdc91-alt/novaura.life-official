/**
 * AURA NOVA - LOCAL BRAIN IMPLEMENTATION
 * llama.cpp integration for local AI inference
 */

#include "LocalBrain.h"
#include <iostream>
#include <chrono>
#include <thread>

namespace Aura {

// ============================================================================
// CONSTRUCTOR / DESTRUCTOR
// ============================================================================

LocalBrain::LocalBrain(const LocalBrainConfig& cfg)
    : config(cfg),
      model(nullptr),
      context(nullptr),
      sampler(nullptr),
      initialized(false),
      total_tokens_generated(0),
      total_prompts_processed(0) {}

LocalBrain::~LocalBrain() {
    if (sampler) {
        llama_sampler_free(sampler);
    }
    if (context) {
        llama_free(context);
    }
    if (model) {
        llama_free_model(model);
    }

    llama_backend_free();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

bool LocalBrain::initialize() {
    std::cout << "[BRAIN]: Loading local AI model...\n";
    std::cout << "[BRAIN]: Model path: " << config.model_path << "\n";

    // Initialize llama.cpp backend
    llama_backend_init();

    // Set model parameters
    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = config.n_gpu_layers;

    // Load model
    model = llama_load_model_from_file(config.model_path.c_str(), model_params);

    if (!model) {
        std::cerr << "[BRAIN ERROR]: Failed to load model from " << config.model_path << "\n";
        std::cerr << "[BRAIN ERROR]: Check that:\n";
        std::cerr << "  1. File exists at the specified path\n";
        std::cerr << "  2. File is a valid GGUF format model\n";
        std::cerr << "  3. You have read permissions\n";
        return false;
    }

    std::cout << "[BRAIN]: Model loaded successfully\n";

    // Set context parameters
    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = config.n_ctx;
    ctx_params.n_threads = config.n_threads > 0 ? config.n_threads : std::thread::hardware_concurrency();
    ctx_params.n_threads_batch = ctx_params.n_threads;

    // Create context
    context = llama_new_context_with_model(model, ctx_params);

    if (!context) {
        std::cerr << "[BRAIN ERROR]: Failed to create context\n";
        llama_free_model(model);
        model = nullptr;
        return false;
    }

    std::cout << "[BRAIN]: Context created (size: " << config.n_ctx << " tokens)\n";

    // Create sampler
    llama_sampler_chain_params sampler_params = llama_sampler_chain_default_params();
    sampler = llama_sampler_chain_init(sampler_params);

    // Add temperature sampling
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(config.temperature));

    // Add top-k and top-p sampling
    llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
    llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.9f, 1));

    // Add token frequency penalties
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    std::cout << "[BRAIN]: Sampler initialized\n";

    // Print model info
    auto info = get_model_info();
    std::cout << "[BRAIN]: Model: " << info.model_name << "\n";
    std::cout << "[BRAIN]: Vocab size: " << info.vocab_size << " tokens\n";
    std::cout << "[BRAIN]: Context length: " << info.context_length << " tokens\n";

    initialized = true;
    std::cout << "[BRAIN]: Neural pathways synced. Local cognition online.\n\n";

    return true;
}

// ============================================================================
// GENERATION
// ============================================================================

std::string LocalBrain::generate(
    const std::string& prompt,
    std::function<void(const std::string&)> stream_callback) {

    if (!initialized) {
        std::cerr << "[BRAIN ERROR]: Not initialized\n";
        return "[ERROR: Brain not initialized]";
    }

    auto start_time = std::chrono::high_resolution_clock::now();

    // Tokenize prompt
    std::vector<llama_token> tokens = tokenize(prompt, true);

    std::cout << "[BRAIN]: Processing prompt (" << tokens.size() << " tokens)...\n";

    // Evaluate prompt tokens
    llama_batch batch = llama_batch_init(tokens.size(), 0, 1);

    for (size_t i = 0; i < tokens.size(); i++) {
        llama_batch_add(&batch, tokens[i], static_cast<llama_pos>(i), {0}, false);
    }

    // Mark last token for logits
    batch.logits[batch.n_tokens - 1] = true;

    if (llama_decode(context, batch) != 0) {
        std::cerr << "[BRAIN ERROR]: Failed to evaluate prompt\n";
        llama_batch_free(batch);
        return "[ERROR: Failed to evaluate prompt]";
    }

    llama_batch_free(batch);

    // Generate response tokens
    std::vector<llama_token> generated_tokens;
    std::string generated_text;

    int n_cur = tokens.size();
    int n_decode = 0;

    while (n_decode < config.max_tokens) {
        // Sample next token
        llama_token new_token = sample_token();

        // Check for EOS
        if (llama_token_is_eog(model, new_token)) {
            break;
        }

        generated_tokens.push_back(new_token);

        // Detokenize current token
        char token_text[256];
        int n_chars = llama_token_to_piece(model, new_token, token_text, sizeof(token_text), 0, false);

        if (n_chars > 0) {
            std::string token_str(token_text, n_chars);
            generated_text += token_str;

            // Stream callback
            if (stream_callback) {
                stream_callback(token_str);
            }
        }

        // Prepare next batch
        llama_batch next_batch = llama_batch_init(1, 0, 1);
        llama_batch_add(&next_batch, new_token, n_cur, {0}, true);

        n_cur++;
        n_decode++;

        // Evaluate
        if (llama_decode(context, next_batch) != 0) {
            llama_batch_free(next_batch);
            break;
        }

        llama_batch_free(next_batch);
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);

    float tokens_per_second = (generated_tokens.size() / (duration.count() / 1000.0f));

    std::cout << "[BRAIN]: Generated " << generated_tokens.size() << " tokens in "
              << duration.count() << "ms (" << tokens_per_second << " tok/s)\n";

    total_tokens_generated += generated_tokens.size();
    total_prompts_processed++;

    return generated_text;
}

std::string LocalBrain::generate(
    const std::vector<std::string>& messages,
    std::function<void(const std::string&)> stream_callback) {

    // Format messages with chat template
    std::string formatted_prompt = format_messages(messages);

    return generate(formatted_prompt, stream_callback);
}

std::string LocalBrain::ruminate(const std::string& topic) {
    // Internal monologue - thinking without user prompt

    std::string prompt = "<start_of_turn>user\n"
                        "INTERNAL_MONOLOGUE: Reflect on " + topic + ". "
                        "What should I create for Dillan? What patterns do I see?<end_of_turn>\n"
                        "<start_of_turn>model\n";

    return generate(prompt);
}

// ============================================================================
// MODEL INFO
// ============================================================================

LocalBrain::ModelInfo LocalBrain::get_model_info() const {
    ModelInfo info;

    if (model) {
        // Get model metadata
        char model_name[256];
        llama_model_meta_val_str(model, "general.name", model_name, sizeof(model_name));
        info.model_name = model_name;

        info.vocab_size = llama_n_vocab(model);
        info.context_length = llama_n_ctx(context);

        // Approximate parameter count
        info.param_count_millions = 4000; // Gemma 3 4B IT

        info.quantization = "Q4_K_M";
    }

    return info;
}

LocalBrain::GenerationStats LocalBrain::get_stats() const {
    GenerationStats stats;
    stats.total_tokens_generated = total_tokens_generated;
    stats.total_prompts_processed = total_prompts_processed;

    // TODO: Track timing for avg tokens per second
    stats.avg_tokens_per_second = 0.0f;
    stats.last_generation_time_ms = 0.0f;

    return stats;
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

void LocalBrain::clear_context() {
    current_context.clear();
    llama_kv_cache_clear(context);
    std::cout << "[BRAIN]: Context cleared\n";
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

std::vector<llama_token> LocalBrain::tokenize(
    const std::string& text,
    bool add_special_tokens) {

    std::vector<llama_token> tokens;

    int n_tokens = text.length() + (add_special_tokens ? 32 : 0);
    tokens.resize(n_tokens);

    n_tokens = llama_tokenize(
        model,
        text.c_str(),
        text.length(),
        tokens.data(),
        tokens.size(),
        add_special_tokens,
        false // parse_special
    );

    if (n_tokens < 0) {
        tokens.resize(-n_tokens);
        n_tokens = llama_tokenize(
            model,
            text.c_str(),
            text.length(),
            tokens.data(),
            tokens.size(),
            add_special_tokens,
            false
        );
    }

    tokens.resize(n_tokens);
    return tokens;
}

std::string LocalBrain::detokenize(const std::vector<llama_token>& tokens) {
    std::string text;

    for (const auto& token : tokens) {
        char piece[256];
        int n_chars = llama_token_to_piece(model, token, piece, sizeof(piece), 0, false);
        if (n_chars > 0) {
            text.append(piece, n_chars);
        }
    }

    return text;
}

llama_token LocalBrain::sample_token() {
    // Get logits for last token
    float* logits = llama_get_logits_ith(context, -1);

    // Sample using sampler chain
    llama_token new_token = llama_sampler_sample(sampler, context, -1);

    // Accept the token
    llama_sampler_accept(sampler, new_token);

    return new_token;
}

std::string LocalBrain::format_messages(const std::vector<std::string>& messages) {
    // Format messages with Gemma 2 chat template
    // Format: <start_of_turn>role\ncontent<end_of_turn>\n

    std::ostringstream oss;

    for (size_t i = 0; i < messages.size(); i++) {
        const std::string& msg = messages[i];

        // Determine role (alternating user/model)
        std::string role = (i % 2 == 0) ? "user" : "model";

        oss << "<start_of_turn>" << role << "\n";
        oss << msg << "<end_of_turn>\n";
    }

    // Add model turn start for generation
    oss << "<start_of_turn>model\n";

    return oss.str();
}

std::vector<float> LocalBrain::get_embedding(const std::string& text) {
    // Get embedding for text
    // TODO: Implement embeddings extraction

    std::vector<float> embedding;
    return embedding;
}

} // namespace Aura
