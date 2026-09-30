#pragma once

#include <memory>
#include <QPainter>
#include <inkforge/core/Export.hpp>
#include <inkforge/rendering/IRenderer.hpp>

namespace inkforge::rendering {

/**
 * @brief High-performance Qt QPainter-backed digital ink renderer.
 * Performs sub-pixel antialiased stroke rendering and viewport culling.
 */
class INKFORGE_API CanvasRenderer : public IRenderer {
public:
    CanvasRenderer();
    ~CanvasRenderer() override;

    void set_painter(QPainter* painter);

    void begin_frame(int width, int height) override;
    void render_background(documents::BackgroundPattern pattern, double grid_spacing,
                           const ViewportTransform& transform) override;
    void render_stroke(const ink::Stroke& stroke, const ViewportTransform& transform) override;
    void render_in_flight_points(const std::vector<ink::Point>& points,
                                 ink::ToolType tool,
                                 core::ColorRgba color,
                                 float base_width,
                                 const ViewportTransform& transform) override;
    void end_frame() override;

private:
    QPainter* painter_{nullptr};
    int width_{0};
    int height_{0};
};

} // namespace inkforge::rendering
