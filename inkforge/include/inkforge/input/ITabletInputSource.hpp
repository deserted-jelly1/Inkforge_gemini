#pragma once

#include <functional>
#include <inkforge/core/Export.hpp>
#include <inkforge/input/TabletInputEvent.hpp>

namespace inkforge::input {

/**
 * @brief Platform-agnostic interface for tablet / digitizer input hardware.
 * Decouples Wacom WinTab / Windows Ink / Linux libinput from the canvas.
 */
class INKFORGE_API ITabletInputSource {
public:
    using EventCallback = std::function<void(const TabletInputEvent&)>;

    virtual ~ITabletInputSource() = default;

    virtual void start_listening(EventCallback callback) = 0;
    virtual void stop_listening() = 0;
    [[nodiscard]] virtual bool is_active() const = 0;
    [[nodiscard]] virtual const char* backend_name() const noexcept = 0;
};

} // namespace inkforge::input
