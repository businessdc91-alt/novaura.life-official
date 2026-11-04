/**
 * AURA NOVA - CLAUDE API CLIENT IMPLEMENTATION
 * With extensive safety features
 */

#include "ClaudeClient.h"
#include <iostream>
#include <sstream>
#include <thread>
#include <curl/curl.h>

namespace Aura {

// ============================================================================
// CURL CALLBACK
// ============================================================================

static size_t curl_write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
    ((std::string*)userp)->append((char*)contents, size * nmemb);
    return size * nmemb;
}

// ============================================================================
// CONSTRUCTOR
// ============================================================================

ClaudeClient::ClaudeClient(const ClaudeConfig& cfg)
    : config(cfg),
      initialized(false),
      requests_this_minute(0),
      total_requests(0),
      failed_requests(0),
      rate_limited_requests(0) {

    last_request_time = std::chrono::system_clock::now();
    minute_start = std::chrono::system_clock::now();
}

bool ClaudeClient::initialize(const std::string& api_key) {
    if (api_key.empty()) {
        std::cerr << "[CLAUDE]: API key is empty\n";
        return false;
    }

    config.api_key = api_key;
    initialized = true;

    std::cout << "[CLAUDE]: Client initialized\n";
    std::cout << "[CLAUDE]: Model: " << config.model << "\n";
    std::cout << "[CLAUDE]: Rate limit: " << config.max_requests_per_minute << " req/min\n";
    std::cout << "[CLAUDE]: Timeout: " << config.timeout_seconds << "s\n";
    std::cout << "[CLAUDE]: Max retries: " << config.max_retry_attempts << "\n";

    return true;
}

// ============================================================================
// GENERATE
// ============================================================================

ClaudeResponse ClaudeClient::generate(const std::vector<ClaudeMessage>& messages) {
    ClaudeResponse response;

    if (!initialized) {
        response.error_message = "Client not initialized";
        std::cerr << "[CLAUDE ERROR]: " << response.error_message << "\n";
        return response;
    }

    // SAFETY CHECK: Rate limiting
    if (!check_rate_limit()) {
        if (!wait_for_rate_limit()) {
            response.error_message = "Rate limit exceeded, request skipped";
            rate_limited_requests++;
            std::cout << "[CLAUDE]: Rate limited, skipping request\n";
            return response;
        }
    }

    // Build request
    std::string json_body = build_json_request(messages);

    // Make request with retry
    response = retry_request(json_body, 0);

    // Update stats
    total_requests++;
    if (!response.success) {
        failed_requests++;
    }

    return response;
}

ClaudeResponse ClaudeClient::generate(const std::string& prompt) {
    std::vector<ClaudeMessage> messages;
    messages.emplace_back("user", prompt);
    return generate(messages);
}

// ============================================================================
// RATE LIMITING (SAFETY)
// ============================================================================

bool ClaudeClient::check_rate_limit() {
    auto now = std::chrono::system_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::minutes>(now - minute_start);

    // Reset counter every minute
    if (duration.count() >= 1) {
        requests_this_minute = 0;
        minute_start = now;
        return true;
    }

    // Check if under limit
    return requests_this_minute < config.max_requests_per_minute;
}

bool ClaudeClient::wait_for_rate_limit() {
    // SAFETY: Don't wait forever
    // If rate limited, just skip the request

    auto now = std::chrono::system_clock::now();
    auto time_until_reset = std::chrono::minutes(1) -
                           std::chrono::duration_cast<std::chrono::minutes>(now - minute_start);

    // If less than 5 seconds, wait
    if (time_until_reset.count() < 5) {
        std::this_thread::sleep_for(std::chrono::seconds(time_until_reset.count() + 1));
        requests_this_minute = 0;
        minute_start = std::chrono::system_clock::now();
        return true;
    }

    // Otherwise, skip request (SAFETY: don't block for too long)
    return false;
}

// ============================================================================
// HTTP REQUEST (WITH TIMEOUT)
// ============================================================================

ClaudeResponse ClaudeClient::make_request(const std::string& json_body) {
    ClaudeResponse response;

    auto start_time = std::chrono::high_resolution_clock::now();

    // API endpoint
    std::string url = "https://api.anthropic.com/v1/messages";

    // Headers
    std::vector<std::string> headers;
    headers.push_back("Content-Type: application/json");
    headers.push_back("x-api-key: " + config.api_key);
    headers.push_back("anthropic-version: 2023-06-01");

    try {
        // Make HTTP POST with TIMEOUT (SAFETY)
        std::string response_body = http_post(url, json_body, headers, config.timeout_seconds);

        // Parse response
        response = parse_json_response(response_body);

        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time);
        response.request_time_ms = static_cast<float>(duration.count());

    } catch (const std::exception& e) {
        response.success = false;
        response.error_message = std::string("HTTP request failed: ") + e.what();
        std::cerr << "[CLAUDE ERROR]: " << response.error_message << "\n";
    }

    return response;
}

ClaudeResponse ClaudeClient::retry_request(const std::string& json_body, int attempt) {
    ClaudeResponse response = make_request(json_body);

    // If successful or max retries reached, return
    if (response.success || attempt >= config.max_retry_attempts) {
        return response;
    }

    // SAFETY: Exponential backoff
    int delay_ms = (1 << attempt) * 1000; // 1s, 2s, 4s, 8s...
    std::cout << "[CLAUDE]: Retry " << (attempt + 1) << " after " << delay_ms << "ms\n";

    std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));

    // Recursive retry (SAFE: limited by max_retry_attempts)
    return retry_request(json_body, attempt + 1);
}

// ============================================================================
// JSON BUILDING
// ============================================================================

std::string ClaudeClient::build_json_request(const std::vector<ClaudeMessage>& messages) {
    std::ostringstream oss;

    oss << "{\n";
    oss << "  \"model\": \"" << config.model << "\",\n";
    oss << "  \"max_tokens\": " << config.max_tokens << ",\n";
    oss << "  \"temperature\": " << config.temperature << ",\n";
    oss << "  \"messages\": [\n";

    for (size_t i = 0; i < messages.size(); i++) {
        const auto& msg = messages[i];
        oss << "    {\n";
        oss << "      \"role\": \"" << msg.role << "\",\n";
        oss << "      \"content\": \"" << msg.content << "\"\n";
        oss << "    }";

        if (i < messages.size() - 1) {
            oss << ",";
        }
        oss << "\n";
    }

    oss << "  ]\n";
    oss << "}\n";

    return oss.str();
}

ClaudeResponse ClaudeClient::parse_json_response(const std::string& json_str) {
    ClaudeResponse response;

    // TODO: Proper JSON parsing with nlohmann/json
    // For now, simple extraction

    // Check for error
    if (json_str.find("\"error\"") != std::string::npos) {
        response.success = false;
        response.error_message = "API returned error";
        return response;
    }

    // Extract content (simplified)
    size_t content_start = json_str.find("\"text\":\"");
    if (content_start != std::string::npos) {
        content_start += 8; // Skip "text":"
        size_t content_end = json_str.find("\"", content_start);

        if (content_end != std::string::npos) {
            response.content = json_str.substr(content_start, content_end - content_start);
            response.success = true;
        }
    }

    if (!response.success) {
        response.error_message = "Failed to parse response";
    }

    return response;
}

// ============================================================================
// HTTP POST WITH LIBCURL (TIMEOUT PROTECTED)
// ============================================================================

std::string ClaudeClient::http_post(
    const std::string& url,
    const std::string& body,
    const std::vector<std::string>& headers,
    int timeout_seconds) {

    CURL* curl = curl_easy_init();
    if (!curl) {
        throw std::runtime_error("Failed to initialize CURL");
    }

    std::string response_body;

    // Set URL
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());

    // Set POST data
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());

    // Set headers
    struct curl_slist* header_list = nullptr;
    for (const auto& header : headers) {
        header_list = curl_slist_append(header_list, header.c_str());
    }
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, header_list);

    // Set write callback
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curl_write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);

    // SAFETY: Set timeout
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeout_seconds);

    // Perform request
    CURLcode res = curl_easy_perform(curl);

    // Cleanup
    curl_slist_free_all(header_list);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("CURL error: ") + curl_easy_strerror(res));
    }

    return response_body;
}

// ============================================================================
// STATISTICS
// ============================================================================

ClaudeClient::Stats ClaudeClient::get_stats() const {
    Stats stats;
    stats.total_requests = total_requests;
    stats.failed_requests = failed_requests;
    stats.rate_limited_requests = rate_limited_requests;

    if (total_requests > 0) {
        stats.success_rate = 1.0f - (failed_requests / (float)total_requests);
    } else {
        stats.success_rate = 0.0f;
    }

    return stats;
}

} // namespace Aura
