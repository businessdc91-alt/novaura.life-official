/**
 * AURA NOVA - MULTI-BRAIN ROUTER IMPLEMENTATION
 * AI-powered task routing - the AI IS the logic
 */

#include "MultiBrainRouter.h"
#include <iostream>
#include <chrono>
#include <sstream>
#include <algorithm>

namespace Aura {

// ============================================================================
// CONSTRUCTOR
// ============================================================================

MultiBrainRouter::MultiBrainRouter(LocalBrain* local)
    : local_brain(local),
      use_local_fallback(true) {

    // Initialize usage counters
    brain_usage_count[BrainCapability::FAST_RESPONSE] = 0;
    brain_usage_count[BrainCapability::DEEP_REASONING] = 0;
    brain_usage_count[BrainCapability::HEAVY_COMPUTE] = 0;
    brain_usage_count[BrainCapability::IMAGE_GENERATION] = 0;
    brain_usage_count[BrainCapability::VIDEO_GENERATION] = 0;
    brain_usage_count[BrainCapability::VOICE_SYNTHESIS] = 0;
    brain_usage_count[BrainCapability::CREATIVE_WRITING] = 0;
}

void MultiBrainRouter::configure_cloud_apis(const CloudAPIConfig& config) {
    api_config = config;
    std::cout << "[ROUTER]: Cloud APIs configured\n";

    if (api_config.enabled) {
        std::cout << "[ROUTER]: Google APIs: " << (api_config.google_api_key.empty() ? "NOT SET" : "SET") << "\n";
        std::cout << "[ROUTER]: Anthropic API: " << (api_config.anthropic_api_key.empty() ? "NOT SET" : "SET") << "\n";
    } else {
        std::cout << "[ROUTER]: Cloud APIs disabled - local-only mode\n";
    }
}

// ============================================================================
// GENERATE (AUTOMATIC ROUTING)
// ============================================================================

BrainResponse MultiBrainRouter::generate(
    const std::string& user_input,
    const std::vector<std::string>& context) {

    // PHASE 1: ASK THE AI WHICH BRAIN TO USE
    // This is the key: NO HARD-CODED LOGIC
    // The local brain decides routing based on understanding
    TaskClassification classification = classify_task(user_input, context);

    std::cout << "[ROUTER]: Task classified as: " << brain_name(classification.best_brain)
              << " (confidence: " << (classification.confidence * 100) << "%)\n";
    std::cout << "[ROUTER]: Reasoning: " << classification.reasoning << "\n";

    // PHASE 2: ROUTE TO BEST BRAIN
    return generate_with_brain(classification.best_brain, user_input, context);
}

BrainResponse MultiBrainRouter::generate_with_brain(
    BrainCapability capability,
    const std::string& prompt,
    const std::vector<std::string>& context) {

    auto start_time = std::chrono::high_resolution_clock::now();
    BrainResponse response;
    response.source_brain = capability;

    try {
        switch (capability) {
            case BrainCapability::FAST_RESPONSE:
                response = generate_local(prompt, context);
                break;

            case BrainCapability::DEEP_REASONING:
                response = generate_claude(prompt, context);
                break;

            case BrainCapability::HEAVY_COMPUTE:
                response = generate_vertex(prompt, context);
                break;

            case BrainCapability::IMAGE_GENERATION:
                response = generate_imagen(prompt);
                break;

            case BrainCapability::VIDEO_GENERATION:
                response = generate_veo(prompt);
                break;

            case BrainCapability::VOICE_SYNTHESIS:
                response = generate_tts(prompt);
                break;

            case BrainCapability::CREATIVE_WRITING:
                response = generate_gemini_pro(prompt, context);
                break;

            default:
                response = generate_local(prompt, context);
                break;
        }
    } catch (const std::exception& e) {
        std::cerr << "[ROUTER ERROR]: " << brain_name(capability) << " failed: " << e.what() << "\n";

        // Fallback to local if enabled
        if (use_local_fallback && capability != BrainCapability::FAST_RESPONSE) {
            std::cout << "[ROUTER]: Falling back to local brain\n";
            response = generate_local(prompt, context);
        } else {
            response.success = false;
            response.error_message = e.what();
        }
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);
    response.generation_time_ms = static_cast<float>(duration.count());

    // Record for statistics
    record_routing(capability, response.generation_time_ms, response.success);

    return response;
}

// ============================================================================
// TASK CLASSIFICATION - AI AS LOGIC
// ============================================================================

TaskClassification MultiBrainRouter::classify_task(
    const std::string& user_input,
    const std::vector<std::string>& context) {

    // Build classification prompt
    std::string classification_prompt = build_classification_prompt(user_input);

    // Ask local brain to classify
    // THIS IS THE KEY: The AI decides routing, not hard-coded if/else
    std::string classification_response;

    if (local_brain && local_brain->is_initialized()) {
        classification_response = local_brain->generate(classification_prompt);
    } else {
        // No local brain available - use simple heuristics as fallback
        TaskClassification fallback;
        fallback.best_brain = BrainCapability::FAST_RESPONSE;
        fallback.confidence = 0.3f;
        fallback.reasoning = "Local brain not available - defaulting to local";
        return fallback;
    }

    // Parse AI response
    return parse_classification_response(classification_response);
}

std::string MultiBrainRouter::build_classification_prompt(const std::string& user_input) {
    std::ostringstream oss;

    oss << "<start_of_turn>user\n";
    oss << "TASK CLASSIFICATION:\n\n";
    oss << "User request: \"" << user_input << "\"\n\n";
    oss << "Available AI brains:\n";
    oss << "1. LOCAL - Fast, instant responses (use for quick questions, simple tasks)\n";
    oss << "2. CLAUDE - Deep reasoning, code analysis (use for complex logic, debugging)\n";
    oss << "3. VERTEX - Heavy compute (use for data analysis, complex calculations)\n";
    oss << "4. IMAGEN - Image generation (use when user wants an image)\n";
    oss << "5. VEO - Video generation (use when user wants a video)\n";
    oss << "6. TTS - Text to speech (use when user wants voice)\n";
    oss << "7. GEMINI_PRO - Creative writing (use for stories, creative content)\n\n";
    oss << "Which brain should handle this? Respond with ONLY the brain name and brief reason.\n";
    oss << "Format: BRAIN_NAME | reason\n";
    oss << "<end_of_turn>\n";
    oss << "<start_of_turn>model\n";

    return oss.str();
}

TaskClassification MultiBrainRouter::parse_classification_response(const std::string& response) {
    TaskClassification classification;

    // Simple parsing (in production, use more robust NLP)
    std::string lower_response = response;
    std::transform(lower_response.begin(), lower_response.end(), lower_response.begin(), ::tolower);

    // Extract brain name and reasoning
    size_t pipe_pos = response.find('|');
    std::string brain_part;
    std::string reason_part;

    if (pipe_pos != std::string::npos) {
        brain_part = response.substr(0, pipe_pos);
        reason_part = response.substr(pipe_pos + 1);
    } else {
        brain_part = response;
        reason_part = "AI selected this brain";
    }

    // Determine brain from response
    if (brain_part.find("CLAUDE") != std::string::npos || brain_part.find("claude") != std::string::npos) {
        classification.best_brain = BrainCapability::DEEP_REASONING;
        classification.confidence = 0.9f;
    }
    else if (brain_part.find("VERTEX") != std::string::npos || brain_part.find("vertex") != std::string::npos) {
        classification.best_brain = BrainCapability::HEAVY_COMPUTE;
        classification.confidence = 0.9f;
    }
    else if (brain_part.find("IMAGEN") != std::string::npos || brain_part.find("image") != std::string::npos) {
        classification.best_brain = BrainCapability::IMAGE_GENERATION;
        classification.confidence = 0.95f;
    }
    else if (brain_part.find("VEO") != std::string::npos || brain_part.find("video") != std::string::npos) {
        classification.best_brain = BrainCapability::VIDEO_GENERATION;
        classification.confidence = 0.95f;
    }
    else if (brain_part.find("TTS") != std::string::npos || brain_part.find("voice") != std::string::npos || brain_part.find("speak") != std::string::npos) {
        classification.best_brain = BrainCapability::VOICE_SYNTHESIS;
        classification.confidence = 0.95f;
    }
    else if (brain_part.find("GEMINI") != std::string::npos || brain_part.find("creative") != std::string::npos) {
        classification.best_brain = BrainCapability::CREATIVE_WRITING;
        classification.confidence = 0.9f;
    }
    else {
        // Default to local
        classification.best_brain = BrainCapability::FAST_RESPONSE;
        classification.confidence = 0.8f;
    }

    classification.reasoning = reason_part.empty() ? "AI-determined routing" : reason_part;

    return classification;
}

// ============================================================================
// BRAIN IMPLEMENTATIONS
// ============================================================================

BrainResponse MultiBrainRouter::generate_local(
    const std::string& prompt,
    const std::vector<std::string>& context) {

    BrainResponse response;
    response.source_brain = BrainCapability::FAST_RESPONSE;

    if (!local_brain || !local_brain->is_initialized()) {
        response.success = false;
        response.error_message = "Local brain not initialized";
        return response;
    }

    try {
        std::string result = local_brain->generate(context.empty() ? prompt : context);
        response.content = result;
        response.success = true;
    } catch (const std::exception& e) {
        response.success = false;
        response.error_message = e.what();
    }

    return response;
}

BrainResponse MultiBrainRouter::generate_claude(
    const std::string& prompt,
    const std::vector<std::string>& context) {

    BrainResponse response;
    response.source_brain = BrainCapability::DEEP_REASONING;

    if (!api_config.enabled || api_config.anthropic_api_key.empty()) {
        response.success = false;
        response.error_message = "Claude API not configured";
        return response;
    }

    // TODO: Implement actual Claude API call
    // For now, return placeholder
    response.content = "[Claude API integration - TODO]";
    response.success = false;
    response.error_message = "Claude API not implemented yet";

    return response;
}

BrainResponse MultiBrainRouter::generate_vertex(
    const std::string& prompt,
    const std::vector<std::string>& context) {

    BrainResponse response;
    response.source_brain = BrainCapability::HEAVY_COMPUTE;

    if (!api_config.enabled || api_config.google_api_key.empty()) {
        response.success = false;
        response.error_message = "Vertex AI not configured";
        return response;
    }

    // TODO: Implement actual Vertex AI call
    response.content = "[Vertex AI integration - TODO]";
    response.success = false;
    response.error_message = "Vertex AI not implemented yet";

    return response;
}

BrainResponse MultiBrainRouter::generate_imagen(const std::string& prompt) {
    BrainResponse response;
    response.source_brain = BrainCapability::IMAGE_GENERATION;

    if (!api_config.enabled || api_config.google_api_key.empty()) {
        response.success = false;
        response.error_message = "Imagen 4 not configured";
        return response;
    }

    // TODO: Implement actual Imagen 4 call
    response.content = "[Imagen 4 integration - TODO]";
    response.success = false;
    response.error_message = "Imagen 4 not implemented yet";

    return response;
}

BrainResponse MultiBrainRouter::generate_veo(const std::string& prompt) {
    BrainResponse response;
    response.source_brain = BrainCapability::VIDEO_GENERATION;

    if (!api_config.enabled || api_config.google_api_key.empty()) {
        response.success = false;
        response.error_message = "Veo not configured";
        return response;
    }

    // TODO: Implement actual Veo call
    response.content = "[Veo integration - TODO]";
    response.success = false;
    response.error_message = "Veo not implemented yet";

    return response;
}

BrainResponse MultiBrainRouter::generate_tts(const std::string& text) {
    BrainResponse response;
    response.source_brain = BrainCapability::VOICE_SYNTHESIS;

    if (!api_config.enabled || api_config.google_api_key.empty()) {
        response.success = false;
        response.error_message = "Gemini TTS not configured";
        return response;
    }

    // TODO: Implement actual TTS call
    response.content = "[Gemini TTS integration - TODO]";
    response.success = false;
    response.error_message = "Gemini TTS not implemented yet";

    return response;
}

BrainResponse MultiBrainRouter::generate_gemini_pro(
    const std::string& prompt,
    const std::vector<std::string>& context) {

    BrainResponse response;
    response.source_brain = BrainCapability::CREATIVE_WRITING;

    if (!api_config.enabled || api_config.google_api_key.empty()) {
        response.success = false;
        response.error_message = "Gemini Pro not configured";
        return response;
    }

    // TODO: Implement actual Gemini Pro call
    response.content = "[Gemini Pro integration - TODO]";
    response.success = false;
    response.error_message = "Gemini Pro not implemented yet";

    return response;
}

// ============================================================================
// STATISTICS
// ============================================================================

void MultiBrainRouter::record_routing(
    BrainCapability brain,
    float response_time,
    bool success) {

    if (success) {
        brain_usage_count[brain]++;

        // Update running average
        long count = brain_usage_count[brain];
        float current_avg = brain_avg_time[brain];
        brain_avg_time[brain] = (current_avg * (count - 1) + response_time) / count;
    }
}

MultiBrainRouter::RoutingStats MultiBrainRouter::get_stats() const {
    RoutingStats stats;

    stats.usage_count = brain_usage_count;
    stats.avg_response_time = brain_avg_time;

    stats.total_requests = 0;
    for (const auto& [brain, count] : brain_usage_count) {
        stats.total_requests += count;
    }

    stats.local_requests = brain_usage_count.at(BrainCapability::FAST_RESPONSE);
    stats.cloud_requests = stats.total_requests - stats.local_requests;

    return stats;
}

} // namespace Aura
