#include <inkforge/ink/SplineCurve.hpp>
#include <cmath>

namespace inkforge::ink {

namespace {

inline double distance_sq(const Point& a, const Point& b) noexcept {
    const double dx = a.x - b.x;
    const double dy = a.y - b.y;
    return dx * dx + dy * dy;
}

inline double get_time(double t_prev, const Point& p_prev, const Point& p_curr, double alpha = 0.5) noexcept {
    const double d_sq = distance_sq(p_prev, p_curr);
    return t_prev + std::pow(d_sq, alpha * 0.5);
}

} // namespace

Point SplineCurve::interpolate_segment(
    const Point& p0,
    const Point& p1,
    const Point& p2,
    const Point& p3,
    double t_param
) {
    constexpr double alpha = 0.5; // Centripetal parameter
    const double t0 = 0.0;
    const double t1 = get_time(t0, p0, p1, alpha);
    const double t2 = get_time(t1, p1, p2, alpha);
    const double t3 = get_time(t2, p2, p3, alpha);

    if (std::abs(t2 - t1) < 1e-6) {
        return p1;
    }

    const double t = t1 + t_param * (t2 - t1);

    auto interpolate_points = [](const Point& a, const Point& b, double ta, double tb, double t_val) -> Point {
        if (std::abs(tb - ta) < 1e-6) return a;
        const double factor = (t_val - ta) / (tb - ta);
        return Point(
            a.x + (b.x - a.x) * factor,
            a.y + (b.y - a.y) * factor,
            static_cast<float>(a.pressure + (b.pressure - a.pressure) * factor),
            static_cast<float>(a.tilt_x + (b.tilt_x - a.tilt_x) * factor),
            static_cast<float>(a.tilt_y + (b.tilt_y - a.tilt_y) * factor),
            static_cast<uint64_t>(a.timestamp_us + (b.timestamp_us - a.timestamp_us) * factor)
        );
    };

    const Point a1 = interpolate_points(p0, p1, t0, t1, t);
    const Point a2 = interpolate_points(p1, p2, t1, t2, t);
    const Point a3 = interpolate_points(p2, p3, t2, t3, t);

    const Point b1 = interpolate_points(a1, a2, t0, t2, t);
    const Point b2 = interpolate_points(a2, a3, t1, t3, t);

    return interpolate_points(b1, b2, t1, t2, t);
}

std::vector<Point> SplineCurve::evaluate_catmull_rom(
    std::span<const Point> control_points,
    size_t subdivisions
) {
    if (control_points.empty()) {
        return {};
    }
    if (control_points.size() == 1) {
        return {control_points[0]};
    }
    if (control_points.size() == 2) {
        return {control_points[0], control_points[1]};
    }

    std::vector<Point> result;
    result.reserve(control_points.size() * subdivisions);

    const size_t n = control_points.size();
    for (size_t i = 0; i < n - 1; ++i) {
        // Virtual endpoints for boundary condition
        const Point& p0 = (i == 0) ? control_points[0] : control_points[i - 1];
        const Point& p1 = control_points[i];
        const Point& p2 = control_points[i + 1];
        const Point& p3 = (i + 2 < n) ? control_points[i + 2] : control_points[n - 1];

        const size_t steps = (i == n - 2) ? subdivisions + 1 : subdivisions;
        for (size_t s = 0; s < steps; ++s) {
            const double t = static_cast<double>(s) / static_cast<double>(subdivisions);
            result.push_back(interpolate_segment(p0, p1, p2, p3, t));
        }
    }

    return result;
}

} // namespace inkforge::ink
