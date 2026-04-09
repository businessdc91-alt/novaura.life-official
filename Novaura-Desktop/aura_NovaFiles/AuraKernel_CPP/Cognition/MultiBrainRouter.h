/**
 * AURA NOVA - MULTI-BRAIN ROUTER
 * Routes tasks to appropriate AI capability based on context
 *
 * The AI determines routing - we just provide the options
 *
 * 7 AI Brains:
 * 1. Local (Gemma 3 4B IT) - Fast, embedded, instant
 * 2. Vertex AI - Heavy compute, complex analysis
 * 3. Claude API - Deep reasoning, code analysis
 * 4. Imagen 4 - Image generation
 * 5. Veo - Video generation
 * 6. Gemini TTS - Voice synthesis
 * 7. Gemini Pro - Creative writing, storytelling
 */

#pragma once
#include "../Core/AuraTypes.h"
#include "LocalBrain.h"
#include <string>
#include <vector>
#include <memory>
#include <map>
#include <functional>

namespace Aura {

/**
 * BrainCapability - What each brain is good at
 */
enum class BrainCapability {
    FAST_RESPONSE,          // Local - instant answers
    DEEP_REASONING,         // Claude - complex analysis
    HEAVY_COMPUTE,          // Vertex - powerful processing
    IMAGE_GENERATION,       // Imagen - visuals
    VIDEO_GENERATION,       // Veo - videos
    VOICE_SYNTHESIS,        // TTS - speech
    CREATIVE_WRITING        // Gemini Pro - storytelling
};

/**
 * TaskClassification - What type of task is this?
 * The AI determines this from context
 */
struct TaskClassification {
    BrainCapability best_brain;
    float confidence;
    std::string reasoning;

    TaskClassification()
        : best_brain(BrainCapability::FAST_RESPONSE),
          confidence(0.5f) {}
};

/**
 * BrainResponse - Result from any brain
 */
struct BrainResponse {
    std::string content;
    BrainCapability source_brain;
    float generation_time_ms;
    bool success;
    std::string error_message;

    BrainResponse()
        : source_brain(BrainCapability::FAST_RESPONSE),
          generation_time_ms(0.0f),
          success(false) {}
};

/**
 * CloudAPIConfig - Configuration for cloud APIs
 */
struct CloudAPIConfig {
    std::string google_api_key;
    std::string google_project_id;
    std::string anthropic_api_key;
    bool enabled;

    CloudAPIConfig() : enabled(false) {}
};

/**
 * MultiBrainRouter - Intelligent task routing
 *
 * The router uses the LOCAL brain to classify tasks,
 * then routes to the appropriate specialized brain.
 *
 * NO HARD-CODED RULES - the AI decides routing based on:
 * - Task complexity
 * - Response time requirements
 * - Content type (text/image/video/voice)
 * - Current context
 * - Past performance
 */
class MultiBrainRouter {
private:
    // LOCAL BRAIN (always available)
    LocalBrain* local_brain;

    // CLOUD API CONFIG
    CloudAPIConfig api_config;

    // ROUTING STATISTICS
    std::map<BrainCapability, long> brain_usage_count;
    std::map<BrainCapability, float> brain_avg_time;

    // FALLBACK BEHAVIOR
    bool use_local_fallback;

public:
    /**
     * Constructor
     * @param local Local brain instance
     */
    MultiBrainRouter(LocalBrain* local);

    /**
     * Configure cloud APIs
     * @param config API keys and settings
     */
    void configure_cloud_apis(const CloudAPIConfig& config);

    /**
     * Generate response (automatic routing)
     *
     * The AI classifies the task and routes to best brain
     *
     * @param user_input User's message
     * @param context Conversation context
     * @return Response from appropriate brain
     */
    BrainResponse generate(
        const std::string& user_input,
        const std::vector<std::string>& context = {}
    );

    /**
     * Generate with explicit brain selection
     * (Use when you KNOW which brain you need)
     *
     * @param capability Specific brain to use
     * @param prompt Input prompt
     * @param context Optional context
     * @return Response from specified brain
     */
    BrainResponse generate_with_brain(
        BrainCapability capability,
        const std::string& prompt,
        const std::vector<std::string>& context = {}
    );

    /**
     * Classify task (determine best brain)
     *
     * Uses local brain to analyze the task and decide routing
     * This is where AI-as-logic happens!
     *
     * @param user_input The task/question
     * @param context Conversation context
     * @return Classification with best brain + reasoning
     */
    TaskClassification classify_task(
        const std::string& user_input,
        const std::vector<std::string>& context = {}
    );

    /**
     * Get routing statistics
     */
    struct RoutingStats {
        std::map<BrainCapability, long> usage_count;
        std::map<BrainCapability, float> avg_response_time;
        long total_requests;
        long local_requests;
        long cloud_requests;
    };

    RoutingStats get_stats() const;

    /**
     * Enable/disable local fallback
     * If true, falls back to local brain if cloud APIs fail
     */
    void set_local_fallback(bool enabled) { use_local_fallback = enabled; }

private:
    /**
     * Generate with local brain
     */
    BrainResponse generate_local(
        const std::string& prompt,
        const std::vector<std::string>& context
    );

    /**
     * Generate with Vertex AI (Google Cloud)
     */
    BrainResponse generate_vertex(
        const std::string& prompt,
        const std::vector<std::string>& context
    );

    /**
     * Generate with Claude API
     */
    BrainResponse generate_claude(
        const std::string& prompt,
        const std::vector<std::string>& context
    );

    /**
     * Generate image with Imagen 4
     */
    BrainResponse generate_imagen(const std::string& prompt);

    /**
     * Generate video with Veo
     */
    BrainResponse generate_veo(const std::string& prompt);

    /**
     * Generate voice with Gemini TTS
     */
    BrainResponse generate_tts(const std::string& text);

    /**
     * Generate creative content with Gemini Pro
     */
    BrainResponse generate_gemini_pro(
        const std::string& prompt,
        const std::vector<std::string>& context
    );

    /**
     * Record routing decision (for learning)
     */
    void record_routing(
        BrainCapability brain,
        float response_time,
        bool success
    );

    /**
     * Build classification prompt
     * Asks local brain: "Which brain should handle this?"
     */
    std::string build_classification_prompt(
        const std::string& user_input
    );

    /**
     * Parse classification response
     */
    TaskClassification parse_classification_response(
        const std::string& response
    );
};

/**
 * Helper function - Get brain name as string
 */
inline std::string brain_name(BrainCapability brain) {
    switch (brain) {
        case BrainCapability::FAST_RESPONSE: return "Local (Gemma 3)";
        case BrainCapability::DEEP_REASONING: return "Claude";
        case BrainCapability::HEAVY_COMPUTE: return "Vertex AI";
        case BrainCapability::IMAGE_GENERATION: return "Imagen 4";
        case BrainCapability::VIDEO_GENERATION: return "Veo";
        case BrainCapability::VOICE_SYNTHESIS: return "Gemini TTS";
        case BrainCapability::CREATIVE_WRITING: return "Gemini Pro";
        default: return "Unknown";
    }
}

} // namespace Aura
