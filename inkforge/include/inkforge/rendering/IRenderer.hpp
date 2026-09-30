#pragma once

#include <inkforge/core/Export.hpp>
#include <inkforge/core/Types.hpp>
#include <inkforge/ink/Stroke.hpp>
#include <inkforge/documents/Page.hpp>
#include <inkforge/rendering/ViewportTransform.hpp>

namespace inkforge::rendering {

/**
 * @brief Abstract rendering engine interface.
 * Implemented by QPainter software renderer and future hardware GPU / OpenGL backends.
 */
class INKFORGE_API IRenderer {
public:
    virtual ~IRenderer() = default;

    virtual void begin_frame(int width, int height) = 0;
    virtual void render_background(documents::BackgroundPattern pattern, double grid_spacing,
                                   const ViewportTransform& transform) = 0;
    virtual void render_stroke(const ink::Stroke& stroke, const ViewportTransform& transform) = 0;
    virtual void render_in_flight_points(const std::vector<ink::Point>& points,
                                         ink::ToolType tool,
                                         core::ColorRgba color,
                                         float base_width,
                                         const ViewportTransform& transform) = 0;
    virtual void end_frame() = 0;
};

} // namespace inkforge::rendering
