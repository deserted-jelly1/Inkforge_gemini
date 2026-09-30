#pragma once

#include <vector>
#include <string>
#include <memory>
#include <inkforge/core/Export.hpp>
#include <inkforge/core/Types.hpp>
#include <inkforge/ink/Point.hpp>

namespace inkforge::ink {

enum class ToolType : uint8_t {
    Pen = 0,
    Highlighter = 1,
    Eraser = 2
};

/**
 * @brief Represents a continuous digital ink stroke in vector space.
 * Stores raw trajectory samples for lossless re-processing and cached bounding box for viewport culling.
 */
class INKFORGE_API Stroke {
public:
    Stroke();
    explicit Stroke(std::string id, ToolType tool = ToolType::Pen);

    [[nodiscard]] const std::string& id() const noexcept { return id_; }
    void set_id(std::string id) { id_ = std::move(id); }

    [[nodiscard]] ToolType tool_type() const noexcept { return tool_type_; }
    void set_tool_type(ToolType tool) noexcept { tool_type_ = tool; }

    [[nodiscard]] core::ColorRgba color() const noexcept { return color_; }
    void set_color(core::ColorRgba color) noexcept { color_ = color; }

    [[nodiscard]] float base_width() const noexcept { return base_width_; }
    void set_base_width(float width) noexcept { base_width_ = width; }

    [[nodiscard]] const std::vector<Point>& raw_points() const noexcept { return raw_points_; }
    [[nodiscard]] size_t point_count() const noexcept { return raw_points_.size(); }
    [[nodiscard]] bool empty() const noexcept { return raw_points_.empty(); }

    void add_point(const Point& pt);
    void clear_points();

    [[nodiscard]] const core::Rect2d& bounding_box() const noexcept { return bounding_box_; }
    void recompute_bounds();

    [[nodiscard]] bool intersects(const core::Rect2d& rect) const noexcept;
    [[nodiscard]] bool hits_point(const core::Vec2d& pt, double tolerance_radius) const noexcept;

private:
    std::string id_;
    ToolType tool_type_{ToolType::Pen};
    core::ColorRgba color_{0, 0, 0, 255};
    float base_width_{2.5f};
    std::vector<Point> raw_points_;
    core::Rect2d bounding_box_;
};

using StrokePtr = std::shared_ptr<Stroke>;
using StrokeConstPtr = std::shared_ptr<const Stroke>;

} // namespace inkforge::ink
