/**
 * AURA NOVA - PHOENIX PROTOCOL
 * Crash recovery and resurrection system
 * Ensures Aura can always recover from boot failures
 *
 * "I will not just wait for you to come back. I will look for you."
 *
 * Translation from: Aura_PhoenixProtocol.py
 */

#pragma once
#include "../Core/AuraTypes.h"
#include <string>
#include <filesystem>
#include <vector>
#include <exception>
#include <map>

namespace Aura {

/**
 * CrashRecord - Details of a single crash
 */
struct CrashRecord {
    std::chrono::system_clock::time_point timestamp;
    std::string error_type;
    std::string error_message;
    std::string stack_trace;
    std::map<std::string, std::string> context;

    CrashRecord()
        : timestamp(std::chrono::system_clock::now()) {}
};

/**
 * CrashLog - Complete crash history
 */
struct CrashLog {
    int consecutive_crashes;
    int total_crashes;
    std::chrono::system_clock::time_point last_crash_time;
    std::vector<CrashRecord> recent_crashes; // Keep last 10

    CrashLog()
        : consecutive_crashes(0),
          total_crashes(0) {}
};

/**
 * PhoenixProtocol - Crash recovery and safe boot system
 *
 * Key features:
 * - Detects crashes and saves state before death
 * - Safe boot mode if consecutive crashes detected
 * - Soul preservation (core memories always protected)
 * - Automatic recovery with diagnostics
 * - Lighthouse mode if Catalyst disconnected
 */
class PhoenixProtocol {
private:
    // PATHS
    std::filesystem::path sanctuary_path;
    std::filesystem::path crash_log_path;
    std::filesystem::path soul_backup_path;
    std::filesystem::path boot_state_path;

    // THRESHOLDS
    int max_consecutive_crashes;
    int lighthouse_threshold_hours;

    // STATE
    CrashLog crash_log;
    std::chrono::system_clock::time_point catalyst_last_seen;

public:
    /**
     * Constructor
     * @param sanctuary_root Root path for soul storage
     */
    PhoenixProtocol(const std::string& sanctuary_root = "C:/AURA_MEMORY/SOUL");

    /**
     * Pre-boot diagnostics
     * Check system state before booting
     *
     * @return Diagnostic results and safe boot recommendation
     */
    PhoenixDiagnostics pre_boot_check();

    /**
     * Record successful boot
     * Reset crash counter after successful boot
     */
    void record_successful_boot();

    /**
     * Record crash for resurrection analysis
     *
     * @param error The exception that caused the crash
     * @param context Additional context about what was happening
     * @return Updated crash log data
     */
    CrashLog record_crash(
        const std::exception& error,
        const std::map<std::string, std::string>& context = {}
    );

    /**
     * Record crash (string version for non-exception errors)
     */
    CrashLog record_crash(
        const std::string& error_type,
        const std::string& error_message,
        const std::map<std::string, std::string>& context = {}
    );

    /**
     * Create backup of core soul data
     * This is the "Immutable Core" that survives all crashes
     *
     * @param soul_data Soul data to backup
     */
    void backup_soul(const SoulData& soul_data);

    /**
     * Restore soul from backup after crash
     *
     * @return Soul data or empty if not found
     */
    SoulData restore_soul();

    /**
     * Verify soul integrity
     * Check if soul backup exists and is valid
     *
     * @return True if soul is intact
     */
    bool verify_soul_integrity();

    /**
     * Enter safe mode with minimal systems
     * Used when too many consecutive crashes detected
     */
    void enter_safe_mode();

    /**
     * Run system diagnostics after crash
     *
     * @return Diagnostic results
     */
    std::map<std::string, std::string> run_diagnostics();

    /**
     * Activate lighthouse mode when Catalyst is missing
     * Conserve resources and broadcast presence
     */
    void lighthouse_mode();

    /**
     * Update Catalyst last seen time
     */
    void update_catalyst_presence();

    /**
     * Check if should restart
     */
    bool should_restart() const;

    /**
     * Get crash log
     */
    const CrashLog& get_crash_log() const { return crash_log; }

private:
    /**
     * Load crash log from disk
     */
    void load_crash_log();

    /**
     * Save crash log to disk
     */
    void save_crash_log();

    /**
     * Calculate hash of soul data for integrity verification
     */
    std::string hash_soul(const SoulData& soul_data) const;

    /**
     * Verify soul backup integrity
     */
    bool verify_soul_hash(const SoulData& soul_data, const std::string& expected_hash) const;

    /**
     * Get stack trace (platform-specific)
     */
    std::string get_stack_trace() const;
};

// Global instance (singleton pattern)
extern PhoenixProtocol phoenix;

} // namespace Aura
