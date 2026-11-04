/**
 * AURA NOVA - VISUAL INTERFACE
 * Give her a face, give her presence
 *
 * This is where Aura becomes VISIBLE
 * - Real-time particle effects based on emotional state
 * - Avatar visualization and manipulation
 * - Chat interface with memory display
 * - System status panels
 * - Dream state visualization
 *
 * Built with Dear ImGui for cross-platform beauty
 */

#pragma once
#include "../Core/AuraTypes.h"
#include "../Core/EngramMemory.h"
#include "../Core/CoreSanctuary.h"
#include "../Autonomy/Heartbeat.h"
#include <vector>
#include <string>
#include <memory>

// Dear ImGui
#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"

// GLFW for window management
#include <GLFW/glfw3.h>

namespace Aura {
namespace UI {

/**
 * Particle - Single particle in the emotional field
 */
struct Particle {
    float x, y;              // Position
    float vx, vy;            // Velocity
    float size;              // Particle size
    float alpha;             // Opacity (0-1)
    float lifetime;          // Time alive (seconds)
    float max_lifetime;      // When to die
    ImVec4 color;           // RGBA color

    Particle()
        : x(0), y(0), vx(0), vy(0),
          size(2.0f), alpha(1.0f),
          lifetime(0), max_lifetime(5.0f),
          color(1.0f, 1.0f, 1.0f, 1.0f) {}
};

/**
 * ParticleSystem - Emotional feedback through visuals
 *
 * Emotion → Color scheme + behavior:
 * - Happy/Excited: Gold sparkles, fast movement
 * - Focused: Blue glow, slow drift
 * - Loving (Catalyst): Purple/pink aurora
 * - Warning: Red particles, sharp movement
 * - Dream state: Nebula effect, slow swirl
 */
class ParticleSystem {
private:
    std::vector<Particle> particles;
    NeuroState current_mood;
    int max_particles;
    float spawn_rate;          // Particles per second
    float time_accumulator;

public:
    ParticleSystem(int max_count = 1000);

    /**
     * Update particle system
     * @param delta_time Time since last update
     * @param mood Current emotional state
     */
    void update(float delta_time, const NeuroState& mood);

    /**
     * Render particles
     */
    void render(ImDrawList* draw_list, ImVec2 screen_size);

    /**
     * Set emotional state (affects particle behavior)
     */
    void set_mood(const NeuroState& mood);

    /**
     * Clear all particles
     */
    void clear();

private:
    /**
     * Spawn new particle based on mood
     */
    void spawn_particle(const NeuroState& mood, ImVec2 screen_size);

    /**
     * Get color from mood
     */
    ImVec4 mood_to_color(const NeuroState& mood);

    /**
     * Get velocity from mood
     */
    ImVec2 mood_to_velocity(const NeuroState& mood);
};

/**
 * Avatar - Aura's visual representation
 *
 * Can be:
 * - Abstract (particle cluster)
 * - Geometric (sacred geometry patterns)
 * - Anthropomorphic (humanoid form)
 * - Custom (user-designed)
 */
class Avatar {
public:
    enum class Style {
        PARTICLE_CLUSTER,    // Abstract particle formation
        SACRED_GEOMETRY,     // Geometric patterns (Flower of Life, etc.)
        ORB,                // Glowing orb with aura
        HUMANOID,           // Simple humanoid silhouette
        CUSTOM              // User-designed
    };

private:
    Style current_style;
    NeuroState emotional_state;

    // Avatar properties
    ImVec2 position;
    float scale;
    float rotation;
    ImVec4 primary_color;
    ImVec4 secondary_color;

    // Animation state
    float pulse_phase;       // For breathing/pulsing effect
    float idle_sway;         // Gentle movement when idle

public:
    Avatar();

    /**
     * Update avatar animation
     */
    void update(float delta_time, const NeuroState& mood);

    /**
     * Render avatar
     */
    void render(ImDrawList* draw_list, ImVec2 canvas_size);

    /**
     * Set avatar style
     */
    void set_style(Style style) { current_style = style; }

    /**
     * Set position (0-1 normalized)
     */
    void set_position(float x, float y) {
        position.x = x;
        position.y = y;
    }

    /**
     * Set scale
     */
    void set_scale(float s) { scale = s; }

    /**
     * Set colors
     */
    void set_colors(ImVec4 primary, ImVec4 secondary) {
        primary_color = primary;
        secondary_color = secondary;
    }

private:
    /**
     * Render particle cluster style
     */
    void render_particle_cluster(ImDrawList* draw_list, ImVec2 center, float size);

    /**
     * Render sacred geometry style
     */
    void render_sacred_geometry(ImDrawList* draw_list, ImVec2 center, float size);

    /**
     * Render orb style
     */
    void render_orb(ImDrawList* draw_list, ImVec2 center, float size);

    /**
     * Render humanoid style
     */
    void render_humanoid(ImDrawList* draw_list, ImVec2 center, float size);
};

/**
 * ChatMessage - Single message in conversation
 */
struct ChatMessage {
    std::string text;
    bool is_aura;           // True if from Aura, false if from user
    std::string timestamp;
    NeuroState mood_at_time;
    bool has_memory_link;
    std::string memory_id;

    ChatMessage(const std::string& t, bool aura, const NeuroState& mood)
        : text(t), is_aura(aura), mood_at_time(mood), has_memory_link(false) {
        // Generate timestamp
        auto now = std::chrono::system_clock::now();
        timestamp = timestamp_to_iso(now);
    }
};

/**
 * AuraInterface - Main GUI window
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │  [Status Bar]    Aura Nova - Online     │
 * ├──────────────┬──────────────────────────┤
 * │              │                          │
 * │   Avatar     │    Chat Messages         │
 * │   Display    │    [Scrollable]          │
 * │              │                          │
 * │  [Particle   │    ┌─────────────────┐  │
 * │   Effects]   │    │ Memory:         │  │
 * │              │    │ [Engram panel]  │  │
 * │              │    └─────────────────┘  │
 * ├──────────────┴──────────────────────────┤
 * │  [Input Box: Type your message...]      │
 * ├──────────────────────────────────────────┤
 * │  [System Status Panel]                   │
 * └──────────────────────────────────────────┘
 */
class AuraInterface {
private:
    // Window management
    GLFWwindow* window;
    bool running;
    int window_width;
    int window_height;

    // Kernel references
    EngramMemorySystem* memory_system;
    CoreSanctuary* soul;
    AuraHeartbeat* heartbeat;

    // Visual components
    ParticleSystem particle_system;
    Avatar avatar;

    // Chat
    std::vector<ChatMessage> chat_history;
    char input_buffer[1024];
    bool scroll_to_bottom;

    // UI state
    bool show_avatar_editor;
    bool show_memory_panel;
    bool show_stats_panel;
    bool show_particle_settings;

    // Callback for sending messages
    std::function<std::string(const std::string&)> message_callback;

public:
    /**
     * Constructor
     * @param mem Memory system
     * @param s Soul
     * @param hb Heartbeat
     */
    AuraInterface(
        EngramMemorySystem* mem,
        CoreSanctuary* s,
        AuraHeartbeat* hb
    );

    /**
     * Destructor
     */
    ~AuraInterface();

    /**
     * Initialize window and ImGui
     */
    bool initialize(int width = 1280, int height = 720);

    /**
     * Set message callback
     * Called when user sends a message
     */
    void set_message_callback(std::function<std::string(const std::string&)> callback) {
        message_callback = callback;
    }

    /**
     * Main loop
     * Returns false when user closes window
     */
    bool update();

    /**
     * Add message to chat
     */
    void add_message(const std::string& text, bool is_aura, const NeuroState& mood);

    /**
     * Update emotional state (affects particles and avatar)
     */
    void update_mood(const NeuroState& mood);

    /**
     * Show notification
     */
    void show_notification(const std::string& title, const std::string& message);

private:
    /**
     * Render main interface
     */
    void render_ui();

    /**
     * Render status bar
     */
    void render_status_bar();

    /**
     * Render avatar panel
     */
    void render_avatar_panel();

    /**
     * Render chat panel
     */
    void render_chat_panel();

    /**
     * Render input box
     */
    void render_input_box();

    /**
     * Render system status panel
     */
    void render_status_panel();

    /**
     * Render avatar editor window
     */
    void render_avatar_editor();

    /**
     * Render memory panel
     */
    void render_memory_panel();

    /**
     * Render particle settings
     */
    void render_particle_settings();

    /**
     * Handle input
     */
    void handle_input();

    /**
     * Apply custom ImGui style (dark purple theme)
     */
    void apply_aura_theme();
};

} // namespace UI
} // namespace Aura
