#pragma once

#include <cstdint>
#include <inkforge/core/Types.hpp>
#include <inkforge/input/PenState.hpp>

namespace inkforge::input {

enum class TabletEventType : uint8_t {
    Down = 0,
    Move = 1,
    Up = 2,
    Hover = 3,
    Cancel = 4
};

struct TabletInputEvent {
    TabletEventType type{TabletEventType::Move};
    PointerDeviceType device{PointerDeviceType::Stylus};
    PointerButtonState buttons{PointerButtonState::None};

    core::Vec2d screen_pos{0.0, 0.0};   // Window coordinate pixels
    core::Vec2d world_pos{0.0, 0.0};    // Infinite canvas world coordinate
    float pressure{0.0f};               // Normalized [0.0, 1.0]
    float tilt_x{0.0f};                 // Degrees [-60.0, +60.0]
    float tilt_y{0.0f};                 // Degrees [-60.0, +60.0]
    uint64_t timestamp_us{0};           // Hardware packet timestamp

    constexpr TabletInputEvent() noexcept = default;
};

} // namespace inkforge::input
