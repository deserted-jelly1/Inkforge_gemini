#pragma once

#include <vector>
#include <memory>
#include <functional>
#include <inkforge/core/Export.hpp>
#include <inkforge/commands/ICommand.hpp>

namespace inkforge::commands {

class INKFORGE_API CommandStack {
public:
    using StackStateCallback = std::function<void(bool can_undo, bool can_redo)>;

    explicit CommandStack(size_t max_history = 100);

    void push_and_execute(std::unique_ptr<ICommand> command);
    bool undo();
    bool redo();

    [[nodiscard]] bool can_undo() const noexcept;
    [[nodiscard]] bool can_redo() const noexcept;
    void clear();

    void set_state_callback(StackStateCallback cb);

private:
    void notify_state_changed();

    size_t max_history_{100};
    std::vector<std::unique_ptr<ICommand>> undo_stack_;
    std::vector<std::unique_ptr<ICommand>> redo_stack_;
    StackStateCallback callback_;
};

} // namespace inkforge::commands
