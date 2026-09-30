#pragma once

#include <cstdint>
#include <inkforge/core/Types.hpp>

namespace inkforge::ink {

/**
 * @brief High-precision vector point captured from digitizer or stylus.
 * Preserves sub-pixel coordinates, normalized pressure, physical tilt, and microsecond timestamp.
 */
struct Point {
    double x{0.0};              // World X coordinate
    double y{0.0};              // World Y coordinate
    float pressure{0.0f};       // Normalized pressure in [0.0, 1.0]
    float tilt_x{0.0f};         // Stylus tilt X in degrees [-60, +60]
    float tilt_y{0.0f};         // Stylus tilt Y in degrees [-60, +60]
    uint64_t timestamp_us{0};   // Microseconds timestamp since system epoch

    constexpr Point() noexcept = default;
    constexpr Point(double in_x, double in_y, float in_p = 0.5f,
                    float in_tx = 0.0f, float in_ty = 0.0f,
                    uint64_t in_ts = 0) noexcept
        : x(in_x), y(in_y), pressure(in_p), tilt_x(in_tx), tilt_y(in_ty), timestamp_us(in_ts) {}

    [[nodiscard]] constexpr core::Vec2d to_vec2d() const noexcept {
        return {x, y};
    }
};

} // namespace inkforge::ink
