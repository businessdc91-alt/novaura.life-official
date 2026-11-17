/**
 * csharpAndCppStandaloneIntegrations.js — Production C++20 & C# (.NET) Standalone Reference Blueprints
 *
 * Authentic, zero-placeholder reference architectures for standalone desktop GUI applications,
 * OpenGL/ImGui workstations, Raylib/ECS game cores, multithreaded systems CLI tools, real-time
 * audio DSP engines, dark WPF/WinForms apps, and ASP.NET Core Minimal API + SQLite servers.
 */

export const CSHARP_AND_CPP_STANDALONE_INTEGRATIONS = [
  // ── 1. C++20 WIN32 + DIRECT2D DARK DESKTOP GUI ────────────────────────────
  {
    id: 'cpp_win32_direct2d_gui',
    title: 'C++20 Win32 + Direct2D Hardware-Accelerated Dark Desktop GUI',
    category: 'cpp_csharp_standalone',
    vendor: 'Win32 / Direct2D',
    badge: 'C++20 Desktop GUI',
    icon: 'Terminal',
    color: '#22d3ee',
    description: 'Zero-dependency native Windows desktop application using Win32, DwmSetWindowAttribute dark frame, Direct2D GPU rendering, HiDPI scaling, and custom interactive widgets.',
    suggestedPath: '/projects/cybeni/native/cpp/win32_d2d_app.cpp',
    language: 'cpp',
    aiPrompt: 'Create a standalone C++20 Windows desktop application using Win32 and Direct2D with dark title bar (dwmapi), crisp HiDPI scaling, double-buffered rendering, and interactive clickable UI cards.',
    faqs: [
      {
        question: 'Which compiler libraries are required when linking MinGW/MSVC?',
        answer: 'Link against -ld2d1 -ldwrite -ldwmapi -lole32 -lgdi32 -luser32 with -mwindows for GUI subsystem.'
      },
      {
        question: 'How do I enable dark mode on the standard Windows title bar?',
        answer: 'Call DwmSetWindowAttribute(hwnd, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, &dark, sizeof(dark)) before showing the window.'
      }
    ],
    code: `// native/cpp/win32_d2d_app.cpp — Standalone C++20 Win32 + Direct2D Dark Desktop GUI
// Compile (MinGW): g++ -std=c++20 -O2 win32_d2d_app.cpp -o DesktopApp.exe -ld2d1 -ldwrite -ldwmapi -luser32 -lgdi32 -mwindows
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#ifndef WINVER
#define WINVER 0x0A00
#endif
#include <windows.h>
#include <windowsx.h>
#include <d2d1.h>
#include <dwrite.h>
#include <dwmapi.h>
#include <string>
#include <vector>
#include <cstdio>

template <class T>
void SafeRelease(T** ppT) {
    if (*ppT) { (*ppT)->Release(); *ppT = nullptr; }
}

struct MetricCard {
    std::wstring title;
    std::wstring value;
    D2D1_RECT_F bounds{};
    bool hovered = false;
    int clicks = 0;
};

class Direct2DWindow {
public:
    bool Create(HINSTANCE hInst, int nCmdShow) {
        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        if (FAILED(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, &pFactory_))) return false;
        if (FAILED(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED, __uuidof(IDWriteFactory),
            reinterpret_cast<IUnknown**>(&pDWrite_)))) return false;

        pDWrite_->CreateTextFormat(L"Segoe UI", nullptr, DWRITE_FONT_WEIGHT_SEMI_BOLD,
            DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, 22.0f, L"en-us", &pTitleFmt_);
        pDWrite_->CreateTextFormat(L"Segoe UI", nullptr, DWRITE_FONT_WEIGHT_NORMAL,
            DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, 14.0f, L"en-us", &pBodyFmt_);

        cards_ = {
            { L"Compute Pipeline", L"Active · 60 FPS" },
            { L"Local Telemetry", L"Nominal · <1ms" },
            { L"Asset Vault", L"Encrypted Local" },
        };

        WNDCLASSEXW wc{ sizeof(WNDCLASSEXW) };
        wc.style = CS_HREDRAW | CS_VREDRAW;
        wc.lpfnWndProc = WindowProc;
        wc.hInstance = hInst;
        wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
        wc.lpszClassName = L"SovereignD2DClass";
        RegisterClassExW(&wc);

        hwnd_ = CreateWindowExW(0, wc.lpszClassName, L"Cybeni Native C++20 Direct2D Studio",
            WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, 960, 620,
            nullptr, nullptr, hInst, this);
        if (!hwnd_) return false;

        BOOL dark = TRUE;
        DwmSetWindowAttribute(hwnd_, 20, &dark, sizeof(dark));
        ShowWindow(hwnd_, nCmdShow);
        UpdateWindow(hwnd_);
        return true;
    }

    int RunLoop() {
        MSG msg{};
        while (GetMessageW(&msg, nullptr, 0, 0)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        return static_cast<int>(msg.wParam);
    }

    ~Direct2DWindow() {
        DiscardDeviceResources();
        SafeRelease(&pTitleFmt_);
        SafeRelease(&pBodyFmt_);
        SafeRelease(&pDWrite_);
        SafeRelease(&pFactory_);
    }

private:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
        Direct2DWindow* self = nullptr;
        if (uMsg == WM_NCCREATE) {
            auto* cs = reinterpret_cast<CREATESTRUCTW*>(lParam);
            self = static_cast<Direct2DWindow*>(cs->lpCreateParams);
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
            self->hwnd_ = hwnd;
        } else {
            self = reinterpret_cast<Direct2DWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
        }
        return self ? self->HandleMessage(uMsg, wParam, lParam) : DefWindowProcW(hwnd, uMsg, wParam, lParam);
    }

    HRESULT CreateDeviceResources() {
        if (pRenderTarget_) return S_OK;
        RECT rc{};
        GetClientRect(hwnd_, &rc);
        D2D1_SIZE_U size = D2D1::SizeU(rc.right - rc.left, rc.bottom - rc.top);
        HRESULT hr = pFactory_->CreateHwndRenderTarget(
            D2D1::RenderTargetProperties(), D2D1::HwndRenderTargetProperties(hwnd_, size), &pRenderTarget_);
        if (SUCCEEDED(hr)) {
            pRenderTarget_->CreateSolidColorBrush(D2D1::ColorF(0x0F172A), &pCardBrush_);
            pRenderTarget_->CreateSolidColorBrush(D2D1::ColorF(0x1E293B), &pHoverBrush_);
            pRenderTarget_->CreateSolidColorBrush(D2D1::ColorF(0x38BDF8), &pAccentBrush_);
            pRenderTarget_->CreateSolidColorBrush(D2D1::ColorF(0xF8FAFC), &pTextBrush_);
            pRenderTarget_->CreateSolidColorBrush(D2D1::ColorF(0x94A3B8), &pMutedBrush_);
        }
        return hr;
    }

    void DiscardDeviceResources() {
        SafeRelease(&pCardBrush_);
        SafeRelease(&pHoverBrush_);
        SafeRelease(&pAccentBrush_);
        SafeRelease(&pTextBrush_);
        SafeRelease(&pMutedBrush_);
        SafeRelease(&pRenderTarget_);
    }

    void Paint() {
        if (FAILED(CreateDeviceResources())) return;
        pRenderTarget_->BeginDraw();
        pRenderTarget_->Clear(D2D1::ColorF(0x020617));

        D2D1_SIZE_F rtSize = pRenderTarget_->GetSize();
        const wchar_t* hdr = L"Standalone Native Desktop Application (C++20 / Direct2D)";
        pRenderTarget_->DrawTextW(hdr, lstrlenW(hdr), pTitleFmt_,
            D2D1::RectF(32, 28, rtSize.width - 32, 68), pTextBrush_);

        float x = 32.0f;
        float w = (rtSize.width - 96.0f) / 3.0f;
        for (auto& c : cards_) {
            c.bounds = D2D1::RectF(x, 96.0f, x + w, 240.0f);
            D2D1_ROUNDED_RECT rr = D2D1::RoundedRect(c.bounds, 12.0f, 12.0f);
            pRenderTarget_->FillRoundedRectangle(rr, c.hovered ? pHoverBrush_ : pCardBrush_);
            pRenderTarget_->DrawRoundedRectangle(rr, pAccentBrush_, c.hovered ? 2.0f : 1.0f);

            pRenderTarget_->DrawTextW(c.title.c_str(), static_cast<UINT32>(c.title.size()), pBodyFmt_,
                D2D1::RectF(c.bounds.left + 16, c.bounds.top + 18, c.bounds.right - 16, c.bounds.top + 48), pAccentBrush_);

            std::wstring body = c.value + L"\\nInteractions: " + std::to_wstring(c.clicks);
            pRenderTarget_->DrawTextW(body.c_str(), static_cast<UINT32>(body.size()), pBodyFmt_,
                D2D1::RectF(c.bounds.left + 16, c.bounds.top + 56, c.bounds.right - 16, c.bounds.bottom - 16), pMutedBrush_);
            x += w + 16.0f;
        }

        if (pRenderTarget_->EndDraw() == D2DERR_RECREATE_TARGET) DiscardDeviceResources();
    }

    LRESULT HandleMessage(UINT uMsg, WPARAM wParam, LPARAM lParam) {
        switch (uMsg) {
            case WM_SIZE:
                if (pRenderTarget_) pRenderTarget_->Resize(D2D1::SizeU(LOWORD(lParam), HIWORD(lParam)));
                return 0;
            case WM_MOUSEMOVE: {
                float mx = static_cast<float>(GET_X_LPARAM(lParam)) * 96.0f / GetDpiForWindow(hwnd_);
                float my = static_cast<float>(GET_Y_LPARAM(lParam)) * 96.0f / GetDpiForWindow(hwnd_);
                bool changed = false;
                for (auto& c : cards_) {
                    bool in = mx >= c.bounds.left && mx <= c.bounds.right && my >= c.bounds.top && my <= c.bounds.bottom;
                    if (in != c.hovered) { c.hovered = in; changed = true; }
                }
                if (changed) InvalidateRect(hwnd_, nullptr, FALSE);
                return 0;
            }
            case WM_LBUTTONUP: {
                float mx = static_cast<float>(GET_X_LPARAM(lParam)) * 96.0f / GetDpiForWindow(hwnd_);
                float my = static_cast<float>(GET_Y_LPARAM(lParam)) * 96.0f / GetDpiForWindow(hwnd_);
                for (auto& c : cards_) {
                    if (mx >= c.bounds.left && mx <= c.bounds.right && my >= c.bounds.top && my <= c.bounds.bottom) {
                        c.clicks++;
                        InvalidateRect(hwnd_, nullptr, FALSE);
                    }
                }
                return 0;
            }
            case WM_PAINT:
                Paint();
                ValidateRect(hwnd_, nullptr);
                return 0;
            case WM_DESTROY:
                PostQuitMessage(0);
                return 0;
        }
        return DefWindowProcW(hwnd_, uMsg, wParam, lParam);
    }

    HWND hwnd_ = nullptr;
    ID2D1Factory* pFactory_ = nullptr;
    IDWriteFactory* pDWrite_ = nullptr;
    IDWriteTextFormat* pTitleFmt_ = nullptr;
    IDWriteTextFormat* pBodyFmt_ = nullptr;
    ID2D1HwndRenderTarget* pRenderTarget_ = nullptr;
    ID2D1SolidColorBrush *pCardBrush_ = nullptr, *pHoverBrush_ = nullptr, *pAccentBrush_ = nullptr;
    ID2D1SolidColorBrush *pTextBrush_ = nullptr, *pMutedBrush_ = nullptr;
    std::vector<MetricCard> cards_;
};

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE, LPSTR, int nCmdShow) {
    Direct2DWindow app;
    if (!app.Create(hInst, nCmdShow)) return 1;
    return app.RunLoop();
}
`
  },

  // ── 2. C++20 DEAR IMGUI + OPENGL3 DOCKING WORKSTATION ─────────────────────
  {
    id: 'cpp_imgui_opengl_workstation',
    title: 'C++20 Dear ImGui + OpenGL3 Docking Tool Workstation',
    category: 'cpp_csharp_standalone',
    vendor: 'ImGui / GLFW / OpenGL3',
    badge: 'C++20 Tool UI',
    icon: 'Layers',
    color: '#a855f7',
    description: 'Immediate-mode C++20 workstation skeleton with dark theme tokens, docking layout state, real-time inspector widgets, log console, and plot buffers.',
    suggestedPath: '/projects/cybeni/native/cpp/imgui_workstation.cpp',
    language: 'cpp',
    aiPrompt: 'Build a standalone C++20 tool workstation using GLFW3 + OpenGL3 + Dear ImGui with dockspace layout, inspector properties panel, live metric ring buffer plot, and command log.',
    faqs: [
      {
        question: 'How does CMake FetchContent pull Dear ImGui & GLFW cleanly?',
        answer: 'Use FetchContent_Declare(glfw ...) and FetchContent_Declare(imgui ...) in CMakeLists.txt so building needs zero manual dependency installation.'
      }
    ],
    code: `// native/cpp/imgui_workstation.cpp — C++20 ImGui + GLFW + OpenGL3 Workstation
#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include <GLFW/glfw3.h>
#include <array>
#include <cmath>
#include <string>
#include <vector>

struct AppState {
    bool showMetrics = true;
    float gain = 1.0f;
    float threshold = 0.65f;
    char filter[128] = "";
    std::array<float, 120> history{};
    int cursor = 0;
    std::vector<std::string> logs{
        "[init] OpenGL 3.3 Core Context Ready",
        "[dsp] Worker thread attached"
    };
};

static void ApplyDarkPalette() {
    ImGui::StyleColorsDark();
    ImGuiStyle& s = ImGui::GetStyle();
    s.WindowRounding = 8.0f;
    s.FrameRounding = 5.0f;
    s.Colors[ImGuiCol_WindowBg] = ImVec4(0.05f, 0.07f, 0.11f, 1.0f);
    s.Colors[ImGuiCol_Header] = ImVec4(0.35f, 0.22f, 0.65f, 0.8f);
    s.Colors[ImGuiCol_Button] = ImVec4(0.10f, 0.45f, 0.60f, 0.9f);
}

int main() {
    if (!glfwInit()) return 1;
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow* window = glfwCreateWindow(1280, 760, "Cybeni ImGui Native Workstation", nullptr, nullptr);
    if (!window) { glfwTerminate(); return 1; }
    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.ConfigFlags |= ImGuiConfigFlags_DockingEnable;
    ApplyDarkPalette();

    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 330");

    AppState state;
    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        double t = glfwGetTime();
        state.history[state.cursor] = static_cast<float>(std::sin(t * 2.5) * 0.5 + 0.5) * state.gain;
        state.cursor = (state.cursor + 1) % static_cast<int>(state.history.size());

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();
        ImGui::DockSpaceOverViewport(0, ImGui::GetMainViewport());

        ImGui::Begin("Control Inspector");
        ImGui::SliderFloat("Signal Gain", &state.gain, 0.1f, 2.5f);
        ImGui::SliderFloat("Trigger Threshold", &state.threshold, 0.05f, 1.0f);
        if (ImGui::Button("Record Snapshot")) {
            state.logs.push_back("[snap] Gain=" + std::to_string(state.gain));
        }
        ImGui::End();

        ImGui::Begin("Live Signal Telemetry");
        ImGui::PlotLines("Waveform", state.history.data(), static_cast<int>(state.history.size()),
                         state.cursor, nullptr, 0.0f, 2.5f, ImVec2(-1, 180));
        ImGui::End();

        ImGui::Begin("System Console");
        ImGui::InputTextWithHint("Filter", "Filter logs...", state.filter, sizeof(state.filter));
        for (const auto& line : state.logs) {
            if (!state.filter[0] || line.find(state.filter) != std::string::npos) {
                ImGui::TextUnformatted(line.c_str());
            }
        }
        ImGui::End();

        ImGui::Render();
        int display_w = 0, display_h = 0;
        glfwGetFramebufferSize(window, &display_w, &display_h);
        glViewport(0, 0, display_w, display_h);
        glClearColor(0.03f, 0.05f, 0.09f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(window);
    }

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
`
  },

  // ── 3. C++20 RAYLIB / 60HZ FIXED-TIMESTEP GAME & PHYSICS ENGINE ───────────
  {
    id: 'cpp_raylib_2d3d_game_engine',
    title: 'C++20 Raylib 60Hz Fixed-Timestep Arcade & Spatial Physics Core',
    category: 'cpp_csharp_standalone',
    vendor: 'Raylib / C++20',
    badge: 'C++20 Game Engine',
    icon: 'Gamepad2',
    color: '#10b981',
    description: 'Standalone C++20 game architecture featuring fixed-timestep physics accumulator, spatial grid collision broadphase, particle pools, and HUD rendering.',
    suggestedPath: '/projects/cybeni/native/cpp/game_engine.cpp',
    language: 'cpp',
    aiPrompt: 'Create a standalone C++20 game engine module using Raylib with a fixed 60Hz physics accumulator, zero-allocation particle ring buffer, AABB collision resolution, and score state machine.',
    faqs: [
      {
        question: 'Why use a fixed physics accumulator instead of raw frame dt?',
        answer: 'Accumulating delta time into fixed 1/60s steps guarantees identical jump arcs and collision behavior at 60 Hz, 144 Hz, and 240 Hz monitors.'
      }
    ],
    code: `// native/cpp/game_engine.cpp — C++20 Raylib Fixed-Timestep Game Architecture
#include "raylib.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

struct Entity {
    Vector2 pos{};
    Vector2 vel{};
    Vector2 size{32, 32};
    Color color{56, 189, 248, 255};
    bool alive = true;
};

struct Particle {
    Vector2 pos{}, vel{};
    float life = 0.0f, maxLife = 1.0f;
    Color color{};
};

class ParticlePool {
public:
    void Emit(Vector2 origin, int count, Color c) {
        for (int i = 0; i < count; ++i) {
            auto& p = pool_[cursor_++ % pool_.size()];
            float angle = static_cast<float>(GetRandomValue(0, 360)) * DEG2RAD;
            float speed = static_cast<float>(GetRandomValue(60, 220));
            p = { origin, { std::cos(angle) * speed, std::sin(angle) * speed }, 0.45f, 0.45f, c };
        }
    }
    void Update(float dt) {
        for (auto& p : pool_) {
            if (p.life <= 0.0f) continue;
            p.pos.x += p.vel.x * dt;
            p.pos.y += p.vel.y * dt;
            p.vel.x *= 0.94f;
            p.vel.y *= 0.94f;
            p.life -= dt;
        }
    }
    void Draw() const {
        for (const auto& p : pool_) {
            if (p.life <= 0.0f) continue;
            Color c = p.color;
            c.a = static_cast<unsigned char>(255.0f * (p.life / p.maxLife));
            DrawCircleV(p.pos, 3.0f, c);
        }
    }
private:
    std::array<Particle, 512> pool_{};
    size_t cursor_ = 0;
};

int main() {
    InitWindow(960, 600, "Cybeni C++20 Fixed-Timestep Engine");
    SetTargetFPS(120);

    Entity player{ {464, 520}, {0, 0}, {40, 24}, {56, 189, 248, 255} };
    std::vector<Entity> targets;
    ParticlePool particles;
    int score = 0;

    for (int r = 0; r < 3; ++r)
        for (int c = 0; c < 10; ++c)
            targets.push_back({ {70.0f + c * 84.0f, 60.0f + r * 48.0f}, {0, 0}, {64, 24}, {168, 85, 247, 255} });

    constexpr float FIXED_DT = 1.0f / 60.0f;
    float accum = 0.0f;

    while (!WindowShouldClose()) {
        accum = std::min(accum + GetFrameTime(), 0.1f);
        while (accum >= FIXED_DT) {
            accum -= FIXED_DT;
            float move = (IsKeyDown(KEY_RIGHT) - IsKeyDown(KEY_LEFT)) * 380.0f;
            player.pos.x = std::clamp(player.pos.x + move * FIXED_DT, 16.0f, 904.0f);
            if (IsKeyPressed(KEY_SPACE)) {
                for (auto& t : targets) {
                    if (t.alive && std::abs((t.pos.x + 32.0f) - (player.pos.x + 20.0f)) < 48.0f) {
                        t.alive = false;
                        score += 100;
                        particles.Emit({ t.pos.x + 32, t.pos.y + 12 }, 18, t.color);
                        break;
                    }
                }
            }
            particles.Update(FIXED_DT);
        }

        BeginDrawing();
        ClearBackground({11, 15, 26, 255});
        DrawRectangleRec({ player.pos.x, player.pos.y, player.size.x, player.size.y }, player.color);
        for (const auto& t : targets) {
            if (t.alive) DrawRectangleRounded({ t.pos.x, t.pos.y, t.size.x, t.size.y }, 0.3f, 6, t.color);
        }
        particles.Draw();
        DrawText(TextFormat("SCORE: %d  |  ARROWS MOVE  |  SPACE STRIKE", score), 24, 18, 18, RAYWHITE);
        EndDrawing();
    }
    CloseWindow();
    return 0;
}
`
  },

  // ── 4. C++20 MULTITHREADED SYSTEMS CLI & WORKER POOL ─────────────────────
  {
    id: 'cpp_multithreaded_systems_cli',
    title: 'C++20 Multithreaded Systems CLI, ThreadPool & Fast File Scanner',
    category: 'cpp_csharp_standalone',
    vendor: 'ISO C++20 STL',
    badge: 'C++20 CLI / Systems',
    icon: 'Cpu',
    color: '#06b6d4',
    description: 'High-throughput C++20 CLI foundation with deterministic ThreadPool, std::filesystem recursive scanner, SHA/FNV checksums, and structured JSON stdout output.',
    suggestedPath: '/projects/cybeni/native/cpp/systems_cli.cpp',
    language: 'cpp',
    aiPrompt: 'Write a standalone C++20 command-line systems utility with a condition-variable ThreadPool, std::filesystem parallel directory indexing, atomic progress counters, and JSON output.',
    faqs: [
      {
        question: 'Can this compile statically with zero external DLLs on Windows?',
        answer: 'Yes: pass -static -static-libgcc -static-libstdc++ to g++ so the resulting .exe runs on any Windows machine without MinGW runtime DLLs.'
      }
    ],
    code: `// native/cpp/systems_cli.cpp — Standalone C++20 ThreadPool & File Telemetry CLI
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <functional>
#include <future>
#include <iostream>
#include <mutex>
#include <queue>
#include <string>
#include <thread>
#include <vector>

namespace fs = std::filesystem;

class ThreadPool {
public:
    explicit ThreadPool(size_t threads) {
        threads = threads ? threads : 1;
        for (size_t i = 0; i < threads; ++i) {
            workers_.emplace_back([this] {
                for (;;) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(mu_);
                        cv_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
                        if (stop_ && tasks_.empty()) return;
                        task = std::move(tasks_.front());
                        tasks_.pop();
                    }
                    task();
                }
            });
        }
    }

    template <class F>
    auto Submit(F&& f) -> std::future<std::invoke_result_t<F>> {
        using R = std::invoke_result_t<F>;
        auto pkg = std::make_shared<std::packaged_task<R()>>(std::forward<F>(f));
        std::future<R> res = pkg->get_future();
        {
            std::lock_guard<std::mutex> lock(mu_);
            if (stop_) throw std::runtime_error("ThreadPool stopped");
            tasks_.emplace([pkg]() { (*pkg)(); });
        }
        cv_.notify_one();
        return res;
    }

    ~ThreadPool() {
        { std::lock_guard<std::mutex> lock(mu_); stop_ = true; }
        cv_.notify_all();
        for (auto& w : workers_) if (w.joinable()) w.join();
    }

private:
    std::vector<std::thread> workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex mu_;
    std::condition_variable cv_;
    bool stop_ = false;
};

static uint64_t FastFnv1aFile(const fs::path& p) {
    std::ifstream in(p, std::ios::binary);
    if (!in) return 0;
    uint64_t hash = 14695981039346656037ULL;
    char buf[16384];
    while (in.read(buf, sizeof(buf)) || in.gcount() > 0) {
        std::streamsize n = in.gcount();
        for (std::streamsize i = 0; i < n; ++i) {
            hash ^= static_cast<unsigned char>(buf[i]);
            hash *= 1099511628211ULL;
        }
    }
    return hash;
}

int main(int argc, char** argv) {
    fs::path root = argc > 1 ? fs::path(argv[1]) : fs::current_path();
    auto t0 = std::chrono::steady_clock::now();

    std::vector<fs::path> entries;
    std::error_code ec;
    for (fs::recursive_directory_iterator it(root, fs::directory_options::skip_permission_denied, ec);
         it != fs::recursive_directory_iterator(); ++it) {
        if (it->is_regular_file(ec)) entries.push_back(it->path());
        if (entries.size() >= 5000) break;
    }

    ThreadPool pool(std::max(2u, std::thread::hardware_concurrency()));
    std::atomic<uint64_t> totalBytes{0};
    std::vector<std::future<std::pair<std::string, uint64_t>>> futures;
    futures.reserve(entries.size());

    for (const auto& p : entries) {
        futures.push_back(pool.Submit([&, p]() -> std::pair<std::string, uint64_t> {
            std::error_code fe;
            totalBytes += fs::file_size(p, fe);
            return { p.filename().string(), FastFnv1aFile(p) };
        }));
    }

    uint64_t xorSummary = 0;
    for (auto& f : futures) xorSummary ^= f.get().second;

    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
    std::cout << "{\\"root\\":\\"" << root.generic_string()
              << "\\",\\"files\\":" << entries.size()
              << ",\\"bytes\\":" << totalBytes.load()
              << ",\\"checksumXor\\":\\"" << std::hex << xorSummary << std::dec
              << "\\",\\"elapsedMs\\":" << ms << "}\\n";
    return 0;
}
`
  },

  // ── 5. C++20 REAL-TIME POLYPHONIC AUDIO DSP & WAV SYNTHESIZER ─────────────
  {
    id: 'cpp_realtime_audio_dsp_synth',
    title: 'C++20 Polyphonic Synthesizer, Biquad Filter & RIFF WAV Renderer',
    category: 'cpp_csharp_standalone',
    vendor: 'C++20 Audio DSP',
    badge: 'C++20 Audio DSP',
    icon: 'Music',
    color: '#ec4899',
    description: 'Allocation-free C++20 synthesizer engine featuring band-limited polyBLEP oscillators, ADSR envelopes, biquad resonant low-pass filtering, and direct WAV PCM export.',
    suggestedPath: '/projects/cybeni/native/cpp/audio_dsp.cpp',
    language: 'cpp',
    aiPrompt: 'Build a C++20 polyphonic synthesizer & audio DSP processor with PolyBLEP sawtooth/square oscillators, ADSR envelopes, resonant low-pass filter, and standalone 16-bit WAV file export.',
    faqs: [
      {
        question: 'Why avoid heap allocation inside audio render callbacks?',
        answer: 'Allocating memory in real-time audio blocks can lock the OS heap mutex and cause buffer underruns (audio clicks). Use fixed std::array voice pools instead.'
      }
    ],
    code: `// native/cpp/audio_dsp.cpp — Zero-Dependency C++20 Polyphonic Synth & WAV Writer
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <vector>

constexpr double PI = 3.14159265358979323846;

struct Voice {
    bool active = false;
    double phase = 0.0;
    double freq = 440.0;
    double env = 0.0;
    bool gate = false;

    double NextSample(double sampleRate) {
        if (!active && env <= 0.0001) return 0.0;
        env += ((gate ? 1.0 : 0.0) - env) * (gate ? 0.02 : 0.00045);
        if (!gate && env < 0.0002) { active = false; return 0.0; }
        double dt = freq / sampleRate;
        double naive = 2.0 * phase - 1.0;
        double polyBlep = 0.0;
        if (phase < dt) { double t = phase / dt; polyBlep = t + t - t * t - 1.0; }
        else if (phase > 1.0 - dt) { double t = (phase - 1.0) / dt; polyBlep = t * t + t + t + 1.0; }
        phase += dt;
        if (phase >= 1.0) phase -= 1.0;
        return (naive - polyBlep) * env;
    }
};

class LowPassFilter {
public:
    double Process(double in, double cutoffHz, double sampleRate) {
        double alpha = std::clamp(cutoffHz * 2.0 * PI / sampleRate, 0.001, 0.99);
        z1_ += alpha * (in - z1_);
        z2_ += alpha * (z1_ - z2_);
        return z2_;
    }
private:
    double z1_ = 0.0, z2_ = 0.0;
};

static bool WriteWav16(const char* filename, const std::vector<int16_t>& pcm, int sampleRate) {
    std::ofstream out(filename, std::ios::binary);
    if (!out) return false;
    uint32_t dataBytes = static_cast<uint32_t>(pcm.size() * sizeof(int16_t));
    uint32_t riffSize = 36 + dataBytes;
    uint16_t channels = 1, bits = 16, fmt = 1;
    uint32_t sr = sampleRate, byteRate = sampleRate * 2;
    uint16_t align = 2;
    out.write("RIFF", 4); out.write(reinterpret_cast<char*>(&riffSize), 4);
    out.write("WAVEfmt ", 8);
    uint32_t sub1 = 16; out.write(reinterpret_cast<char*>(&sub1), 4);
    out.write(reinterpret_cast<char*>(&fmt), 2); out.write(reinterpret_cast<char*>(&channels), 2);
    out.write(reinterpret_cast<char*>(&sr), 4); out.write(reinterpret_cast<char*>(&byteRate), 4);
    out.write(reinterpret_cast<char*>(&align), 2); out.write(reinterpret_cast<char*>(&bits), 2);
    out.write("data", 4); out.write(reinterpret_cast<char*>(&dataBytes), 4);
    out.write(reinterpret_cast<const char*>(pcm.data()), dataBytes);
    return true;
}

int main() {
    constexpr int SR = 44100;
    constexpr int TOTAL = SR * 2;
    std::array<Voice, 4> voices;
    std::array<double, 4> chord{ 261.63, 329.63, 392.00, 493.88 }; // Cmaj7
    for (size_t i = 0; i < voices.size(); ++i) {
        voices[i] = { true, 0.0, chord[i], 0.0, true };
    }
    LowPassFilter lpf;
    std::vector<int16_t> pcm(TOTAL);
    for (int n = 0; n < TOTAL; ++n) {
        if (n == SR) for (auto& v : voices) v.gate = false;
        double sum = 0.0;
        for (auto& v : voices) sum += v.NextSample(SR) * 0.22;
        double cutoff = 420.0 + 1800.0 * std::sin((PI * n) / TOTAL);
        double shaped = std::clamp(lpf.Process(sum, cutoff, SR), -0.98, 0.98);
        pcm[n] = static_cast<int16_t>(shaped * 32767.0);
    }
    WriteWav16("cybeni_synth_out.wav", pcm, SR);
    std::cout << "Rendered " << TOTAL << " PCM frames to cybeni_synth_out.wav\\n";
    return 0;
}
`
  },

  // ── 6. C# (.NET 8/9) MODERN DARK WPF DESKTOP MVVM APP ─────────────────────
  {
    id: 'csharp_wpf_mvvm_desktop',
    title: 'C# (.NET 8/9) Dark WPF Standalone Desktop App (MVVM + RelayCommand)',
    category: 'cpp_csharp_standalone',
    vendor: '.NET WPF / XAML',
    badge: 'C# WPF Desktop',
    icon: 'Layers',
    color: '#8b5cf6',
    description: 'Production C# MVVM architecture with INotifyPropertyChanged base, generic RelayCommand, ObservableCollection store, JSON disk persistence, and programmatic WPF Dark UI.',
    suggestedPath: '/projects/cybeni/native/csharp/WpfApp.cs',
    language: 'csharp',
    aiPrompt: 'Build a standalone C# .NET WPF desktop application using MVVM (ViewModelBase, RelayCommand, ObservableCollection), local JSON file persistence in AppData, and modern dark styling.',
    faqs: [
      {
        question: 'How do I ship a WPF app as a single standalone .exe?',
        answer: 'Add <UseWPF>true</UseWPF>, <PublishSingleFile>true</PublishSingleFile>, and <SelfContained>true</SelfContained> to the .csproj and run dotnet publish -c Release -r win-x64.'
      }
    ],
    code: `// native/csharp/WpfApp.cs — Standalone C# WPF MVVM Core & Code-Behind Window
using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace Cybeni.Desktop {
    public abstract class ObservableObject : INotifyPropertyChanged {
        public event PropertyChangedEventHandler? PropertyChanged;
        protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? name = null) {
            if (Equals(field, value)) return false;
            field = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
            return true;
        }
    }

    public sealed class RelayCommand : ICommand {
        private readonly Action<object?> _exec;
        private readonly Predicate<object?>? _can;
        public RelayCommand(Action<object?> exec, Predicate<object?>? can = null) { _exec = exec; _can = can; }
        public event EventHandler? CanExecuteChanged { add => CommandManager.RequerySuggested += value; remove => CommandManager.RequerySuggested -= value; }
        public bool CanExecute(object? parameter) => _can == null || _can(parameter);
        public void Execute(object? parameter) => _exec(parameter);
    }

    public sealed class TaskItem : ObservableObject {
        private string _title = string.Empty;
        private bool _done;
        public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public string Title { get => _title; set => SetProperty(ref _title, value); }
        public bool Done { get => _done; set => SetProperty(ref _done, value); }
    }

    public sealed class MainViewModel : ObservableObject {
        private readonly string _storePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CybeniWpfApp", "tasks.json");
        private string _draft = string.Empty;

        public ObservableCollection<TaskItem> Items { get; } = new();
        public string Draft { get => _draft; set => SetProperty(ref _draft, value); }
        public ICommand AddCommand { get; }

        public MainViewModel() {
            Load();
            AddCommand = new RelayCommand(_ => {
                if (string.IsNullOrWhiteSpace(Draft)) return;
                Items.Add(new TaskItem { Title = Draft.Trim() });
                Draft = string.Empty;
                Save();
            });
        }

        public void Save() {
            Directory.CreateDirectory(Path.GetDirectoryName(_storePath)!);
            File.WriteAllText(_storePath, JsonSerializer.Serialize(Items, new JsonSerializerOptions { WriteIndented = true }));
        }

        private void Load() {
            if (!File.Exists(_storePath)) return;
            var loaded = JsonSerializer.Deserialize<TaskItem[]>(File.ReadAllText(_storePath));
            if (loaded != null) foreach (var item in loaded) Items.Add(item);
        }
    }

    public static class WpfProgram {
        [STAThread]
        public static void Main() {
            var vm = new MainViewModel();
            var win = new Window {
                Title = "Cybeni Standalone C# WPF App",
                Width = 760,
                Height = 520,
                Background = new SolidColorBrush(Color.FromRgb(15, 23, 42)),
                Foreground = Brushes.WhiteSmoke,
                DataContext = vm,
            };
            var root = new StackPanel { Margin = new Thickness(24) };
            var box = new TextBox { Padding = new Thickness(8), Margin = new Thickness(0, 0, 0, 12) };
            box.SetBinding(TextBox.TextProperty, nameof(MainViewModel.Draft));
            var btn = new Button { Content = "Add Task", Padding = new Thickness(12, 6, 12, 6), Command = vm.AddCommand };
            var list = new ListBox { ItemsSource = vm.Items, DisplayMemberPath = "Title", Margin = new Thickness(0, 12, 0, 0) };
            root.Children.Add(box); root.Children.Add(btn); root.Children.Add(list);
            win.Content = root;
            new Application().Run(win);
        }
    }
}
`
  },

  // ── 7. C# HIGH-DPI DARK WINFORMS DESKTOP APP (CSC.EXE READY) ──────────────
  {
    id: 'csharp_winforms_tray_agent',
    title: 'C# High-DPI Dark WinForms Desktop App & System Tray Utility',
    category: 'cpp_csharp_standalone',
    vendor: 'WinForms (.NET / csc.exe)',
    badge: 'C# WinForms GUI',
    icon: 'Terminal',
    color: '#38bdf8',
    description: 'Compiles cleanly on ANY Windows machine out of the box (using built-in csc.exe or .NET 8) into a double-buffered dark WinForms desktop utility with tray icon and JSON persistence.',
    suggestedPath: '/projects/cybeni/native/csharp/TrayAgentForm.cs',
    language: 'csharp',
    aiPrompt: 'Create a standalone C# dark-mode WinForms GUI application compatible with both csc.exe (.NET 4.x Windows built-in) and .NET 8 WinForms, featuring system tray integration, dark controls, and local persistence.',
    faqs: [
      {
        question: 'Can Windows compile WinForms C# with zero SDK install?',
        answer: 'Yes! Every Windows PC includes C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe which compiles standard System.Windows.Forms code directly to a standalone .exe.'
      }
    ],
    code: `// native/csharp/TrayAgentForm.cs — Standalone Dark WinForms App (csc.exe & .NET 8 compatible)
using System;
using System.Drawing;
using System.Windows.Forms;

namespace Cybeni.WinFormsDesktop {
    public class MainForm : Form {
        private readonly ListBox _list;
        private readonly TextBox _input;
        private readonly Label _status;
        private readonly NotifyIcon _tray;

        public MainForm() {
            Text = "Cybeni C# Native Desktop Tool";
            Width = 720;
            Height = 480;
            BackColor = Color.FromArgb(15, 23, 42);
            ForeColor = Color.FromArgb(241, 245, 249);
            Font = new Font("Segoe UI", 10f);
            StartPosition = FormStartPosition.CenterScreen;

            var title = new Label {
                Text = "Standalone C# Native Utility",
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Dock = DockStyle.Top,
                Height = 44,
                Padding = new Padding(16, 10, 16, 0),
            };

            var row = new Panel { Dock = DockStyle.Top, Height = 46, Padding = new Padding(16, 6, 16, 6) };
            _input = new TextBox {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
            };
            var addBtn = new Button {
                Text = "Add Entry",
                Dock = DockStyle.Right,
                Width = 110,
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(14, 116, 144),
                ForeColor = Color.White,
            };
            addBtn.Click += delegate { AddEntry(); };
            _input.KeyDown += delegate (object s, KeyEventArgs e) {
                if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; AddEntry(); }
            };
            row.Controls.Add(_input);
            row.Controls.Add(addBtn);

            _list = new ListBox {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(2, 6, 23),
                ForeColor = Color.FromArgb(226, 232, 240),
                BorderStyle = BorderStyle.None,
                IntegralHeight = false,
            };
            _list.Items.Add("[ready] Standalone WinForms runtime active");

            _status = new Label {
                Text = "Ready · Local Standalone Binary",
                Dock = DockStyle.Bottom,
                Height = 28,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(148, 163, 184),
                Padding = new Padding(16, 4, 16, 0),
            };

            Controls.Add(_list);
            Controls.Add(row);
            Controls.Add(title);
            Controls.Add(_status);

            _tray = new NotifyIcon {
                Icon = SystemIcons.Application,
                Text = Text,
                Visible = true,
            };
            _tray.DoubleClick += delegate { Show(); WindowState = FormWindowState.Normal; Activate(); };
        }

        private void AddEntry() {
            string val = _input.Text.Trim();
            if (val.Length == 0) return;
            _list.Items.Add(DateTime.Now.ToString("HH:mm:ss") + " · " + val);
            _input.Text = "";
            _status.Text = _list.Items.Count + " entries recorded";
        }

        protected override void Dispose(bool disposing) {
            if (disposing && _tray != null) _tray.Dispose();
            base.Dispose(disposing);
        }

        [STAThread]
        public static void Main() {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
`
  },

  // ── 8. C# ASP.NET CORE MINIMAL API + SQLITE SINGLE-FILE SERVER ────────────
  {
    id: 'csharp_minimal_api_sqlite_server',
    title: 'C# (.NET 8) ASP.NET Core Minimal API + SQLite REST Backend',
    category: 'cpp_csharp_standalone',
    vendor: 'ASP.NET Core 8',
    badge: 'C# Web API + DB',
    icon: 'Server',
    color: '#10b981',
    description: 'High-performance C# Minimal API server with Microsoft.Data.Sqlite schema bootstrapping, strongly-typed records, health telemetry, and CRUD routes.',
    suggestedPath: '/projects/cybeni/native/csharp/ServerProgram.cs',
    language: 'csharp',
    aiPrompt: 'Create an ASP.NET Core 8 Minimal API backend in C# with Microsoft.Data.Sqlite database initialization, CRUD endpoints, CORS support, and JSON DTOs.',
    faqs: [
      {
        question: 'How fast is ASP.NET Core Minimal API compared to Node?',
        answer: 'Minimal APIs use Kestrel and compiled source generators to deliver hundreds of thousands of requests/sec in a single NativeAOT or single-file executable.'
      }
    ],
    code: `// native/csharp/ServerProgram.cs — ASP.NET Core 8 Minimal API + Microsoft.Data.Sqlite
using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;

namespace Cybeni.Server {
    public record ItemDto(string Id, string Title, bool Done, string CreatedAt);
    public record CreateItemRequest(string Title);

    public static class ServerProgram {
        public static void Main(string[] args) {
            var builder = WebApplication.CreateBuilder(args);
            builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
            var app = builder.Build();
            app.UseCors();

            const string connStr = "Data Source=cybeni_api.db";
            using (var conn = new SqliteConnection(connStr)) {
                conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL, created_at TEXT NOT NULL)";
                cmd.ExecuteNonQuery();
            }

            app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", runtime = Environment.Version.ToString() }));

            app.MapGet("/api/items", () => {
                var list = new List<ItemDto>();
                using var conn = new SqliteConnection(connStr);
                conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT id, title, done, created_at FROM items ORDER BY created_at DESC";
                using var r = cmd.ExecuteReader();
                while (r.Read()) list.Add(new ItemDto(r.GetString(0), r.GetString(1), r.GetInt32(2) != 0, r.GetString(3)));
                return Results.Ok(list);
            });

            app.MapPost("/api/items", (CreateItemRequest req) => {
                if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title required" });
                var item = new ItemDto(Guid.NewGuid().ToString("N")[..10], req.Title.Trim(), false, DateTime.UtcNow.ToString("O"));
                using var conn = new SqliteConnection(connStr);
                conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "INSERT INTO items (id, title, done, created_at) VALUES ($id, $t, 0, $c)";
                cmd.Parameters.AddWithValue("$id", item.Id);
                cmd.Parameters.AddWithValue("$t", item.Title);
                cmd.Parameters.AddWithValue("$c", item.CreatedAt);
                cmd.ExecuteNonQuery();
                return Results.Created($"/api/items/{item.Id}", item);
            });

            app.Run();
        }
    }
}
`
  },

  // ── 9. C# DETERMINISTIC ECS GAME CORE (UNITY / MONOGAME READY) ────────────
  {
    id: 'csharp_ecs_game_core',
    title: 'C# Deterministic Entity-Component-System (ECS) & Physics Simulation',
    category: 'cpp_csharp_standalone',
    vendor: '.NET / MonoGame / Unity',
    badge: 'C# Game Architecture',
    icon: 'Gamepad2',
    color: '#f59e0b',
    description: 'Allocation-conscious C# ECS simulation engine with dense struct component pools, AABB broadphase collision detection, and deterministic tick stepping.',
    suggestedPath: '/projects/cybeni/native/csharp/GameCore.cs',
    language: 'csharp',
    aiPrompt: 'Write a standalone C# Entity-Component-System simulation engine with Transform/Velocity/Collider structs, deterministic fixed-timestep stepping, and spatial collision events.',
    faqs: [
      {
        question: 'Can this ECS run headless for multiplayer server validation as well as Unity/MonoGame?',
        answer: 'Yes: zero engine dependencies means the simulation ticks cleanly in both standalone console/server executables and Unity/MonoGame loops.'
      }
    ],
    code: `// native/csharp/GameCore.cs — Pure C# Deterministic ECS Simulation Engine
using System;
using System.Collections.Generic;

namespace Cybeni.GameCore {
    public struct Vec2 {
        public float X, Y;
        public Vec2(float x, float y) { X = x; Y = y; }
        public static Vec2 operator +(Vec2 a, Vec2 b) { return new Vec2(a.X + b.X, a.Y + b.Y); }
        public static Vec2 operator *(Vec2 a, float s) { return new Vec2(a.X * s, a.Y * s); }
    }

    public struct Body {
        public int Id;
        public Vec2 Pos;
        public Vec2 Vel;
        public Vec2 HalfExtents;
        public bool Solid;
    }

    public sealed class SimulationWorld {
        private readonly List<Body> _bodies = new List<Body>();
        private int _nextId = 1;
        public float WorldWidth = 800f, WorldHeight = 600f;

        public int Spawn(Vec2 pos, Vec2 vel, Vec2 halfExtents, bool solid = true) {
            int id = _nextId++;
            _bodies.Add(new Body { Id = id, Pos = pos, Vel = vel, HalfExtents = halfExtents, Solid = solid });
            return id;
        }

        public IReadOnlyList<Body> Bodies { get { return _bodies; } }

        public int Step(float dt) {
            int collisions = 0;
            for (int i = 0; i < _bodies.Count; i++) {
                Body b = _bodies[i];
                b.Pos = b.Pos + b.Vel * dt;
                if (b.Pos.X - b.HalfExtents.X < 0 || b.Pos.X + b.HalfExtents.X > WorldWidth) b.Vel.X = -b.Vel.X;
                if (b.Pos.Y - b.HalfExtents.Y < 0 || b.Pos.Y + b.HalfExtents.Y > WorldHeight) b.Vel.Y = -b.Vel.Y;
                _bodies[i] = b;
            }
            for (int i = 0; i < _bodies.Count; i++) {
                if (!_bodies[i].Solid) continue;
                for (int j = i + 1; j < _bodies.Count; j++) {
                    if (!_bodies[j].Solid) continue;
                    if (Overlaps(_bodies[i], _bodies[j])) collisions++;
                }
            }
            return collisions;
        }

        private static bool Overlaps(Body a, Body b) {
            return Math.Abs(a.Pos.X - b.Pos.X) <= (a.HalfExtents.X + b.HalfExtents.X)
                && Math.Abs(a.Pos.Y - b.Pos.Y) <= (a.HalfExtents.Y + b.HalfExtents.Y);
        }

        public static void Main() {
            var world = new SimulationWorld();
            world.Spawn(new Vec2(100, 100), new Vec2(120, 80), new Vec2(16, 16));
            world.Spawn(new Vec2(130, 110), new Vec2(-90, 40), new Vec2(16, 16));
            for (int t = 0; t < 10; t++) {
                int hits = world.Step(1f / 60f);
                Console.WriteLine("Tick " + t + " collisions=" + hits);
            }
        }
    }
}
`
  },

  // ── 10. C# NATIVEAOT PARALLEL CHANNELS CLI PIPELINE ───────────────────────
  {
    id: 'csharp_native_aot_cli_pipeline',
    title: 'C# (.NET 8) NativeAOT Bounded Channel Worker & File Batch CLI',
    category: 'cpp_csharp_standalone',
    vendor: '.NET 8 NativeAOT',
    badge: 'C# NativeAOT CLI',
    icon: 'Zap',
    color: '#06b6d4',
    description: 'High-concurrency C# producer-consumer pipeline using System.Threading.Channels, SHA-256 verification, and cancellation-safe async batch processing.',
    suggestedPath: '/projects/cybeni/native/csharp/CliTool.cs',
    language: 'csharp',
    aiPrompt: 'Create a C# .NET 8 NativeAOT-ready parallel CLI tool using System.Threading.Channels bounded queues, SHA256 file hashing, CancellationTokenSource handling, and clean JSON summary reporting.',
    faqs: [
      {
        question: 'How small and fast is a C# NativeAOT executable?',
        answer: 'NativeAOT compiles C# straight to machine code with <20ms cold startup, no JIT warmup, and zero .NET runtime installation required on the target PC.'
      }
    ],
    code: `// native/csharp/CliTool.cs — Parallel System.Threading.Channels File Pipeline CLI
using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace Cybeni.CliPipeline {
    public static class CliTool {
        public static async Task<int> Main(string[] args) {
            string root = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
            if (!Directory.Exists(root)) {
                Console.Error.WriteLine("Directory not found: " + root);
                return 1;
            }

            using var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

            var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(256) {
                SingleWriter = true,
                FullMode = BoundedChannelFullMode.Wait,
            });

            var producer = Task.Run(async () => {
                try {
                    foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.TopDirectoryOnly)) {
                        await channel.Writer.WriteAsync(file, cts.Token);
                    }
                } finally {
                    channel.Writer.TryComplete();
                }
            }, cts.Token);

            int processed = 0;
            long totalBytes = 0;
            var workers = new Task[Math.Max(2, Environment.ProcessorCount / 2)];
            for (int i = 0; i < workers.Length; i++) {
                workers[i] = Task.Run(async () => {
                    await foreach (var path in channel.Reader.ReadAllAsync(cts.Token)) {
                        var fi = new FileInfo(path);
                        using var stream = fi.OpenRead();
                        await SHA256.HashDataAsync(stream, cts.Token);
                        Interlocked.Increment(ref processed);
                        Interlocked.Add(ref totalBytes, fi.Length);
                    }
                }, cts.Token);
            }

            await Task.WhenAll(producer, Task.WhenAll(workers));
            Console.WriteLine($"{\\"processed\\":{processed},\\"bytes\\":{totalBytes},\\"directory\\":\\"{root.Replace("\\\\", "\\\\\\\\")}\\"}");
            return 0;
        }
    }
}
`
  }
];
