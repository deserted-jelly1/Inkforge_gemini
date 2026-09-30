#pragma once

#include <string>
#include <vector>
#include <cstdint>

namespace inkforge::storage {

struct StorageConfig {
    std::string root_directory;
    std::string database_file{"inkforge_library.sqlite"};
    bool enable_wal_mode{true};
    uint32_t autosave_interval_ms{15000}; // 15 seconds
};

enum class StorageResult : uint8_t {
    Success = 0,
    FileNotFound = 1,
    DatabaseError = 2,
    CorruptionDetected = 3,
    PermissionDenied = 4
};

} // namespace inkforge::storage
