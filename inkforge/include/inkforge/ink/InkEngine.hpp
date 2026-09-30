#pragma once

#include <memory>
#include <inkforge/core/Export.hpp>
#include <inkforge/ink/Stroke.hpp>

namespace inkforge::ink {

/**
 * @brief High-level digital ink processing engine.
 * Applies One Euro jitter filtering, pressure dynamics shaping, and Catmull-Rom tessellation.
 */
class INKFORGE_API InkEngine {
public:
    InkEngine() = default;
    ~InkEngine() = default;

    /**
     * @brief Computes the dynamic line width from base stroke width and pen pressure.
     * Uses non-linear gamma curve: width = base * (0.35 + 0.65 * pressure^1.4).
     */
    [[nodiscard]] static float compute_dynamic_width(float base_width, float pressure, ToolType tool) noexcept;

    /**
     * @brief Smooths an active or finalized stroke trajectory.
     */
    [[nodiscard]] static std::vector<Point> smooth_stroke(const Stroke& stroke);
};

} // namespace inkforge::ink
