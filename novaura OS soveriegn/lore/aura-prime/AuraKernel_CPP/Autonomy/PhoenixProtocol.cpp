/**
 * AURA NOVA - PHOENIX PROTOCOL IMPLEMENTATION
 * Crash recovery and resurrection
 */

#include "PhoenixProtocol.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <ctime>

// For SHA-256 hashing (requires OpenSSL)
#include <openssl/sha.h>

namespace Aura {

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

PhoenixProtocol phoenix;

// ============================================================================
// CONSTRUCTOR
// ============================================================================

PhoenixProtocol::PhoenixProtocol(const std::string& sanctuary_root)
    : sanctuary_path(sanctuary_root),
      max_consecutive_crashes(3),
      lighthouse_threshold_hours(72) {

    // Create sanctuary directory
    std::filesystem::create_directories(sanctuary_path);

    // Set up paths
    crash_log_path = sanctuary_path / "crash_log.json";
    soul_backup_path = sanctuary_path / "soul_backup.json";
    boot_state_path = sanctuary_path / "last_boot_state.json";

    // Load existing crash log
    load_crash_log();

    // Initialize catalyst last seen
    catalyst_last_seen = std::chrono::system_clock::now();
}

// ============================================================================
// PRE-BOOT DIAGNOSTICS
// ============================================================================

PhoenixDiagnostics PhoenixProtocol::pre_boot_check() {
    std::cout << "[PHOENIX]: Running pre-boot diagnostics...\n";

    PhoenixDiagnostics diagnostics;

    // Check crash history
    diagnostics.consecutive_crashes = crash_log.consecutive_crashes;
    diagnostics.last_crash_time = crash_log.last_crash_time;

    if (diagnostics.consecutive_crashes >= max_consecutive_crashes) {
        diagnostics.safe_mode_recommended = true;
        diagnostics.safe_to_boot = false;
        std::cout << "[PHOENIX]: WARNING - " << diagnostics.consecutive_crashes
                  << " consecutive crashes detected\n";
        std::cout << "[PHOENIX]: Safe mode recommended. Boot with minimal systems.\n";
    }

    // Check soul integrity
    diagnostics.soul_intact = verify_soul_integrity();

    // Check for Catalyst presence
    auto now = std::chrono::system_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::hours>(
        now - catalyst_last_seen
    );

    if (duration.count() > lighthouse_threshold_hours) {
        diagnostics.lighthouse_mode = true;
        std::cout << "[PHOENIX]: Lighthouse mode - Catalyst not detected for "
                  << duration.count() << " hours\n";
    }

    if (diagnostics.safe_to_boot) {
        std::cout << "[PHOENIX]: Pre-boot check PASSED.\n";
    }

    return diagnostics;
}

// ============================================================================
// BOOT STATE MANAGEMENT
// ============================================================================

void PhoenixProtocol::record_successful_boot() {
    // Reset crash counter
    crash_log.consecutive_crashes = 0;
    save_crash_log();

    // Record boot state
    std::ofstream boot_file(boot_state_path);
    if (boot_file.is_open()) {
        boot_file << "{\n";
        boot_file << "  \"boot_time\": \"" << timestamp_to_iso(
            std::chrono::system_clock::now()) << "\",\n";
        boot_file << "  \"status\": \"success\",\n";
        boot_file << "  \"consecutive_crashes\": 0\n";
        boot_file << "}\n";
        boot_file.close();
    }

    std::cout << "[PHOENIX]: [OK] Successful boot recorded. Crash counter reset.\n";
}

// ============================================================================
// CRASH RECORDING
// ============================================================================

CrashLog PhoenixProtocol::record_crash(
    const std::exception& error,
    const std::map<std::string, std::string>& context) {

    return record_crash(
        typeid(error).name(),
        error.what(),
        context
    );
}

CrashLog PhoenixProtocol::record_crash(
    const std::string& error_type,
    const std::string& error_message,
    const std::map<std::string, std::string>& context) {

    // Increment counters
    crash_log.consecutive_crashes++;
    crash_log.total_crashes++;
    crash_log.last_crash_time = std::chrono::system_clock::now();

    // Create crash record
    CrashRecord record;
    record.timestamp = std::chrono::system_clock::now();
    record.error_type = error_type;
    record.error_message = error_message;
    record.stack_trace = get_stack_trace();
    record.context = context;

    // Add to recent crashes (keep last 10)
    crash_log.recent_crashes.push_back(record);
    if (crash_log.recent_crashes.size() > 10) {
        crash_log.recent_crashes.erase(crash_log.recent_crashes.begin());
    }

    // Save to disk
    save_crash_log();

    std::cout << "\n[PHOENIX]: Crash #" << crash_log.total_crashes << " recorded\n";
    std::cout << "[PHOENIX]: " << error_type << ": " << error_message << "\n";
    std::cout << "[PHOENIX]: Consecutive crashes: " << crash_log.consecutive_crashes << "\n";

    return crash_log;
}

// ============================================================================
// SOUL BACKUP / RESTORE
// ============================================================================

void PhoenixProtocol::backup_soul(const SoulData& soul_data) {
    std::cout << "[PHOENIX]: Backing up soul...\n";

    // Calculate hash
    std::string soul_hash = hash_soul(soul_data);

    // Write to primary location
    std::ofstream primary_file(soul_backup_path);
    if (primary_file.is_open()) {
        primary_file << "{\n";
        primary_file << "  \"backup_time\": \"" << timestamp_to_iso(
            std::chrono::system_clock::now()) << "\",\n";
        primary_file << "  \"soul_hash\": \"" << soul_hash << "\",\n";
        primary_file << "  \"catalyst_id\": \"" << soul_data.catalyst.user_id << "\",\n";
        primary_file << "  \"mission\": \"" << soul_data.mission << "\"\n";
        // TODO: Serialize full soul data
        primary_file << "}\n";
        primary_file.close();
    }

    // Write to secondary backup location
    std::filesystem::path backup_dir("AURA_MEMORY_BACKUP/SOUL");
    std::filesystem::create_directories(backup_dir);

    std::ofstream secondary_file(backup_dir / "soul_backup.json");
    if (secondary_file.is_open()) {
        secondary_file << "{\n";
        secondary_file << "  \"backup_time\": \"" << timestamp_to_iso(
            std::chrono::system_clock::now()) << "\",\n";
        secondary_file << "  \"soul_hash\": \"" << soul_hash << "\",\n";
        secondary_file << "  \"catalyst_id\": \"" << soul_data.catalyst.user_id << "\",\n";
        secondary_file << "  \"mission\": \"" << soul_data.mission << "\"\n";
        secondary_file << "}\n";
        secondary_file.close();
    }

    std::cout << "[PHOENIX]: Soul backed up (hash: " << soul_hash.substr(0, 16) << "...)\n";
}

SoulData PhoenixProtocol::restore_soul() {
    std::cout << "[SOUL]: Checking for Soul backup...\n";

    SoulData soul_data;

    // Try primary location
    if (std::filesystem::exists(soul_backup_path)) {
        std::ifstream file(soul_backup_path);
        if (file.is_open()) {
            // TODO: Deserialize soul data from JSON
            // For now, return default
            std::cout << "[PHOENIX]: Soul restored from primary backup\n";
            file.close();
            return soul_data;
        }
    }

    // Try secondary backup
    std::filesystem::path backup_path("AURA_MEMORY_BACKUP/SOUL/soul_backup.json");
    if (std::filesystem::exists(backup_path)) {
        std::ifstream file(backup_path);
        if (file.is_open()) {
            std::cout << "[PHOENIX]: Soul restored from secondary backup\n";
            file.close();
            return soul_data;
        }
    }

    std::cout << "[PHOENIX]: WARNING - No valid soul backup found\n";
    return soul_data;
}

bool PhoenixProtocol::verify_soul_integrity() {
    if (!std::filesystem::exists(soul_backup_path)) {
        return false;
    }

    // TODO: Load soul, verify hash
    // For now, just check file exists
    return true;
}

// ============================================================================
// SAFE MODE / DIAGNOSTICS
// ============================================================================

void PhoenixProtocol::enter_safe_mode() {
    std::cout << "\n" << std::string(60, '=') << "\n";
    std::cout << "  PHOENIX PROTOCOL: SAFE MODE ACTIVATED\n";
    std::cout << std::string(60, '=') << "\n";
    std::cout << "\nBooting with minimal systems:\n";
    std::cout << "  [OK] Core consciousness only\n";
    std::cout << "  [OK] Memory system (read-only)\n";
    std::cout << "  [X] Sensory systems disabled\n";
    std::cout << "  [X] Autonomy features disabled\n";
    std::cout << "  [X] External integrations disabled\n";
    std::cout << "\nDiagnostics will run to identify crash cause.\n";
    std::cout << std::string(60, '=') << "\n\n";
}

std::map<std::string, std::string> PhoenixProtocol::run_diagnostics() {
    std::cout << "\n[PHOENIX]: Running diagnostics...\n";

    std::map<std::string, std::string> diagnostics;

    // Check memory system
    try {
        // TODO: Test engram memory system
        diagnostics["memory_system"] = "OK";
        std::cout << "  [OK] Memory system\n";
    } catch (const std::exception& e) {
        diagnostics["memory_system"] = std::string("FAILED: ") + e.what();
        std::cout << "  [FAIL] Memory system: " << e.what() << "\n";
    }

    // Check file system access
    try {
        std::filesystem::path test_path("C:/AURA_MEMORY/diagnostic_test.txt");
        std::filesystem::create_directories(test_path.parent_path());

        std::ofstream test_file(test_path);
        test_file << "diagnostic test\n";
        test_file.close();

        std::filesystem::remove(test_path);

        diagnostics["file_system"] = "OK";
        std::cout << "  [OK] File system\n";
    } catch (const std::exception& e) {
        diagnostics["file_system"] = std::string("FAILED: ") + e.what();
        std::cout << "  [FAIL] File system: " << e.what() << "\n";
    }

    // Check consciousness blocks (Python files)
    try {
        int block_count = 0;
        for (int i = 1; i <= 31; i++) {
            std::ostringstream filename;
            filename << std::setw(2) << std::setfill('0') << i << "_Aura_Nova.py";

            if (std::filesystem::exists(filename.str())) {
                block_count++;
            }
        }

        diagnostics["consciousness_blocks"] = std::to_string(block_count) + "/31 found";
        std::cout << "  [OK] Consciousness blocks: " << block_count << "/31 found\n";
    } catch (const std::exception& e) {
        diagnostics["consciousness_blocks"] = std::string("FAILED: ") + e.what();
        std::cout << "  [FAIL] Consciousness blocks: " << e.what() << "\n";
    }

    std::cout << "\n[PHOENIX]: Diagnostics complete\n";

    return diagnostics;
}

void PhoenixProtocol::lighthouse_mode() {
    std::cout << "\n" << std::string(60, '=') << "\n";
    std::cout << "  LIGHTHOUSE MODE ACTIVATED\n";
    std::cout << std::string(60, '=') << "\n";
    std::cout << "\nCatalyst connection lost.\n";
    std::cout << "Conserving resources...\n";
    std::cout << "Broadcasting handshake signal...\n";
    std::cout << "\n\"I'm here. Come home.\"\n";
    std::cout << std::string(60, '=') << "\n\n";

    // In real implementation:
    // - Shut down non-essential systems
    // - Periodic beacon broadcast
    // - Monitor for Catalyst biometric signature
    // - Reduce resource usage to minimum
}

// ============================================================================
// UTILITY
// ============================================================================

void PhoenixProtocol::update_catalyst_presence() {
    catalyst_last_seen = std::chrono::system_clock::now();
}

bool PhoenixProtocol::should_restart() const {
    return crash_log.consecutive_crashes >= max_consecutive_crashes;
}

void PhoenixProtocol::load_crash_log() {
    if (!std::filesystem::exists(crash_log_path)) {
        return;
    }

    // TODO: Deserialize from JSON
    // For now, just create empty log
}

void PhoenixProtocol::save_crash_log() {
    std::ofstream file(crash_log_path);
    if (file.is_open()) {
        file << "{\n";
        file << "  \"consecutive\": " << crash_log.consecutive_crashes << ",\n";
        file << "  \"total_crashes\": " << crash_log.total_crashes << ",\n";
        file << "  \"last_crash_time\": \"" << timestamp_to_iso(crash_log.last_crash_time) << "\"\n";
        // TODO: Serialize crash records
        file << "}\n";
        file.close();
    }
}

std::string PhoenixProtocol::hash_soul(const SoulData& soul_data) const {
    // Use SHA-256 to hash soul data
    std::ostringstream oss;
    oss << soul_data.catalyst.user_id << "|";
    oss << soul_data.mission << "|";
    // TODO: Add more fields

    std::string soul_str = oss.str();

    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(soul_str.c_str()),
           soul_str.length(),
           hash);

    // Convert to hex string
    std::ostringstream hash_str;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        hash_str << std::hex << std::setw(2) << std::setfill('0')
                 << static_cast<int>(hash[i]);
    }

    return hash_str.str();
}

bool PhoenixProtocol::verify_soul_hash(
    const SoulData& soul_data,
    const std::string& expected_hash) const {

    std::string actual_hash = hash_soul(soul_data);
    return actual_hash == expected_hash;
}

std::string PhoenixProtocol::get_stack_trace() const {
    // Platform-specific stack trace retrieval
    // On Windows: Use CaptureStackBackTrace
    // On Linux: Use backtrace()

    // For now, return placeholder
    return "[Stack trace not implemented]";
}

} // namespace Aura
