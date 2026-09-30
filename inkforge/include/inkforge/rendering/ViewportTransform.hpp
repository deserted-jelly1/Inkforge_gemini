#pragma once

#include <algorithm>
#include <inkforge/core/Types.hpp>

namespace inkforge::rendering {

/**
 * @brief Manages 2D affine transformations between infinite canvas world space and screen viewport pixels.
 */
class ViewportTransform {
public:
    ViewportTransform() = default;

    [[nodiscard]] double zoom() const noexcept { return zoom_; }
    void set_zoom(double z) noexcept {
        zoom_ = std::clamp(z, min_zoom_, max_zoom_);
    }

    void zoom_at(double factor, const core::Vec2d& screen_pivot) noexcept {
        const double old_zoom = zoom_;
        set_zoom(zoom_ * factor);
        const double actual_ratio = zoom_ / old_zoom;

        // Keep screen_pivot pinned in world coordinates
        pan_x_ = screen_pivot.x - (screen_pivot.x - pan_x_) * actual_ratio;
        pan_y_ = screen_pivot.y - (screen_pivot.y - pan_y_) * actual_ratio;
    }

    [[nodiscard]] core::Vec2d pan() const noexcept { return {pan_x_, pan_y_}; }
    void set_pan(double px, double py) noexcept {
        pan_x_ = px;
        pan_y_ = py;
    }

    void apply_pan_delta(double dx, double dy) noexcept {
        pan_x_ += dx;
        pan_y_ += dy;
    }

    /**
     * @brief Transforms screen pixel coordinates to infinite world coordinates.
     */
    [[nodiscard]] core::Vec2d screen_to_world(const core::Vec2d& screen_pos) const noexcept {
        return {
            (screen_pos.x - pan_x_) / zoom_,
            (screen_pos.y - pan_y_) / zoom_
        };
    }

    /**
     * @brief Transforms infinite world coordinates to screen pixel coordinates.
     */
    [[nodiscard]] core::Vec2d world_to_screen(const core::Vec2d& world_pos) const noexcept {
        return {
            world_pos.x * zoom_ + pan_x_,
            world_pos.y * zoom_ + pan_y_
        };
    }

    /**
     * @brief Computes the visible world rectangle for a viewport of size (width, height).
     */
    [[nodiscard]] core::Rect2d visible_world_rect(double viewport_width, double viewport_height) const noexcept {
        const auto top_left = screen_to_world({0.0, 0.0});
        const auto bottom_right = screen_to_world({viewport_width, viewport_height});
        return {top_left.x, top_left.y, bottom_right.x, bottom_right.y};
    }

    void reset() noexcept {
        zoom_ = 1.0;
        pan_x_ = 0.0;
        pan_y_ = 0.0;
    }

private:
    double zoom_{1.0};
    double pan_x_{0.0};
    double pan_y_{0.0};
    double min_zoom_{0.1}; // 10%
    double max_zoom_{5.0}; // 500%
};

} // namespace inkforge::rendering
