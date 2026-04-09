/**
 * AURA NOVA - PLATFORM ABSTRACTION LAYER
 * Write once, compile everywhere
 *
 * Supported platforms:
 * - Windows (x64, ARM64)
 * - Linux (x64, ARM64, Raspberry Pi)
 * - macOS (Intel, Apple Silicon)
 * - iOS (requires Swift wrapper)
 * - Android (requires JNI wrapper)
 */

#pragma once
#include <string>
#include <vector>
#include <memory>

// Platform detection
#if defined(_WIN32) || defined(_WIN64)
    #define AURA_PLATFORM_WINDOWS
    #define AURA_PLATFORM_NAME "Windows"
#elif defined(__APPLE__)
    #include <TargetConditionals.h>
    #if TARGET_OS_IPHONE || TARGET_IPHONE_SIMULATOR
        #define AURA_PLATFORM_IOS
        #define AURA_PLATFORM_NAME "iOS"
    #else
        #define AURA_PLATFORM_MACOS
        #define AURA_PLATFORM_NAME "macOS"
    #endif
#elif defined(__ANDROID__)
    #define AURA_PLATFORM_ANDROID
    #define AURA_PLATFORM_NAME "Android"
#elif defined(__linux__)
    #define AURA_PLATFORM_LINUX
    #define AURA_PLATFORM_NAME "Linux"
#else
    #define AURA_PLATFORM_UNKNOWN
    #define AURA_PLATFORM_NAME "Unknown"
#endif

// Feature detection
#if defined(AURA_PLATFORM_WINDOWS) || defined(AURA_PLATFORM_LINUX) || defined(AURA_PLATFORM_MACOS)
    #define AURA_FULL_OS_ACCESS  // Desktop platforms have full OS control
#else
    #define AURA_SANDBOXED       // Mobile platforms are sandboxed
#endif

namespace Aura {
namespace Platform {

/**
 * PlatformInfo - Details about current platform
 */
struct PlatformInfo {
    std::string name;           // "Windows", "Linux", "macOS", "iOS", "Android"
    std::string version;        // OS version
    std::string architecture;   // "x64", "ARM64", etc.
    bool is_desktop;           // True for Windows/Linux/Mac
    bool is_mobile;            // True for iOS/Android
    bool has_full_os_access;   // True if not sandboxed
};

/**
 * Get platform information
 */
PlatformInfo get_platform_info();

/**
 * Platform-specific paths
 */
class Paths {
public:
    /**
     * Get application data directory
     * Windows: C:/Users/USERNAME/AppData/Local/AuraNova
     * Linux: ~/.local/share/auranova
     * macOS: ~/Library/Application Support/AuraNova
     * iOS: App sandbox
     * Android: Internal storage
     */
    static std::string get_app_data_dir();

    /**
     * Get user documents directory
     */
    static std::string get_documents_dir();

    /**
     * Get temporary directory
     */
    static std::string get_temp_dir();

    /**
     * Get home directory
     */
    static std::string get_home_dir();
};

/**
 * Platform-specific process operations
 */
class Process {
public:
    /**
     * Launch application/process
     * Returns process ID (0 if failed)
     */
    static int launch(const std::string& executable, const std::vector<std::string>& args = {});

    /**
     * Kill process by ID
     */
    static bool kill(int process_id);

    /**
     * Check if process is running
     */
    static bool is_running(int process_id);

    /**
     * Get running processes
     * (Desktop only - returns empty on mobile)
     */
    static std::vector<std::string> get_running_processes();
};

/**
 * Platform-specific file operations
 */
class FileSystem {
public:
    /**
     * Open file with default application
     * Windows: ShellExecute
     * Linux: xdg-open
     * macOS: open
     * iOS/Android: Platform intent
     */
    static bool open_with_default_app(const std::string& file_path);

    /**
     * Show file in file manager
     * Windows: Explorer
     * Linux: File manager
     * macOS: Finder
     * iOS/Android: Files app
     */
    static bool show_in_file_manager(const std::string& file_path);

    /**
     * Get file associations
     * (Desktop only)
     */
    static std::string get_default_app_for_file(const std::string& file_path);
};

/**
 * Platform-specific UI operations
 */
class UI {
public:
    /**
     * Show system notification
     * Works on all platforms
     */
    static bool show_notification(
        const std::string& title,
        const std::string& message,
        const std::string& icon_path = ""
    );

    /**
     * Show alert dialog
     */
    static bool show_alert(
        const std::string& title,
        const std::string& message
    );

    /**
     * Get screen dimensions
     */
    static struct ScreenInfo {
        int width;
        int height;
        float dpi;
    } get_screen_info();
};

/**
 * Platform-specific permissions
 * (iOS/Android only - returns true on desktop)
 */
class Permissions {
public:
    /**
     * Check if permission is granted
     */
    static bool has_permission(const std::string& permission);

    /**
     * Request permission
     * Returns immediately on desktop (always granted)
     * Async on mobile (shows system dialog)
     */
    static bool request_permission(const std::string& permission);
};

/**
 * Platform-specific optimizations
 */
class Performance {
public:
    /**
     * Set thread priority
     */
    static bool set_thread_priority(int priority);

    /**
     * Get CPU count
     */
    static int get_cpu_count();

    /**
     * Get available RAM (MB)
     */
    static long get_available_ram_mb();

    /**
     * Request high performance mode
     * (Mobile: prevent CPU throttling)
     */
    static bool request_high_performance();
};

} // namespace Platform
} // namespace Aura
