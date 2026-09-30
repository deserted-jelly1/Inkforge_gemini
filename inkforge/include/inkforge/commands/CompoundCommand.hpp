#pragma once

#include <vector>
#include <memory>
#include <string>
#include <chrono>
#include <inkforge/core/Export.hpp>
#include <inkforge/commands/ICommand.hpp>

namespace inkforge::commands {

/**
 * @brief Represents a transactional composite of multiple sub-commands executed as a single undo/redo unit.
 * Used for macro gestures such as continuous erasing across multiple strokes or multi-selection transformations.
 */
class INKFORGE_API CompoundCommand : public ICommand {
public:
    explicit CompoundCommand(std::string description = "Compound Operation");

    void add_command(std::unique_ptr<ICommand> command);
    [[nodiscard]] size_t sub_command_count() const noexcept { return sub_commands_.size(); }
    [[nodiscard]] bool empty() const noexcept { return sub_commands_.empty(); }

    void execute() override;
    void undo() override;

    [[nodiscard]] std::string description() const override { return description_; }
    [[nodiscard]] CommandType command_type() const noexcept override { return CommandType::Compound; }
    [[nodiscard]] uint64_t timestamp_us() const noexcept override { return timestamp_us_; }
    [[nodiscard]] size_t estimated_memory_bytes() const noexcept override;
    [[nodiscard]] bool is_valid() const noexcept override { return !sub_commands_.empty(); }

private:
    std::string description_;
    std::vector<std::unique_ptr<ICommand>> sub_commands_;
    uint64_t timestamp_us_{0};
};

} // namespace inkforge::commands
