#include <inkforge/commands/CompoundCommand.hpp>

namespace inkforge::commands {

CompoundCommand::CompoundCommand(std::string description)
    : description_(std::move(description)) {
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    timestamp_us_ = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());
}

void CompoundCommand::add_command(std::unique_ptr<ICommand> command) {
    if (command) {
        sub_commands_.push_back(std::move(command));
    }
}

void CompoundCommand::execute() {
    for (auto& cmd : sub_commands_) {
        if (cmd) {
            cmd->execute();
        }
    }
}

void CompoundCommand::undo() {
    // Reverse execution order for proper undo semantics
    for (auto it = sub_commands_.rbegin(); it != sub_commands_.rend(); ++it) {
        if (*it) {
            (*it)->undo();
        }
    }
}

size_t CompoundCommand::estimated_memory_bytes() const noexcept {
    size_t total = sizeof(*this) + sub_commands_.capacity() * sizeof(std::unique_ptr<ICommand>);
    for (const auto& cmd : sub_commands_) {
        if (cmd) {
            total += cmd->estimated_memory_bytes();
        }
    }
    return total;
}

} // namespace inkforge::commands
