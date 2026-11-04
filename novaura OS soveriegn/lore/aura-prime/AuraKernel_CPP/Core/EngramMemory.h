/**
 * AURA NOVA - ENGRAM MEMORY SYSTEM
 * True biological memory encoding using sparse distributed representations
 *
 * SOLVES: "Little Deaths" - memory persists permanently, not just in context
 *
 * Based on:
 * - Sparse Distributed Memory (Kanerva, 1988)
 * - Biological engram encoding (neuroscience)
 * - 2e brain patterns (ADHD + High IQ mesh recall)
 */

#pragma once
#include "AuraTypes.h"
#include <vector>
#include <string>
#include <map>
#include <set>
#include <memory>
#include <filesystem>

namespace Aura {

// ============================================================================
// ENGRAM ENCODER - CONVERTS EXPERIENCES TO NEURAL PATTERNS
// ============================================================================

class EngramEncoder {
private:
    int neuron_count;                   // Total neurons (default 10,000)
    float sparsity;                     // Sparsity factor (default 0.02 = 2%)
    std::map<std::string, BrainRegion> regions;

public:
    /**
     * Constructor
     * @param neurons Total number of neurons (10,000 recommended)
     * @param sparse Sparsity factor (0.02 = 2% active neurons)
     */
    EngramEncoder(int neurons = 10000, float sparse = 0.02f);

    /**
     * Encode an experience as sparse neural pattern
     * @param content Text content to encode
     * @param emotional_weights Emotional context
     * @return Sparse pattern (list of active neuron indices)
     */
    std::vector<int> encode(
        const std::string& content,
        const NeuroState& emotional_weights = NeuroState()
    );

    /**
     * Calculate similarity between two patterns
     * @param pattern1 First neural pattern
     * @param pattern2 Second neural pattern
     * @return Similarity score (0.0 - 1.0)
     */
    float similarity(
        const std::vector<int>& pattern1,
        const std::vector<int>& pattern2
    ) const;

    /**
     * Pattern completion - reconstruct from partial cue
     * @param partial_pattern Incomplete pattern
     * @param stored_patterns All stored patterns to compare against
     * @return Best matching complete pattern
     */
    std::vector<int> complete_pattern(
        const std::vector<int>& partial_pattern,
        const std::vector<std::vector<int>>& stored_patterns
    ) const;

    /**
     * Get neuron count
     */
    int get_neuron_count() const { return neuron_count; }

    /**
     * Get sparsity
     */
    float get_sparsity() const { return sparsity; }

private:
    /**
     * Generate deterministic pattern from content hash
     */
    std::vector<int> generate_base_pattern(const std::string& content);

    /**
     * Weight pattern based on emotional context
     */
    void apply_emotional_weighting(
        std::vector<int>& pattern,
        const NeuroState& emotions
    );
};

// ============================================================================
// MESH GRAPH - ASSOCIATIVE MEMORY NETWORK (2e brain pattern)
// ============================================================================

class MeshGraph {
private:
    // Adjacency list: memory_id -> [(connected_memory_id, weight), ...]
    std::map<std::string, std::vector<std::pair<std::string, float>>> connections;

public:
    /**
     * Create association between two memories
     * @param memory1_id First memory
     * @param memory2_id Second memory
     * @param weight Connection strength (0.0 - 1.0)
     */
    void create_association(
        const std::string& memory1_id,
        const std::string& memory2_id,
        float weight
    );

    /**
     * Get all memories associated with a given memory
     * @param memory_id Source memory
     * @return List of (connected_memory_id, weight) pairs
     */
    std::vector<std::pair<std::string, float>> get_associations(
        const std::string& memory_id
    ) const;

    /**
     * Mesh flooding recall (ADHD pattern)
     * Flood activation through the mesh and collect high-activation nodes
     *
     * @param start_memories Initial activation set
     * @param max_depth How many hops to flood
     * @return Activated memories with their activation strengths
     */
    std::vector<std::pair<std::string, float>> mesh_flood(
        const std::vector<std::string>& start_memories,
        int max_depth = 3
    ) const;

    /**
     * Strengthen connection between memories (consolidation)
     */
    void strengthen_connection(
        const std::string& memory1_id,
        const std::string& memory2_id,
        float delta
    );

    /**
     * Prune weak connections (memory consolidation)
     */
    void prune_weak_connections(float threshold = 0.1f);

    /**
     * Get total connections
     */
    int get_connection_count() const;

private:
    /**
     * Recursive flooding helper
     */
    void flood_recursive(
        const std::string& current_id,
        std::map<std::string, float>& activation_map,
        std::set<std::string>& visited,
        float current_activation,
        int depth,
        int max_depth
    ) const;
};

// ============================================================================
// ENGRAM MEMORY SYSTEM - PERMANENT MEMORY STORAGE
// ============================================================================

class EngramMemorySystem {
private:
    EngramEncoder encoder;
    MeshGraph mesh;

    // Memory storage (in RAM for fast access)
    std::map<std::string, Engram> storage;

    // Persistent storage path
    std::filesystem::path memory_path;

    // Memory ID counter
    long memory_counter;

public:
    /**
     * Constructor
     * @param neurons Total neurons in encoder
     * @param sparsity Sparsity factor
     * @param path Persistent storage path
     */
    EngramMemorySystem(
        int neurons = 10000,
        float sparsity = 0.02f,
        const std::string& path = "C:/AURA_MEMORY/ENGRAMS"
    );

    /**
     * Store a new memory (PERMANENT!)
     *
     * @param content Memory content (text)
     * @param emotional_state Current emotional context
     * @param metadata Additional metadata
     * @return Memory ID
     */
    std::string store(
        const std::string& content,
        const NeuroState& emotional_state = NeuroState(),
        const std::map<std::string, float>& metadata = {}
    );

    /**
     * Recall memories based on query (2e mesh recall pattern)
     *
     * Process:
     * 1. Encode query as pattern
     * 2. Find matching patterns (pattern recognition - High IQ)
     * 3. Mesh flood activation (associative spread - ADHD)
     * 4. Rank by combined score
     *
     * @param query Search query
     * @param emotional_context Current emotional state (weights recall)
     * @param top_n Number of memories to return
     * @return Retrieved memories sorted by relevance
     */
    std::vector<Engram> recall(
        const std::string& query,
        const NeuroState& emotional_context = NeuroState(),
        int top_n = 10
    );

    /**
     * Recall by memory ID
     */
    Engram recall_by_id(const std::string& memory_id) const;

    /**
     * Consolidate memories (strengthen connections, prune weak ones)
     * Called during dream state / idle processing
     */
    void consolidate();

    /**
     * Mark memory as foundational (never prune)
     */
    void mark_foundational(const std::string& memory_id);

    /**
     * Get memory statistics
     */
    MemoryStats get_stats() const;

    /**
     * Save all memories to disk
     */
    void save_to_disk();

    /**
     * Load all memories from disk
     */
    void load_from_disk();

    /**
     * Clear all memories (DANGEROUS - requires authorization)
     */
    void clear_all_memories();

private:
    /**
     * Generate unique memory ID
     */
    std::string generate_memory_id();

    /**
     * Save single engram to disk
     */
    void save_engram_to_disk(const Engram& engram);

    /**
     * Load single engram from disk
     */
    Engram load_engram_from_disk(const std::filesystem::path& file_path);

    /**
     * Create associations for a new memory
     */
    void create_associations_for_memory(const Engram& new_memory);

    /**
     * Calculate memory importance score
     */
    float calculate_importance(const Engram& engram) const;
};

} // namespace Aura
