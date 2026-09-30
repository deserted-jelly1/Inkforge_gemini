#include <inkforge/commands/HistoryManager.hpp>
#include <algorithm>

namespace inkforge::commands {

HistoryManager::HistoryManager(size_t max_history_depth, size_t max_memory_bytes)
    : max_history_depth_(max_history_depth), max_memory_bytes_(max_memory_bytes) {}

void HistoryManager::execute_command(std::unique_ptr<ICommand> command) {
    if (!command || !command->is_valid()) return;

    if (active_macro_) {
        // Collect into current open macro transaction
        command->execute();
        active_macro_->add_command(std::move(command));
        return;
    }

    command->execute();

    if (command_callback_) {
        command_callback_(*command);
    }

    undo_stack_.push_back(std::move(command));
    redo_stack_.clear(); // Redo branch is invalidated on new action

    if (undo_stack_.size() > max_history_depth_) {
        undo_stack_.erase(undo_stack_.begin());
    }

    prune_memory_if_needed();
    notify_state_changed();
}

bool HistoryManager::undo() {
    if (undo_stack_.empty() || active_macro_) {
        return false;
    }

    auto cmd = std::move(undo_stack_.back());
    undo_stack_.pop_back();

    cmd->undo();
    redo_stack_.push_back(std::move(cmd));

    notify_state_changed();
    return true;
}

bool HistoryManager::redo() {
    if (redo_stack_.empty() || active_macro_) {
        return false;
    }

    auto cmd = std::move(redo_stack_.back());
    redo_stack_.pop_back();

    cmd->execute();
    undo_stack_.push_back(std::move(cmd));

    notify_state_changed();
    return true;
}

bool HistoryManager::jump_to_step(size_t target_undo_depth) {
    if (active_macro_) return false;

    if (target_undo_depth > undo_stack_.size() + redo_stack_.size()) {
        return false;
    }

    // If target depth is less than current undo count, perform undos
    while (undo_stack_.size() > target_undo_depth) {
        if (!undo()) return false;
    }

    // If target depth is greater than current undo count, perform redos
    while (undo_stack_.size() < target_undo_depth) {
        if (!redo()) return false;
    }

    return true;
}

void HistoryManager::begin_macro(std::string description) {
    if (active_macro_) {
        // Nested macro - close prior or commit
        end_macro();
    }
    active_macro_ = std::make_unique<CompoundCommand>(std::move(description));
}

void HistoryManager::end_macro() {
    if (!active_macro_) return;

    auto macro = std::move(active_macro_);
    if (!macro->empty()) {
        undo_stack_.push_back(std::move(macro));
        redo_stack_.clear();
        if (undo_stack_.size() > max_history_depth_) {
            undo_stack_.erase(undo_stack_.begin());
        }
        prune_memory_if_needed();
        notify_state_changed();
    }
}

void HistoryManager::cancel_macro() {
    if (!active_macro_) return;
    // Rollback any executed subcommands in the abandoned macro
    active_macro_->undo();
    active_macro_.reset();
}

bool HistoryManager::can_undo() const noexcept {
    return !undo_stack_.empty() && !active_macro_;
}

bool HistoryManager::can_redo() const noexcept {
    return !redo_stack_.empty() && !active_macro_;
}

size_t HistoryManager::total_memory_bytes() const noexcept {
    size_t total = 0;
    for (const auto& cmd : undo_stack_) {
        if (cmd) total += cmd->estimated_memory_bytes();
    }
    for (const auto& cmd : redo_stack_) {
        if (cmd) total += cmd->estimated_memory_bytes();
    }
    return total;
}

HistoryState HistoryManager::current_state() const {
    HistoryState st;
    st.can_undo = can_undo();
    st.can_redo = can_redo();
    st.undo_count = undo_stack_.size();
    st.redo_count = redo_stack_.size();
    st.total_memory_bytes = total_memory_bytes();
    if (!undo_stack_.empty() && undo_stack_.back()) {
        st.last_undo_description = undo_stack_.back()->description();
    }
    if (!redo_stack_.empty() && redo_stack_.back()) {
        st.last_redo_description = redo_stack_.back()->description();
    }
    return st;
}

std::vector<HistoryItemInfo> HistoryManager::timeline_snapshot() const {
    std::vector<HistoryItemInfo> timeline;
    timeline.reserve(undo_stack_.size() + redo_stack_.size());

    for (const auto& cmd : undo_stack_) {
        if (cmd) {
            timeline.push_back({
                cmd->description(),
                cmd->command_type(),
                cmd->timestamp_us(),
                cmd->estimated_memory_bytes(),
                false // Active / committed
            });
        }
    }

    // Redo items listed in forward time order
    for (auto it = redo_stack_.rbegin(); it != redo_stack_.rend(); ++it) {
        if (*it) {
            timeline.push_back({
                (*it)->description(),
                (*it)->command_type(),
                (*it)->timestamp_us(),
                (*it)->estimated_memory_bytes(),
                true // Undone
            });
        }
    }

    return timeline;
}

void HistoryManager::clear() {
    undo_stack_.clear();
    redo_stack_.clear();
    active_macro_.reset();
    notify_state_changed();
}

void HistoryManager::set_state_callback(StateChangeCallback cb) {
    state_callback_ = std::move(cb);
    notify_state_changed();
}

void HistoryManager::set_command_callback(CommandExecutedCallback cb) {
    command_callback_ = std::move(cb);
}

void HistoryManager::notify_state_changed() {
    if (state_callback_) {
        state_callback_(current_state());
    }
}

void HistoryManager::prune_memory_if_needed() {
    while (total_memory_bytes() > max_memory_bytes_ && undo_stack_.size() > 5) {
        undo_stack_.erase(undo_stack_.begin());
    }
}

} // namespace inkforge::commands
