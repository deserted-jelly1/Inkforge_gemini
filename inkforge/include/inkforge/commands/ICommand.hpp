#pragma once

#include <string>
#include <cstdint>
#include <inkforge/core/Export.hpp>

namespace inkforge::commands {

enum class CommandType : uint8_t {
    AddStroke = 0,
    RemoveStroke = 1,
    BatchRemoveStrokes = 2,
    ModifyStroke = 3,
    ClearLayer = 4,
    Compound = 5
};

/**
 * @brief Abstract Command interface for all reversible canvas and document actions.
 * Every concrete command encapsulates all state necessary to execute forward and rollback backward.
 */
class INKFORGE_API ICommand {
public:
    virtual ~ICommand() = default;

    virtual void execute() = 0;
    virtual void undo() = 0;

    [[nodiscard]] virtual std::string description() const = 0;
    [[nodiscard]] virtual CommandType command_type() const noexcept = 0;
    [[nodiscard]] virtual uint64_t timestamp_us() const noexcept = 0;
    [[nodiscard]] virtual size_t estimated_memory_bytes() const noexcept { return sizeof(*this); }
    [[nodiscard]] virtual bool is_valid() const noexcept { return true; }
};

} // namespace inkforge::commands
