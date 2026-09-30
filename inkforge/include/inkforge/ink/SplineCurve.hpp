#pragma once

#include <vector>
#include <span>
#include <inkforge/core/Export.hpp>
#include <inkforge/ink/Point.hpp>

namespace inkforge::ink {

/**
 * @brief Centripetal Catmull-Rom spline evaluator (alpha = 0.5).
 * Guarantees zero cusps or self-intersections during rapid pen velocity transitions.
 */
class INKFORGE_API SplineCurve {
public:
    /**
     * @brief Generates an interpolated trajectory of smooth points from raw digitizer points.
     * @param control_points Sequence of raw digitizer samples.
     * @param subdivisions Number of intermediate interpolations per segment (default: 8).
     * @return Dense smooth point vector preserving interpolated pressure and timestamps.
     */
    [[nodiscard]] static std::vector<Point> evaluate_catmull_rom(
        std::span<const Point> control_points,
        size_t subdivisions = 8
    );

    /**
     * @brief Evaluates a single parametric point on the Catmull-Rom segment between P1 and P2.
     * @param p0 Prior point (tangent guide)
     * @param p1 Start point
     * @param p2 End point
     * @param p3 Next point (tangent guide)
     * @param t Normalized interpolation factor in [0.0, 1.0]
     */
    [[nodiscard]] static Point interpolate_segment(
        const Point& p0,
        const Point& p1,
        const Point& p2,
        const Point& p3,
        double t
    );
};

} // namespace inkforge::ink
