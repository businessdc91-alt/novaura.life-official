#ifndef AURA_API_CONFIG_H
#define AURA_API_CONFIG_H

#include <string>
#include <map>
#include <fstream>
#include <iostream>

/**
 * API Configuration Manager
 *
 * Loads API keys and configuration from secrets.txt or config files
 * Provides safe access to API credentials
 */

namespace Aura {

struct GoogleCloudConfig {
    std::string api_key;
    std::string project_id;
    std::string auth_domain;
    std::string storage_bucket;
    std::string messaging_sender_id;
    std::string app_id;
    std::string measurement_id;

    bool is_valid() const {
        return !api_key.empty() && !project_id.empty();
    }
};

struct APIConfiguration {
    GoogleCloudConfig google_cloud;
    std::string claude_api_key;  // Direct Claude key (optional, can use Vertex instead)

    // Rate limiting and safety
    int max_requests_per_minute = 10;
    int timeout_seconds = 60;
    int max_retry_attempts = 3;

    bool is_valid() const {
        return google_cloud.is_valid();  // At minimum need Google Cloud
    }
};

class APIConfigManager {
public:
    static APIConfigManager& instance() {
        static APIConfigManager instance;
        return instance;
    }

    // Load config from secrets.txt
    bool load_from_secrets_file(const std::string& filepath) {
        std::cout << "[APIConfig] Loading from: " << filepath << std::endl;

        std::ifstream file(filepath);
        if (!file.is_open()) {
            std::cerr << "[APIConfig] ERROR: Could not open " << filepath << std::endl;
            return false;
        }

        std::string line;
        while (std::getline(file, line)) {
            // Parse JavaScript-style config:
            // apiKey: "AIzaSy...",

            if (line.find("apiKey:") != std::string::npos) {
                config_.google_cloud.api_key = extract_value(line);
            }
            else if (line.find("projectId:") != std::string::npos) {
                config_.google_cloud.project_id = extract_value(line);
            }
            else if (line.find("authDomain:") != std::string::npos) {
                config_.google_cloud.auth_domain = extract_value(line);
            }
            else if (line.find("storageBucket:") != std::string::npos) {
                config_.google_cloud.storage_bucket = extract_value(line);
            }
            else if (line.find("messagingSenderId:") != std::string::npos) {
                config_.google_cloud.messaging_sender_id = extract_value(line);
            }
            else if (line.find("appId:") != std::string::npos) {
                config_.google_cloud.app_id = extract_value(line);
            }
            else if (line.find("measurementId:") != std::string::npos) {
                config_.google_cloud.measurement_id = extract_value(line);
            }
        }

        file.close();

        if (config_.is_valid()) {
            std::cout << "[APIConfig] ✓ Google Cloud configured (project: "
                      << config_.google_cloud.project_id << ")" << std::endl;
            std::cout << "[APIConfig] ✓ Access to: Vertex AI, Claude (via Vertex), Imagen 4, Veo, Gemini TTS" << std::endl;
            return true;
        }

        std::cerr << "[APIConfig] ERROR: Invalid configuration loaded" << std::endl;
        return false;
    }

    // Get current configuration
    const APIConfiguration& get_config() const {
        return config_;
    }

    // Check if APIs are available
    bool has_google_cloud() const {
        return config_.google_cloud.is_valid();
    }

    bool has_direct_claude_key() const {
        return !config_.claude_api_key.empty();
    }

    // Get specific values
    std::string get_google_api_key() const {
        return config_.google_cloud.api_key;
    }

    std::string get_project_id() const {
        return config_.google_cloud.project_id;
    }

private:
    APIConfigManager() = default;
    APIConfiguration config_;

    // Extract value from line like: apiKey: "VALUE",
    std::string extract_value(const std::string& line) {
        size_t quote1 = line.find('"');
        if (quote1 == std::string::npos) return "";

        size_t quote2 = line.find('"', quote1 + 1);
        if (quote2 == std::string::npos) return "";

        return line.substr(quote1 + 1, quote2 - quote1 - 1);
    }
};

} // namespace Aura

#endif // AURA_API_CONFIG_H
