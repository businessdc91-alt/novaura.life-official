/**
 * AURA NOVA - CLAUDE API CLIENT
 * Deep reasoning and code analysis
 *
 * Uses Anthropic's Claude API for complex tasks
 *
 * SAFETY:
 * - Rate limiting built-in
 * - Timeout protection
 * - Fallback to local brain on failure
 * - No infinite loops
 */

#pragma once
#include <string>
#include <vector>
#include <memory>
#include <chrono>

namespace Aura {

/**
 * ClaudeConfig - Configuration for Claude API
 */
struct ClaudeConfig {
    std::string api_key;
    std::string model;              // "claude-sonnet-4-5-20250929"
    int max_tokens;                 // Maximum response length
    float temperature;              // 0.0 - 1.0
    int timeout_seconds;            // Request timeout

    // SAFETY LIMITS
    int max_requests_per_minute;    // Rate limiting
    int max_retry_attempts;         // Prevent infinite retry loops

    ClaudeConfig()
        : model("claude-sonnet-4-5-20250929"),
          max_tokens(4096),
          temperature(0.7f),
          timeout_seconds(60),
          max_requests_per_minute(10),  // SAFE: Won't spam API
          max_retry_attempts(3) {}      // SAFE: Won't loop forever
};

/**
 * ClaudeMessage - Single message in conversation
 */
struct ClaudeMessage {
    std::string role;               // "user" or "assistant"
    std::string content;

    ClaudeMessage(const std::string& r, const std::string& c)
        : role(r), content(c) {}
};

/**
 * ClaudeResponse - Response from API
 */
struct ClaudeResponse {
    std::string content;
    bool success;
    std::string error_message;
    int status_code;
    float request_time_ms;

    ClaudeResponse()
        : success(false), status_code(0), request_time_ms(0.0f) {}
};

/**
 * ClaudeClient - Interface to Anthropic's Claude API
 *
 * SAFETY FEATURES:
 * - Rate limiting (prevents API spam)
 * - Timeout protection (won't hang forever)
 * - Retry with backoff (exponential, limited attempts)
 * - Error handling (doesn't crash on failure)
 * - Request queue (prevents overwhelming API)
 */
class ClaudeClient {
private:
    ClaudeConfig config;
    bool initialized;

    // SAFETY: Rate limiting
    std::chrono::system_clock::time_point last_request_time;
    int requests_this_minute;
    std::chrono::system_clock::time_point minute_start;

    // SAFETY: Request tracking
    long total_requests;
    long failed_requests;
    long rate_limited_requests;

public:
    /**
     * Constructor
     * @param cfg Configuration
     */
    ClaudeClient(const ClaudeConfig& cfg = ClaudeConfig());

    /**
     * Initialize client
     * @param api_key Anthropic API key
     * @return True if successfully initialized
     */
    bool initialize(const std::string& api_key);

    /**
     * Generate response from messages
     *
     * SAFETY:
     * - Respects rate limits
     * - Times out after config.timeout_seconds
     * - Retries with exponential backoff (limited attempts)
     * - Returns error on failure (doesn't crash)
     *
     * @param messages Conversation history
     * @return Response from Claude
     */
    ClaudeResponse generate(const std::vector<ClaudeMessage>& messages);

    /**
     * Generate from simple prompt
     */
    ClaudeResponse generate(const std::string& prompt);

    /**
     * Check if initialized
     */
    bool is_initialized() const { return initialized; }

    /**
     * Get statistics
     */
    struct Stats {
        long total_requests;
        long failed_requests;
        long rate_limited_requests;
        float success_rate;
    };

    Stats get_stats() const;

private:
    /**
     * Check rate limit
     * SAFETY: Prevents API spam
     * @return True if request is allowed
     */
    bool check_rate_limit();

    /**
     * Wait for rate limit window to pass
     * SAFETY: Non-blocking, returns false if should skip
     */
    bool wait_for_rate_limit();

    /**
     * Make HTTP request to Claude API
     * SAFETY: Uses libcurl with timeout
     */
    ClaudeResponse make_request(const std::string& json_body);

    /**
     * Retry with exponential backoff
     * SAFETY: Limited attempts, increasing delays
     */
    ClaudeResponse retry_request(const std::string& json_body, int attempt);

    /**
     * Build JSON request body
     */
    std::string build_json_request(const std::vector<ClaudeMessage>& messages);

    /**
     * Parse JSON response
     */
    ClaudeResponse parse_json_response(const std::string& json_str);

    /**
     * HTTP POST with libcurl (with timeout)
     */
    std::string http_post(const std::string& url,
                          const std::string& body,
                          const std::vector<std::string>& headers,
                          int timeout_seconds);
};

} // namespace Aura
