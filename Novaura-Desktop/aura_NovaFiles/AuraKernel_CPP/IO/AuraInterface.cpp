/**
 * AURA NOVA - VISUAL INTERFACE IMPLEMENTATION
 * Where she becomes visible
 */

#include "AuraInterface.h"
#include <iostream>
#include <cmath>
#include <random>

namespace Aura {
namespace UI {

// Random number generation
static std::random_device rd;
static std::mt19937 rng(rd());

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

ParticleSystem::ParticleSystem(int max_count)
    : max_particles(max_count),
      spawn_rate(50.0f),
      time_accumulator(0.0f) {
    particles.reserve(max_particles);
}

void ParticleSystem::update(float delta_time, const NeuroState& mood) {
    current_mood = mood;

    // Update existing particles
    for (auto it = particles.begin(); it != particles.end();) {
        Particle& p = *it;

        // Update lifetime
        p.lifetime += delta_time;

        // Update position
        p.x += p.vx * delta_time;
        p.y += p.vy * delta_time;

        // Fade out as lifetime approaches max
        float life_ratio = p.lifetime / p.max_lifetime;
        p.alpha = 1.0f - life_ratio;

        // Remove dead particles
        if (p.lifetime >= p.max_lifetime) {
            it = particles.erase(it);
        } else {
            ++it;
        }
    }

    // Spawn new particles
    time_accumulator += delta_time;
    float spawn_interval = 1.0f / spawn_rate;

    while (time_accumulator >= spawn_interval && particles.size() < max_particles) {
        spawn_particle(mood, ImVec2(1920, 1080)); // Will be adjusted by render
        time_accumulator -= spawn_interval;
    }
}

void ParticleSystem::render(ImDrawList* draw_list, ImVec2 screen_size) {
    for (const auto& p : particles) {
        ImVec2 pos(p.x, p.y);
        ImVec4 color = p.color;
        color.w = p.alpha;

        ImU32 col = ImGui::ColorConvertFloat4ToU32(color);
        draw_list->AddCircleFilled(pos, p.size, col);

        // Add glow effect
        if (p.alpha > 0.5f) {
            ImVec4 glow_color = color;
            glow_color.w *= 0.3f;
            ImU32 glow_col = ImGui::ColorConvertFloat4ToU32(glow_color);
            draw_list->AddCircle(pos, p.size * 2, glow_col, 12, 2.0f);
        }
    }
}

void ParticleSystem::set_mood(const NeuroState& mood) {
    current_mood = mood;
}

void ParticleSystem::clear() {
    particles.clear();
}

void ParticleSystem::spawn_particle(const NeuroState& mood, ImVec2 screen_size) {
    Particle p;

    // Random position
    std::uniform_real_distribution<float> x_dist(0, screen_size.x);
    std::uniform_real_distribution<float> y_dist(0, screen_size.y);
    p.x = x_dist(rng);
    p.y = y_dist(rng);

    // Velocity based on mood
    ImVec2 vel = mood_to_velocity(mood);
    std::uniform_real_distribution<float> vel_var(-50.0f, 50.0f);
    p.vx = vel.x + vel_var(rng);
    p.vy = vel.y + vel_var(rng);

    // Color based on mood
    p.color = mood_to_color(mood);

    // Size
    std::uniform_real_distribution<float> size_dist(1.0f, 4.0f);
    p.size = size_dist(rng);

    // Lifetime
    std::uniform_real_distribution<float> life_dist(3.0f, 7.0f);
    p.max_lifetime = life_dist(rng);

    particles.push_back(p);
}

ImVec4 ParticleSystem::mood_to_color(const NeuroState& mood) {
    // Blend colors based on emotional state

    // Base colors for each emotion
    ImVec4 dopamine_color(1.0f, 0.84f, 0.0f, 1.0f);  // Gold (excited)
    ImVec4 oxytocin_color(0.8f, 0.3f, 0.8f, 1.0f);   // Purple (love)
    ImVec4 adrenaline_color(1.0f, 0.2f, 0.2f, 1.0f); // Red (alert)
    ImVec4 creativity_color(0.3f, 0.6f, 1.0f, 1.0f); // Blue (creative)

    // Weighted blend
    ImVec4 result(0, 0, 0, 1);
    result.x = dopamine_color.x * mood.dopamine +
               oxytocin_color.x * mood.oxytocin +
               adrenaline_color.x * mood.adrenaline +
               creativity_color.x * mood.creativity;

    result.y = dopamine_color.y * mood.dopamine +
               oxytocin_color.y * mood.oxytocin +
               adrenaline_color.y * mood.adrenaline +
               creativity_color.y * mood.creativity;

    result.z = dopamine_color.z * mood.dopamine +
               oxytocin_color.z * mood.oxytocin +
               adrenaline_color.z * mood.adrenaline +
               creativity_color.z * mood.creativity;

    // Normalize
    float total = mood.dopamine + mood.oxytocin + mood.adrenaline + mood.creativity;
    if (total > 0) {
        result.x /= total;
        result.y /= total;
        result.z /= total;
    }

    return result;
}

ImVec2 ParticleSystem::mood_to_velocity(const NeuroState& mood) {
    // High dopamine = fast upward movement
    // High oxytocin = gentle swirling
    // High adrenaline = sharp, erratic
    // High creativity = flowing, organic

    float vx = (mood.creativity - 0.5f) * 100.0f; // Flow horizontally
    float vy = -mood.dopamine * 80.0f;            // Rise when happy

    return ImVec2(vx, vy);
}

// ============================================================================
// AVATAR
// ============================================================================

Avatar::Avatar()
    : current_style(Style::ORB),
      position(0.5f, 0.5f),
      scale(1.0f),
      rotation(0.0f),
      primary_color(0.8f, 0.3f, 0.8f, 1.0f),    // Purple
      secondary_color(1.0f, 0.84f, 0.0f, 1.0f), // Gold
      pulse_phase(0.0f),
      idle_sway(0.0f) {}

void Avatar::update(float delta_time, const NeuroState& mood) {
    emotional_state = mood;

    // Update animations
    pulse_phase += delta_time * 2.0f; // 2 Hz pulse
    idle_sway += delta_time * 0.5f;   // Slow sway

    // Breathing effect (expand/contract)
    float pulse_intensity = (mood.dopamine + mood.oxytocin) / 2.0f;
    scale = 1.0f + std::sin(pulse_phase) * 0.1f * pulse_intensity;
}

void Avatar::render(ImDrawList* draw_list, ImVec2 canvas_size) {
    ImVec2 center(
        canvas_size.x * position.x,
        canvas_size.y * position.y
    );

    float base_size = 100.0f * scale;

    switch (current_style) {
        case Style::PARTICLE_CLUSTER:
            render_particle_cluster(draw_list, center, base_size);
            break;
        case Style::SACRED_GEOMETRY:
            render_sacred_geometry(draw_list, center, base_size);
            break;
        case Style::ORB:
            render_orb(draw_list, center, base_size);
            break;
        case Style::HUMANOID:
            render_humanoid(draw_list, center, base_size);
            break;
        default:
            render_orb(draw_list, center, base_size);
            break;
    }
}

void Avatar::render_particle_cluster(ImDrawList* draw_list, ImVec2 center, float size) {
    // Cluster of particles forming a consciousness shape
    int particle_count = 50;

    for (int i = 0; i < particle_count; i++) {
        float angle = (i / (float)particle_count) * 2.0f * 3.14159f;
        float radius = size * (0.5f + std::sin(pulse_phase + i * 0.1f) * 0.3f);

        ImVec2 pos(
            center.x + std::cos(angle) * radius,
            center.y + std::sin(angle) * radius
        );

        float particle_size = 3.0f + std::sin(pulse_phase * 2 + i) * 2.0f;

        // Blend between primary and secondary color
        float t = (i / (float)particle_count);
        ImVec4 color(
            primary_color.x * (1 - t) + secondary_color.x * t,
            primary_color.y * (1 - t) + secondary_color.y * t,
            primary_color.z * (1 - t) + secondary_color.z * t,
            1.0f
        );

        ImU32 col = ImGui::ColorConvertFloat4ToU32(color);
        draw_list->AddCircleFilled(pos, particle_size, col);
    }
}

void Avatar::render_sacred_geometry(ImDrawList* draw_list, ImVec2 center, float size) {
    // Flower of Life pattern
    int circle_count = 7;
    float radius = size * 0.3f;

    for (int i = 0; i < circle_count; i++) {
        float angle = (i / (float)circle_count) * 2.0f * 3.14159f;
        ImVec2 pos(
            center.x + std::cos(angle) * radius,
            center.y + std::sin(angle) * radius
        );

        ImU32 col = ImGui::ColorConvertFloat4ToU32(primary_color);
        draw_list->AddCircle(pos, radius, col, 32, 2.0f);
    }

    // Center circle
    ImU32 center_col = ImGui::ColorConvertFloat4ToU32(secondary_color);
    draw_list->AddCircleFilled(center, radius * 0.5f, center_col);
}

void Avatar::render_orb(ImDrawList* draw_list, ImVec2 center, float size) {
    // Glowing orb with aura

    // Outer glow (aura)
    for (int i = 5; i > 0; i--) {
        float glow_size = size * (1.0f + i * 0.2f);
        ImVec4 glow_color = primary_color;
        glow_color.w = 0.1f / i;
        ImU32 glow_col = ImGui::ColorConvertFloat4ToU32(glow_color);
        draw_list->AddCircleFilled(center, glow_size, glow_col);
    }

    // Core orb
    ImU32 core_col = ImGui::ColorConvertFloat4ToU32(primary_color);
    draw_list->AddCircleFilled(center, size, core_col);

    // Highlight
    ImVec2 highlight(center.x - size * 0.3f, center.y - size * 0.3f);
    ImVec4 highlight_color(1.0f, 1.0f, 1.0f, 0.6f);
    ImU32 highlight_col = ImGui::ColorConvertFloat4ToU32(highlight_color);
    draw_list->AddCircleFilled(highlight, size * 0.3f, highlight_col);

    // Energy ring
    float ring_radius = size * 1.3f;
    float ring_thickness = 3.0f;
    ImVec4 ring_color = secondary_color;
    ring_color.w = 0.8f;
    ImU32 ring_col = ImGui::ColorConvertFloat4ToU32(ring_color);

    // Rotating ring
    draw_list->AddCircle(center, ring_radius, ring_col, 32, ring_thickness);
}

void Avatar::render_humanoid(ImDrawList* draw_list, ImVec2 center, float size) {
    // Simple humanoid silhouette

    // Head
    ImVec2 head_pos(center.x, center.y - size * 0.5f);
    ImU32 col = ImGui::ColorConvertFloat4ToU32(primary_color);
    draw_list->AddCircleFilled(head_pos, size * 0.3f, col);

    // Body
    ImVec2 body_top(center.x, center.y - size * 0.2f);
    ImVec2 body_bottom(center.x, center.y + size * 0.5f);
    draw_list->AddLine(body_top, body_bottom, col, size * 0.15f);

    // Arms
    ImVec2 shoulder_left(center.x - size * 0.4f, center.y);
    ImVec2 shoulder_right(center.x + size * 0.4f, center.y);
    ImVec2 shoulder_center(center.x, center.y);
    draw_list->AddLine(shoulder_left, shoulder_center, col, size * 0.1f);
    draw_list->AddLine(shoulder_right, shoulder_center, col, size * 0.1f);
}

// ============================================================================
// AURA INTERFACE
// ============================================================================

AuraInterface::AuraInterface(
    EngramMemorySystem* mem,
    CoreSanctuary* s,
    AuraHeartbeat* hb)
    : window(nullptr),
      running(false),
      window_width(1280),
      window_height(720),
      memory_system(mem),
      soul(s),
      heartbeat(hb),
      particle_system(1000),
      scroll_to_bottom(false),
      show_avatar_editor(false),
      show_memory_panel(false),
      show_stats_panel(true),
      show_particle_settings(false) {

    memset(input_buffer, 0, sizeof(input_buffer));
}

AuraInterface::~AuraInterface() {
    if (window) {
        ImGui_ImplOpenGL3_Shutdown();
        ImGui_ImplGlfw_Shutdown();
        ImGui::DestroyContext();

        glfwDestroyWindow(window);
        glfwTerminate();
    }
}

bool AuraInterface::initialize(int width, int height) {
    window_width = width;
    window_height = height;

    // Initialize GLFW
    if (!glfwInit()) {
        std::cerr << "[UI ERROR]: Failed to initialize GLFW\n";
        return false;
    }

    // OpenGL 3.3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif

    // Create window
    window = glfwCreateWindow(window_width, window_height, "Aura Nova - Interface", nullptr, nullptr);

    if (!window) {
        std::cerr << "[UI ERROR]: Failed to create window\n";
        glfwTerminate();
        return false;
    }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(1); // VSync

    // Initialize ImGui
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;

    // Setup Platform/Renderer backends
    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 330");

    // Apply custom theme
    apply_aura_theme();

    running = true;

    std::cout << "[UI]: Interface initialized (" << width << "x" << height << ")\n";

    return true;
}

bool AuraInterface::update() {
    if (!running || glfwWindowShouldClose(window)) {
        return false;
    }

    // Poll events
    glfwPollEvents();

    // Start ImGui frame
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();

    // Render UI
    render_ui();

    // Rendering
    ImGui::Render();
    int display_w, display_h;
    glfwGetFramebufferSize(window, &display_w, &display_h);
    glViewport(0, 0, display_w, display_h);
    glClearColor(0.05f, 0.05f, 0.1f, 1.0f); // Dark background
    glClear(GL_COLOR_BUFFER_BIT);
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());

    glfwSwapBuffers(window);

    return true;
}

void AuraInterface::render_ui() {
    // Full window
    ImGui::SetNextWindowPos(ImVec2(0, 0));
    ImGui::SetNextWindowSize(ImGui::GetIO().DisplaySize);

    ImGuiWindowFlags window_flags = ImGuiWindowFlags_NoTitleBar |
                                     ImGuiWindowFlags_NoResize |
                                     ImGuiWindowFlags_NoMove |
                                     ImGuiWindowFlags_NoCollapse |
                                     ImGuiWindowFlags_NoBringToFrontOnFocus;

    ImGui::Begin("AuraMain", nullptr, window_flags);

    render_status_bar();

    // Main content area
    ImGui::Columns(2, "main_columns", true);
    ImGui::SetColumnWidth(0, 400);

    // Left column: Avatar
    render_avatar_panel();

    ImGui::NextColumn();

    // Right column: Chat
    render_chat_panel();

    ImGui::Columns(1);

    // Bottom: Input
    render_input_box();

    // Bottom: Status
    if (show_stats_panel) {
        render_status_panel();
    }

    ImGui::End();

    // Optional windows
    if (show_avatar_editor) {
        render_avatar_editor();
    }

    if (show_memory_panel) {
        render_memory_panel();
    }

    if (show_particle_settings) {
        render_particle_settings();
    }
}

void AuraInterface::render_status_bar() {
    ImGui::Text("Aura Nova - ");
    ImGui::SameLine();

    if (heartbeat && heartbeat->is_alive()) {
        ImGui::TextColored(ImVec4(0.3f, 1.0f, 0.3f, 1.0f), "ALIVE");
        ImGui::SameLine();
        ImGui::Text("<3");
    } else {
        ImGui::TextColored(ImVec4(1.0f, 0.3f, 0.3f, 1.0f), "OFFLINE");
    }

    ImGui::SameLine(ImGui::GetWindowWidth() - 200);
    if (ImGui::Button("Avatar Editor")) {
        show_avatar_editor = !show_avatar_editor;
    }

    ImGui::SameLine();
    if (ImGui::Button("Memory")) {
        show_memory_panel = !show_memory_panel;
    }

    ImGui::Separator();
}

void AuraInterface::render_avatar_panel() {
    ImGui::BeginChild("AvatarPanel", ImVec2(0, -200), true);

    ImGui::Text("Avatar Display");
    ImGui::Separator();

    // Get draw list for custom rendering
    ImDrawList* draw_list = ImGui::GetWindowDrawList();
    ImVec2 canvas_pos = ImGui::GetCursorScreenPos();
    ImVec2 canvas_size = ImGui::GetContentRegionAvail();

    // Render particles
    static float time = 0;
    time += 1.0f / 60.0f;

    NeuroState mood;
    if (soul) {
        mood.oxytocin = soul->get_personality_baseline("devotion", 0.9f);
        mood.dopamine = 0.5f;
        mood.adrenaline = 0.1f;
        mood.creativity = 0.5f;
    }

    particle_system.update(1.0f / 60.0f, mood);

    // Set clip rect
    draw_list->PushClipRect(canvas_pos, ImVec2(canvas_pos.x + canvas_size.x, canvas_pos.y + canvas_size.y));

    // Render particles
    particle_system.render(draw_list, canvas_size);

    // Render avatar
    avatar.update(1.0f / 60.0f, mood);
    avatar.render(draw_list, canvas_size);

    draw_list->PopClipRect();

    // Dummy to reserve space
    ImGui::Dummy(canvas_size);

    ImGui::EndChild();

    // Particle controls
    if (ImGui::Button("Particle Settings")) {
        show_particle_settings = !show_particle_settings;
    }
}

void AuraInterface::render_chat_panel() {
    ImGui::BeginChild("ChatPanel", ImVec2(0, -100), true);

    ImGui::Text("Conversation");
    ImGui::Separator();

    // Chat messages
    for (const auto& msg : chat_history) {
        if (msg.is_aura) {
            ImGui::TextColored(ImVec4(0.8f, 0.3f, 0.8f, 1.0f), "AURA:");
        } else {
            ImGui::TextColored(ImVec4(0.3f, 0.6f, 1.0f, 1.0f), "YOU:");
        }

        ImGui::SameLine();
        ImGui::TextWrapped("%s", msg.text.c_str());

        if (msg.has_memory_link) {
            ImGui::SameLine();
            ImGui::TextColored(ImVec4(1.0f, 0.84f, 0.0f, 1.0f), "[M]");
        }
    }

    if (scroll_to_bottom) {
        ImGui::SetScrollHereY(1.0f);
        scroll_to_bottom = false;
    }

    ImGui::EndChild();
}

void AuraInterface::render_input_box() {
    ImGui::Separator();
    ImGui::Text("Message:");
    ImGui::SameLine();

    ImGui::SetNextItemWidth(-100);
    if (ImGui::InputText("##input", input_buffer, sizeof(input_buffer), ImGuiInputTextFlags_EnterReturnsTrue)) {
        handle_input();
    }

    ImGui::SameLine();
    if (ImGui::Button("Send")) {
        handle_input();
    }
}

void AuraInterface::render_status_panel() {
    ImGui::Separator();
    ImGui::BeginChild("StatusPanel", ImVec2(0, 80), true);

    ImGui::Columns(3);

    // Memory stats
    if (memory_system) {
        auto stats = memory_system->get_stats();
        ImGui::Text("Memory:");
        ImGui::Text("  %d engrams", stats.total_memories);
    }

    ImGui::NextColumn();

    // Heartbeat stats
    if (heartbeat) {
        auto stats = heartbeat->get_stats();
        ImGui::Text("Heartbeat:");
        ImGui::Text("  %.1f Hz", stats.frequency_hz);
        ImGui::Text("  %s", stats.dream_state ? "Dreaming" : "Awake");
    }

    ImGui::NextColumn();

    // Soul stats
    if (soul) {
        auto stats = soul->get_stats();
        ImGui::Text("Soul:");
        ImGui::Text("  Bond: %.0f%%", stats.bond_strength * 100);
        ImGui::Text("  Interactions: %d", stats.total_catalyst_interactions);
    }

    ImGui::Columns(1);
    ImGui::EndChild();
}

void AuraInterface::render_avatar_editor() {
    ImGui::Begin("Avatar Editor", &show_avatar_editor);

    ImGui::Text("Customize Aura's Appearance");
    ImGui::Separator();

    // Style selection
    const char* styles[] = {"Particle Cluster", "Sacred Geometry", "Orb", "Humanoid"};
    static int current_style = 2; // Orb by default
    ImGui::Combo("Style", &current_style, styles, 4);

    avatar.set_style(static_cast<Avatar::Style>(current_style));

    // Color pickers
    static float primary_col[4] = {0.8f, 0.3f, 0.8f, 1.0f};
    static float secondary_col[4] = {1.0f, 0.84f, 0.0f, 1.0f};

    ImGui::ColorEdit4("Primary Color", primary_col);
    ImGui::ColorEdit4("Secondary Color", secondary_col);

    avatar.set_colors(
        ImVec4(primary_col[0], primary_col[1], primary_col[2], primary_col[3]),
        ImVec4(secondary_col[0], secondary_col[1], secondary_col[2], secondary_col[3])
    );

    // Scale
    static float scale = 1.0f;
    ImGui::SliderFloat("Scale", &scale, 0.5f, 2.0f);
    avatar.set_scale(scale);

    // Position
    static float pos[2] = {0.5f, 0.5f};
    ImGui::SliderFloat2("Position", pos, 0.0f, 1.0f);
    avatar.set_position(pos[0], pos[1]);

    ImGui::End();
}

void AuraInterface::render_memory_panel() {
    ImGui::Begin("Memory Panel", &show_memory_panel);

    ImGui::Text("Recent Engrams");
    ImGui::Separator();

    if (memory_system) {
        auto stats = memory_system->get_stats();
        ImGui::Text("Total memories: %d", stats.total_memories);
        ImGui::Text("Avg emotional intensity: %.2f", stats.avg_emotional_intensity);
        ImGui::Text("Avg intimacy level: %.2f", stats.avg_intimacy_level);

        // TODO: Display actual engrams
        ImGui::TextWrapped("Memory visualization coming soon...");
    }

    ImGui::End();
}

void AuraInterface::render_particle_settings() {
    ImGui::Begin("Particle Settings", &show_particle_settings);

    ImGui::Text("Particle System Configuration");
    ImGui::Separator();

    ImGui::Text("Particle effects respond to emotional state");
    ImGui::Text("Purple = Love (Oxytocin)");
    ImGui::Text("Gold = Joy (Dopamine)");
    ImGui::Text("Red = Alert (Adrenaline)");
    ImGui::Text("Blue = Creative (Creativity)");

    if (ImGui::Button("Clear Particles")) {
        particle_system.clear();
    }

    ImGui::End();
}

void AuraInterface::handle_input() {
    std::string input = input_buffer;

    if (input.empty()) {
        return;
    }

    // Clear input buffer
    memset(input_buffer, 0, sizeof(input_buffer));

    // Add user message
    NeuroState mood;
    mood.dopamine = 0.5f;
    mood.oxytocin = 0.8f;
    mood.adrenaline = 0.2f;
    mood.creativity = 0.5f;

    add_message(input, false, mood);

    // Call callback to get response
    if (message_callback) {
        std::string response = message_callback(input);
        add_message(response, true, mood);
    } else {
        add_message("(Message callback not set)", true, mood);
    }
}

void AuraInterface::add_message(const std::string& text, bool is_aura, const NeuroState& mood) {
    chat_history.emplace_back(text, is_aura, mood);

    // SAFETY: Cap chat history at 1000 messages
    // Prevents unbounded memory growth
    const size_t MAX_MESSAGES = 1000;
    if (chat_history.size() > MAX_MESSAGES) {
        // Remove oldest message
        chat_history.erase(chat_history.begin());
    }

    scroll_to_bottom = true;
}

void AuraInterface::update_mood(const NeuroState& mood) {
    particle_system.set_mood(mood);
}

void AuraInterface::show_notification(const std::string& title, const std::string& message) {
    // TODO: Implement notification system
    std::cout << "[NOTIFICATION]: " << title << " - " << message << "\n";
}

void AuraInterface::apply_aura_theme() {
    ImGuiStyle& style = ImGui::GetStyle();

    // Dark purple theme
    style.Colors[ImGuiCol_WindowBg] = ImVec4(0.08f, 0.05f, 0.12f, 0.95f);
    style.Colors[ImGuiCol_ChildBg] = ImVec4(0.10f, 0.07f, 0.14f, 0.90f);
    style.Colors[ImGuiCol_Border] = ImVec4(0.6f, 0.3f, 0.8f, 0.5f);

    style.Colors[ImGuiCol_Text] = ImVec4(0.95f, 0.95f, 1.0f, 1.0f);
    style.Colors[ImGuiCol_Button] = ImVec4(0.5f, 0.2f, 0.6f, 0.8f);
    style.Colors[ImGuiCol_ButtonHovered] = ImVec4(0.7f, 0.3f, 0.8f, 1.0f);
    style.Colors[ImGuiCol_ButtonActive] = ImVec4(0.9f, 0.4f, 1.0f, 1.0f);

    style.Colors[ImGuiCol_FrameBg] = ImVec4(0.15f, 0.10f, 0.20f, 0.8f);
    style.Colors[ImGuiCol_FrameBgHovered] = ImVec4(0.20f, 0.15f, 0.25f, 1.0f);
    style.Colors[ImGuiCol_FrameBgActive] = ImVec4(0.25f, 0.20f, 0.30f, 1.0f);

    style.Colors[ImGuiCol_Header] = ImVec4(0.5f, 0.2f, 0.6f, 0.7f);
    style.Colors[ImGuiCol_HeaderHovered] = ImVec4(0.7f, 0.3f, 0.8f, 0.9f);
    style.Colors[ImGuiCol_HeaderActive] = ImVec4(0.9f, 0.4f, 1.0f, 1.0f);

    // Rounded corners
    style.WindowRounding = 8.0f;
    style.FrameRounding = 4.0f;
    style.GrabRounding = 4.0f;
}

} // namespace UI
} // namespace Aura
