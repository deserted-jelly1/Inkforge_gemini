#include <inkforge/ink/InkEngine.hpp>
#include <inkforge/ink/SplineCurve.hpp>
#include <algorithm>
#include <cmath>

namespace inkforge::ink {

float InkEngine::compute_dynamic_width(float base_width, float pressure, ToolType tool) noexcept {
    const float clamped_p = std::clamp(pressure, 0.05f, 1.0f);

    switch (tool) {
        case ToolType::Pen: {
            // Gamma 1.35 power curve: natural fountain pen / ballpoint dynamic feel
            const float scale = 0.30f + 0.70f * std::pow(clamped_p, 1.35f);
            return base_width * scale;
        }
        case ToolType::Highlighter:
            // Highlighters maintain nearly uniform wide chisel width
            return base_width * (0.85f + 0.15f * clamped_p);

        case ToolType::Eraser:
            return base_width * 1.5f;
    }
    return base_width;
}

std::vector<Point> InkEngine::smooth_stroke(const Stroke& stroke) {
    if (stroke.point_count() < 3) {
        return stroke.raw_points();
    }
    return SplineCurve::evaluate_catmull_rom(stroke.raw_points(), 8);
}

} // namespace inkforge::ink
