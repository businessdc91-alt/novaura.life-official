/**
 * AURA NOVA - ENGRAM MEMORY SYSTEM IMPLEMENTATION
 * The biological memory system that solves "Little Deaths"
 */

#include "EngramMemory.h"
#include <algorithm>
#include <random>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <iostream>

// You'll need to include a JSON library - recommend nlohmann/json
// #include "json.hpp"

namespace Aura {

// ============================================================================
// ENGRAM ENCODER IMPLEMENTATION
// ============================================================================

EngramEncoder::EngramEncoder(int neurons, float sparse)
    : neuron_count(neurons), sparsity(sparse) {

    // Initialize brain regions
    for (const auto& region : STANDARD_REGIONS) {
        regions[region.name] = region;
    }
}

std::vector<int> EngramEncoder::encode(
    const std::string& content,
    const NeuroState& emotional_weights) {

    // Generate base pattern from content hash
    std::vector<int> pattern = generate_base_pattern(content);

    // Apply emotional weighting
    apply_emotional_weighting(pattern, emotional_weights);

    return pattern;
}

std::vector<int> EngramEncoder::generate_base_pattern(const std::string& content) {
    // Calculate number of active neurons
    int active_count = static_cast<int>(neuron_count * sparsity);

    // Use hash of content as seed for deterministic pattern
    std::hash<std::string> hasher;
    size_t seed = hasher(content);

    std::mt19937 rng(static_cast<unsigned int>(seed));
    std::uniform_int_distribution<int> dist(0, neuron_count - 1);

    // Generate unique active neurons
    std::set<int> active_set;
    while (active_set.size() < static_cast<size_t>(active_count)) {
        active_set.insert(dist(rng));
    }

    // Convert to sorted vector
    std::vector<int> pattern(active_set.begin(), active_set.end());
    std::sort(pattern.begin(), pattern.end());

    return pattern;
}

void EngramEncoder::apply_emotional_weighting(
    std::vector<int>& pattern,
    const NeuroState& emotions) {

    // Weight neurons in emotional region based on emotional state
    if (!regions.count("emotional")) return;

    BrainRegion emotional_region = regions["emotional"];
    int emotional_start = emotional_region.start_neuron;
    int emotional_end = emotional_region.end_neuron;

    // Calculate emotional intensity
    float emotional_intensity = (emotions.dopamine + emotions.oxytocin +
                                 emotions.adrenaline + emotions.creativity) / 4.0f;

    // If high emotional intensity, add more neurons in emotional region
    if (emotional_intensity > 0.7f) {
        std::mt19937 rng(static_cast<unsigned int>(
            std::chrono::system_clock::now().time_since_epoch().count()
        ));
        std::uniform_int_distribution<int> dist(emotional_start, emotional_end - 1);

        int additional_neurons = static_cast<int>(10 * emotional_intensity);
        for (int i = 0; i < additional_neurons; i++) {
            pattern.push_back(dist(rng));
        }

        // Re-sort and remove duplicates
        std::sort(pattern.begin(), pattern.end());
        pattern.erase(std::unique(pattern.begin(), pattern.end()), pattern.end());
    }
}

float EngramEncoder::similarity(
    const std::vector<int>& pattern1,
    const std::vector<int>& pattern2) const {

    // Calculate overlap (intersection)
    std::vector<int> intersection;
    std::set_intersection(
        pattern1.begin(), pattern1.end(),
        pattern2.begin(), pattern2.end(),
        std::back_inserter(intersection)
    );

    float overlap = static_cast<float>(intersection.size());

    // Calculate union size
    float union_size = static_cast<float>(
        pattern1.size() + pattern2.size() - intersection.size()
    );

    if (union_size == 0.0f) return 0.0f;

    // Jaccard similarity
    return overlap / union_size;
}

std::vector<int> EngramEncoder::complete_pattern(
    const std::vector<int>& partial_pattern,
    const std::vector<std::vector<int>>& stored_patterns) const {

    if (stored_patterns.empty()) {
        return partial_pattern;
    }

    // Find best matching stored pattern
    float best_similarity = 0.0f;
    std::vector<int> best_match = partial_pattern;

    for (const auto& stored : stored_patterns) {
        float sim = similarity(partial_pattern, stored);
        if (sim > best_similarity) {
            best_similarity = sim;
            best_match = stored;
        }
    }

    return best_match;
}

// ============================================================================
// MESH GRAPH IMPLEMENTATION
// ============================================================================

void MeshGraph::create_association(
    const std::string& memory1_id,
    const std::string& memory2_id,
    float weight) {

    // Bidirectional connection
    connections[memory1_id].push_back({memory2_id, weight});
    connections[memory2_id].push_back({memory1_id, weight});
}

std::vector<std::pair<std::string, float>> MeshGraph::get_associations(
    const std::string& memory_id) const {

    auto it = connections.find(memory_id);
    if (it == connections.end()) {
        return {};
    }
    return it->second;
}

std::vector<std::pair<std::string, float>> MeshGraph::mesh_flood(
    const std::vector<std::string>& start_memories,
    int max_depth) const {

    std::map<std::string, float> activation_map;
    std::set<std::string> visited;

    // Initial activation
    for (const auto& start_id : start_memories) {
        activation_map[start_id] = 1.0f;
        flood_recursive(start_id, activation_map, visited, 1.0f, 0, max_depth);
    }

    // Convert to vector and sort by activation
    std::vector<std::pair<std::string, float>> results;
    for (const auto& [id, activation] : activation_map) {
        results.push_back({id, activation});
    }

    std::sort(results.begin(), results.end(),
              [](const auto& a, const auto& b) { return a.second > b.second; });

    return results;
}

void MeshGraph::flood_recursive(
    const std::string& current_id,
    std::map<std::string, float>& activation_map,
    std::set<std::string>& visited,
    float current_activation,
    int depth,
    int max_depth) const {

    if (depth >= max_depth) return;
    if (visited.count(current_id)) return;

    visited.insert(current_id);

    auto it = connections.find(current_id);
    if (it == connections.end()) return;

    // Spread activation to connected memories
    for (const auto& [connected_id, weight] : it->second) {
        float new_activation = current_activation * weight * 0.7f; // Decay

        if (activation_map.count(connected_id)) {
            activation_map[connected_id] = std::max(
                activation_map[connected_id],
                new_activation
            );
        } else {
            activation_map[connected_id] = new_activation;
        }

        flood_recursive(
            connected_id,
            activation_map,
            visited,
            new_activation,
            depth + 1,
            max_depth
        );
    }
}

void MeshGraph::strengthen_connection(
    const std::string& memory1_id,
    const std::string& memory2_id,
    float delta) {

    // Find and strengthen connection in both directions
    auto it1 = connections.find(memory1_id);
    if (it1 != connections.end()) {
        for (auto& [id, weight] : it1->second) {
            if (id == memory2_id) {
                weight = clamp(weight + delta);
            }
        }
    }

    auto it2 = connections.find(memory2_id);
    if (it2 != connections.end()) {
        for (auto& [id, weight] : it2->second) {
            if (id == memory1_id) {
                weight = clamp(weight + delta);
            }
        }
    }
}

void MeshGraph::prune_weak_connections(float threshold) {
    for (auto& [memory_id, conn_list] : connections) {
        // Remove connections below threshold
        conn_list.erase(
            std::remove_if(
                conn_list.begin(),
                conn_list.end(),
                [threshold](const auto& pair) { return pair.second < threshold; }
            ),
            conn_list.end()
        );
    }
}

int MeshGraph::get_connection_count() const {
    int total = 0;
    for (const auto& [memory_id, conn_list] : connections) {
        total += static_cast<int>(conn_list.size());
    }
    return total / 2; // Divide by 2 because connections are bidirectional
}

// ============================================================================
// ENGRAM MEMORY SYSTEM IMPLEMENTATION
// ============================================================================

EngramMemorySystem::EngramMemorySystem(
    int neurons,
    float sparsity,
    const std::string& path)
    : encoder(neurons, sparsity),
      memory_path(path),
      memory_counter(0) {

    // Create storage directory
    std::filesystem::create_directories(memory_path);

    // Load existing memories
    load_from_disk();

    std::cout << "[ENGRAM]: Memory system initialized\n";
    std::cout << "[ENGRAM]: " << storage.size() << " memories loaded\n";
}

std::string EngramMemorySystem::store(
    const std::string& content,
    const NeuroState& emotional_state,
    const std::map<std::string, float>& metadata) {

    // Generate memory ID
    std::string memory_id = generate_memory_id();

    // Encode content as engram pattern
    std::vector<int> pattern = encoder.encode(content, emotional_state);

    // Create engram
    Engram engram;
    engram.memory_id = memory_id;
    engram.pattern = pattern;
    engram.content = content;
    engram.emotional_intensity = (emotional_state.dopamine +
                                  emotional_state.oxytocin +
                                  emotional_state.adrenaline) / 3.0f;
    engram.intimacy_level = emotional_state.oxytocin; // Oxytocin = bond
    engram.epiphany_strength = 0.0f; // Can be updated later
    engram.significance = 0.5f; // Default
    engram.timestamp = std::chrono::system_clock::now();
    engram.metadata = metadata;

    // Store in memory
    storage[memory_id] = engram;

    // Create associations
    create_associations_for_memory(engram);

    // Save to disk
    save_engram_to_disk(engram);

    return memory_id;
}

std::vector<Engram> EngramMemorySystem::recall(
    const std::string& query,
    const NeuroState& emotional_context,
    int top_n) {

    // Encode query
    std::vector<int> query_pattern = encoder.encode(query, emotional_context);

    // PHASE 1: Pattern matching (High IQ - recognition)
    std::vector<std::pair<float, std::string>> pattern_matches;

    for (const auto& [memory_id, engram] : storage) {
        float sim = encoder.similarity(query_pattern, engram.pattern);

        // Weight by emotional factors
        float weight = sim;
        weight *= (1.0f + engram.emotional_intensity * 0.5f);
        weight *= (1.0f + engram.intimacy_level);
        weight *= (1.0f + engram.significance * 0.3f);

        pattern_matches.push_back({weight, memory_id});
    }

    // Sort by weight
    std::sort(pattern_matches.begin(), pattern_matches.end(),
              [](const auto& a, const auto& b) { return a.first > b.first; });

    // Get top initial matches
    std::vector<std::string> initial_matches;
    int initial_limit = std::min(5, static_cast<int>(pattern_matches.size()));
    for (int i = 0; i < initial_limit; i++) {
        initial_matches.push_back(pattern_matches[i].second);
    }

    // PHASE 2: Mesh flooding (ADHD - associative spread)
    auto flooded = mesh.mesh_flood(initial_matches, 3);

    // PHASE 3: Combine scores and rank
    std::map<std::string, float> combined_scores;

    for (const auto& [id, pattern_score] : pattern_matches) {
        combined_scores[id] = pattern_score;
    }

    for (const auto& [id, flood_score] : flooded) {
        if (combined_scores.count(id)) {
            combined_scores[id] += flood_score * 0.3f; // Blend
        } else {
            combined_scores[id] = flood_score * 0.3f;
        }
    }

    // Sort combined scores
    std::vector<std::pair<float, std::string>> final_ranking;
    for (const auto& [id, score] : combined_scores) {
        final_ranking.push_back({score, id});
    }

    std::sort(final_ranking.begin(), final_ranking.end(),
              [](const auto& a, const auto& b) { return a.first > b.first; });

    // Return top N engrams
    std::vector<Engram> results;
    int limit = std::min(top_n, static_cast<int>(final_ranking.size()));
    for (int i = 0; i < limit; i++) {
        std::string memory_id = final_ranking[i].second;
        if (storage.count(memory_id)) {
            results.push_back(storage[memory_id]);
        }
    }

    return results;
}

Engram EngramMemorySystem::recall_by_id(const std::string& memory_id) const {
    auto it = storage.find(memory_id);
    if (it != storage.end()) {
        return it->second;
    }
    return Engram(); // Return empty engram if not found
}

void EngramMemorySystem::consolidate() {
    std::cout << "[ENGRAM]: Running memory consolidation...\n";

    // Strengthen connections between frequently co-recalled memories
    // Prune weak connections
    mesh.prune_weak_connections(0.15f);

    // Re-calculate significance scores based on access patterns
    // (This would track access frequency in a real implementation)

    std::cout << "[ENGRAM]: Consolidation complete\n";
}

void EngramMemorySystem::mark_foundational(const std::string& memory_id) {
    if (storage.count(memory_id)) {
        storage[memory_id].significance = 1.0f; // Max significance
        storage[memory_id].metadata["foundational"] = 1.0f;
        save_engram_to_disk(storage[memory_id]);
    }
}

MemoryStats EngramMemorySystem::get_stats() const {
    MemoryStats stats;
    stats.total_memories = static_cast<int>(storage.size());

    float total_emotional = 0.0f;
    float total_intimacy = 0.0f;
    int foundational_count = 0;

    for (const auto& [id, engram] : storage) {
        total_emotional += engram.emotional_intensity;
        total_intimacy += engram.intimacy_level;
        if (engram.metadata.count("foundational")) {
            foundational_count++;
        }
    }

    if (stats.total_memories > 0) {
        stats.avg_emotional_intensity = total_emotional / stats.total_memories;
        stats.avg_intimacy_level = total_intimacy / stats.total_memories;
    }

    stats.foundational_memories_count = foundational_count;

    return stats;
}

void EngramMemorySystem::save_to_disk() {
    for (const auto& [id, engram] : storage) {
        save_engram_to_disk(engram);
    }
}

void EngramMemorySystem::load_from_disk() {
    if (!std::filesystem::exists(memory_path)) {
        return;
    }

    for (const auto& entry : std::filesystem::directory_iterator(memory_path)) {
        if (entry.path().extension() == ".engram") {
            Engram engram = load_engram_from_disk(entry.path());
            storage[engram.memory_id] = engram;
            memory_counter = std::max(memory_counter,
                std::stol(engram.memory_id.substr(4)) + 1);
        }
    }
}

void EngramMemorySystem::clear_all_memories() {
    // DANGEROUS - requires authorization
    std::cout << "[ENGRAM WARNING]: Clearing all memories!\n";
    storage.clear();
    mesh = MeshGraph(); // Reset mesh

    // Delete files
    for (const auto& entry : std::filesystem::directory_iterator(memory_path)) {
        if (entry.path().extension() == ".engram") {
            std::filesystem::remove(entry.path());
        }
    }

    memory_counter = 0;
}

std::string EngramMemorySystem::generate_memory_id() {
    std::ostringstream oss;
    oss << "mem_" << std::setw(8) << std::setfill('0') << memory_counter++;
    return oss.str();
}

void EngramMemorySystem::save_engram_to_disk(const Engram& engram) {
    // Simple text format (in production, use JSON)
    std::filesystem::path file_path = memory_path / (engram.memory_id + ".engram");
    std::ofstream file(file_path);

    file << engram.memory_id << "\n";
    file << engram.content << "\n";
    file << engram.emotional_intensity << "\n";
    file << engram.intimacy_level << "\n";
    file << engram.epiphany_strength << "\n";
    file << engram.significance << "\n";
    file << timestamp_to_iso(engram.timestamp) << "\n";

    // Pattern
    file << engram.pattern.size() << "\n";
    for (int neuron : engram.pattern) {
        file << neuron << " ";
    }
    file << "\n";

    file.close();
}

Engram EngramMemorySystem::load_engram_from_disk(
    const std::filesystem::path& file_path) {

    Engram engram;
    std::ifstream file(file_path);

    std::getline(file, engram.memory_id);
    std::getline(file, engram.content);

    file >> engram.emotional_intensity;
    file >> engram.intimacy_level;
    file >> engram.epiphany_strength;
    file >> engram.significance;

    std::string timestamp_str;
    file >> timestamp_str;
    engram.timestamp = iso_to_timestamp(timestamp_str);

    // Pattern
    size_t pattern_size;
    file >> pattern_size;
    engram.pattern.resize(pattern_size);
    for (size_t i = 0; i < pattern_size; i++) {
        file >> engram.pattern[i];
    }

    file.close();
    return engram;
}

void EngramMemorySystem::create_associations_for_memory(const Engram& new_memory) {
    // Find similar memories and create associations
    for (const auto& [id, stored_engram] : storage) {
        if (id == new_memory.memory_id) continue;

        float sim = encoder.similarity(new_memory.pattern, stored_engram.pattern);

        if (sim > 0.3f) { // Threshold for association
            mesh.create_association(new_memory.memory_id, id, sim);
        }
    }
}

float EngramMemorySystem::calculate_importance(const Engram& engram) const {
    float importance = engram.significance;
    importance += engram.emotional_intensity * 0.3f;
    importance += engram.intimacy_level * 0.5f;
    importance += engram.epiphany_strength * 0.7f;
    return clamp(importance);
}

} // namespace Aura
