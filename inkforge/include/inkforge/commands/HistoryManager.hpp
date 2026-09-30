#pragma once

#include <vector>
#include <memory>
#include <string>
#include <functional>
#include <optional>
#include <cstdint>
#include <inkforge/core/Export.hpp>
#include <inkforge/commands/ICommand.hpp>
#include <inkforge/commands/CompoundCommand.hpp>

namespace inkforge::commands {

struct HistoryItemInfo {
    std::string description;
    CommandType type{CommandType::AddStroke};
    uint64_t timestamp_us{0};
    size_t memory_bytes{0};
    bool is_undone{false};
};

struct HistoryState {
    bool can_undo{false};
    bool can_redo{false};
    size_t undo_count{0};
    size_t redo_count{0};
    size_t total_memory_bytes{0};
    std::string last_undo_description;
    std::string last_redo_description;
};

/**
 * @brief Comprehensive command-pattern history manager for InkForge.
 * Tracks all canvas stroke operations, macro transactions, memory budgeting, and non-destructive time travel.
 */
class INKFORGE_API HistoryManager {
public:
    using StateChangeCallback = std::function<void(const HistoryState&)>;
    using CommandExecutedCallback = std::function<void(const ICommand&)>;

    explicit HistoryManager(size_t max_history_depth = 120, size_t max_memory_bytes = 64 * 1024 * 1024);
    ~HistoryManager() = default;

    // Command dispatch
    void execute_command(std::unique_ptr<ICommand> command);

    // Direct undo & redo
    bool undo();
    bool redo();

    // Time travel: jump to specific step in the history timeline
    bool jump_to_step(size_t target_undo_depth);

    // Macro transaction handling
    void begin_macro(std::string description = "Macro Operation");
    void end_macro();
    void cancel_macro();
    [[nodiscard]] bool is_in_macro() const noexcept { return active_macro_ != nullptr; }

    // State inspection
    [[nodiscard]] bool can_undo() const noexcept;
    [[nodiscard]] bool can_redo() const noexcept;
    [[nodiscard]] size_t undo_count() const noexcept { return undo_stack_.size(); }
    [[nodiscard]] size_t redo_count() const noexcept { return redo_stack_.size(); }
    [[nodiscard]] size_t total_memory_bytes() const noexcept;
    [[nodiscard]] HistoryState current_state() const;
    [[nodiscard]] std::vector<HistoryItemInfo> timeline_snapshot() const;

    // Management
    void clear();
    void set_state_callback(StateChangeCallback cb);
    void set_command_callback(CommandExecutedCallback cb);

private:
    void notify_state_changed();
    void prune_memory_if_needed();

    size_t max_history_depth_{120};
    size_t max_memory_bytes_{64 * 1024 * 1024}; // 64 MB budget

    std::vector<std::unique_ptr<ICommand>> undo_stack_;
    std::vector<std::unique_ptr<ICommand>> redo_stack_;
    std::unique_ptr<CompoundCommand> active_macro_;

    StateChangeCallback state_callback_;
    CommandExecutedCallback command_callback_;
};

} // namespace inkforge::commands
