#include <inkforge/ink/Stroke.hpp>
#include <algorithm>
#include <cmath>

namespace inkforge::ink {

Stroke::Stroke()
    : id_("stroke_default") {}

Stroke::Stroke(std::string id, ToolType tool)
    : id_(std::move(id)), tool_type_(tool) {}

void Stroke::add_point(const Point& pt) {
    if (raw_points_.empty()) {
        bounding_box_ = core::Rect2d(pt.x, pt.y, pt.x, pt.y);
    } else {
        bounding_box_.expand_to_include(pt.to_vec2d());
    }
    raw_points_.push_back(pt);
}

void Stroke::clear_points() {
    raw_points_.clear();
    bounding_box_ = core::Rect2d();
}

void Stroke::recompute_bounds() {
    if (raw_points_.empty()) {
        bounding_box_ = core::Rect2d();
        return;
    }
    bounding_box_ = core::Rect2d(raw_points_[0].x, raw_points_[0].y, raw_points_[0].x, raw_points_[0].y);
    for (size_t i = 1; i < raw_points_.size(); ++i) {
        bounding_box_.expand_to_include(raw_points_[i].to_vec2d());
    }

    // Expand bounding box by half the stroke width to enclose stroke rasterization
    const double pad = static_cast<double>(base_width_) * 1.5;
    bounding_box_.min_x -= pad;
    bounding_box_.min_y -= pad;
    bounding_box_.max_x += pad;
    bounding_box_.max_y += pad;
}

bool Stroke::intersects(const core::Rect2d& rect) const noexcept {
    return bounding_box_.intersects(rect);
}

bool Stroke::hits_point(const core::Vec2d& pt, double tolerance_radius) const noexcept {
    if (!bounding_box_.contains(pt)) {
        // Quick rejection test with padding
        const core::Rect2d expanded_bounds{
            bounding_box_.min_x - tolerance_radius,
            bounding_box_.min_y - tolerance_radius,
            bounding_box_.max_x + tolerance_radius,
            bounding_box_.max_y + tolerance_radius
        };
        if (!expanded_bounds.contains(pt)) {
            return false;
        }
    }

    const double tol_sq = tolerance_radius * tolerance_radius;
    for (const auto& p : raw_points_) {
        const double dx = p.x - pt.x;
        const double dy = p.y - pt.y;
        if (dx * dx + dy * dy <= tol_sq) {
            return true;
        }
    }
    return false;
}

} // namespace inkforge::ink
