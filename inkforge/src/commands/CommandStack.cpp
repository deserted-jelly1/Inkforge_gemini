#include <inkforge/commands/CommandStack.hpp>

namespace inkforge::commands {

CommandStack::CommandStack(size_t max_history)
    : max_history_(max_history) {}

void CommandStack::push_and_execute(std::unique_ptr<ICommand> command) {
    if (!command) return;

    command->execute();
    undo_stack_.push_back(std::move(command));
    redo_stack_.clear();

    if (undo_stack_.size() > max_history_) {
        undo_stack_.erase(undo_stack_.begin());
    }

    notify_state_changed();
}

bool CommandStack::undo() {
    if (undo_stack_.empty()) {
        return false;
    }

    auto cmd = std::move(undo_stack_.back());
    undo_stack_.pop_back();

    cmd->undo();
    redo_stack_.push_back(std::move(cmd));

    notify_state_changed();
    return true;
}

bool CommandStack::redo() {
    if (redo_stack_.empty()) {
        return false;
    }

    auto cmd = std::move(redo_stack_.back());
    redo_stack_.pop_back();

    cmd->execute();
    undo_stack_.push_back(std::move(cmd));

    notify_state_changed();
    return true;
}

bool CommandStack::can_undo() const noexcept {
    return !undo_stack_.empty();
}

bool CommandStack::can_redo() const noexcept {
    return !redo_stack_.empty();
}

void CommandStack::clear() {
    undo_stack_.clear();
    redo_stack_.clear();
    notify_state_changed();
}

void CommandStack::set_state_callback(StackStateCallback cb) {
    callback_ = std::move(cb);
    notify_state_changed();
}

void CommandStack::notify_state_changed() {
    if (callback_) {
        callback_(can_undo(), can_redo());
    }
}

} // namespace inkforge::commands
