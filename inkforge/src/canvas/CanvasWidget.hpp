#pragma once

#include <QWidget>
#include <QTabletEvent>
#include <QMouseEvent>
#include <QWheelEvent>
#include <QPaintEvent>
#include <memory>
#include <vector>
#include <inkforge/core/Export.hpp>
#include <inkforge/documents/DocumentModel.hpp>
#include <inkforge/rendering/CanvasRenderer.hpp>
#include <inkforge/rendering/ViewportTransform.hpp>
#include <inkforge/commands/HistoryManager.hpp>
#include <inkforge/ink/Stroke.hpp>

namespace inkforge::canvas {

class INKFORGE_API CanvasWidget : public QWidget {
    Q_OBJECT
public:
    explicit CanvasWidget(
        std::shared_ptr<documents::DocumentModel> doc_model,
        std::shared_ptr<commands::HistoryManager> history_manager,
        QWidget* parent = nullptr
    );
    ~CanvasWidget() override;

    void set_active_tool(ink::ToolType tool);
    [[nodiscard]] ink::ToolType active_tool() const noexcept { return current_tool_; }

    void set_stroke_color(core::ColorRgba color);
    void set_stroke_width(float width);

    void reset_viewport();
    [[nodiscard]] double zoom_level() const noexcept { return viewport_transform_.zoom(); }

    [[nodiscard]] std::shared_ptr<commands::HistoryManager> history_manager() const noexcept {
        return history_manager_;
    }

signals:
    void zoom_changed(double new_zoom);
    void pointer_diagnostics(double x, double y, float pressure, int point_count);

protected:
    void paintEvent(QPaintEvent* event) override;
    void tabletEvent(QTabletEvent* event) override;
    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void mouseReleaseEvent(QMouseEvent* event) override;
    void wheelEvent(QWheelEvent* event) override;

private:
    void handle_pointer_down(const core::Vec2d& screen_pos, float pressure, float tilt_x, float tilt_y);
    void handle_pointer_move(const core::Vec2d& screen_pos, float pressure, float tilt_x, float tilt_y);
    void handle_pointer_up(const core::Vec2d& screen_pos);

    std::shared_ptr<documents::DocumentModel> doc_model_;
    std::shared_ptr<commands::HistoryManager> history_manager_;
    rendering::CanvasRenderer renderer_;
    rendering::ViewportTransform viewport_transform_;

    ink::ToolType current_tool_{ink::ToolType::Pen};
    core::ColorRgba current_color_{15, 23, 42, 255}; // Deep slate ink
    float current_width_{2.5f};

    bool is_drawing_{false};
    bool is_panning_{false};
    core::Vec2d last_pan_pos_{0.0, 0.0};

    std::vector<ink::Point> active_stroke_points_;
    std::vector<ink::StrokePtr> erased_strokes_this_gesture_;
};

} // namespace inkforge::canvas
