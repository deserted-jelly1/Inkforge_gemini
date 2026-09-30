#include "CanvasWidget.hpp"
#include <QPainter>
#include <inkforge/commands/StrokeCommands.hpp>
#include <chrono>

namespace inkforge::canvas {

CanvasWidget::CanvasWidget(
    std::shared_ptr<documents::DocumentModel> doc_model,
    std::shared_ptr<commands::HistoryManager> history_manager,
    QWidget* parent
)
    : QWidget(parent),
      doc_model_(std::move(doc_model)),
      history_manager_(std::move(history_manager)) {
    setAttribute(Qt::WA_AcceptTouchEvents, false);
    setMouseTracking(true);
    setFocusPolicy(Qt::StrongFocus);

    if (doc_model_) {
        doc_model_->add_change_listener([this]() {
            update();
        });
    }
}

CanvasWidget::~CanvasWidget() = default;

void CanvasWidget::set_active_tool(ink::ToolType tool) {
    current_tool_ = tool;
    update();
}

void CanvasWidget::set_stroke_color(core::ColorRgba color) {
    current_color_ = color;
}

void CanvasWidget::set_stroke_width(float width) {
    current_width_ = width;
}

void CanvasWidget::reset_viewport() {
    viewport_transform_.reset();
    emit zoom_changed(viewport_transform_.zoom());
    update();
}

void CanvasWidget::paintEvent(QPaintEvent* /*event*/) {
    QPainter painter(this);
    renderer_.set_painter(&painter);
    renderer_.begin_frame(width(), height());

    auto notebook = doc_model_ ? doc_model_->current_notebook() : nullptr;
    auto page = notebook ? notebook->active_page() : nullptr;

    const auto pattern = page ? page->background_pattern() : documents::BackgroundPattern::DotGrid;
    const double spacing = page ? page->grid_spacing() : 24.0;

    renderer_.render_background(pattern, spacing, viewport_transform_);

    if (page) {
        for (const auto& layer : page->layers()) {
            if (!layer.is_visible()) continue;
            for (const auto& stroke : layer.strokes()) {
                if (stroke) {
                    renderer_.render_stroke(*stroke, viewport_transform_);
                }
            }
        }
    }

    if (is_drawing_ && !active_stroke_points_.empty()) {
        renderer_.render_in_flight_points(
            active_stroke_points_,
            current_tool_,
            current_color_,
            current_width_,
            viewport_transform_
        );
    }

    renderer_.end_frame();
}

void CanvasWidget::tabletEvent(QTabletEvent* event) {
    const core::Vec2d screen_pos{event->position().x(), event->position().y()};
    const float pressure = static_cast<float>(event->pressure());
    const float tilt_x = static_cast<float>(event->xTilt());
    const float tilt_y = static_cast<float>(event->yTilt());

    switch (event->type()) {
        case QEvent::TabletPress:
            if (event->pointerType() == QPointingDevice::PointerType::Eraser) {
                current_tool_ = ink::ToolType::Eraser;
            }
            handle_pointer_down(screen_pos, pressure, tilt_x, tilt_y);
            event->accept();
            break;

        case QEvent::TabletMove:
            handle_pointer_move(screen_pos, pressure, tilt_x, tilt_y);
            event->accept();
            break;

        case QEvent::TabletRelease:
            handle_pointer_up(screen_pos);
            event->accept();
            break;

        default:
            event->ignore();
            break;
    }
}

void CanvasWidget::mousePressEvent(QMouseEvent* event) {
    const core::Vec2d pos{static_cast<double>(event->position().x()), static_cast<double>(event->position().y())};

    if (event->button() == Qt::MiddleButton || (event->modifiers() & Qt::SpaceModifier)) {
        is_panning_ = true;
        last_pan_pos_ = pos;
        setCursor(Qt::ClosedHandCursor);
        event->accept();
        return;
    }

    if (event->button() == Qt::LeftButton) {
        handle_pointer_down(pos, 0.6f, 0.0f, 0.0f);
        event->accept();
    }
}

void CanvasWidget::mouseMoveEvent(QMouseEvent* event) {
    const core::Vec2d pos{static_cast<double>(event->position().x()), static_cast<double>(event->position().y())};

    if (is_panning_) {
        const double dx = pos.x - last_pan_pos_.x;
        const double dy = pos.y - last_pan_pos_.y;
        last_pan_pos_ = pos;
        viewport_transform_.apply_pan_delta(dx, dy);
        update();
        event->accept();
        return;
    }

    if (is_drawing_) {
        handle_pointer_move(pos, 0.6f, 0.0f, 0.0f);
        event->accept();
    }
}

void CanvasWidget::mouseReleaseEvent(QMouseEvent* event) {
    if (is_panning_ && (event->button() == Qt::MiddleButton || event->button() == Qt::LeftButton)) {
        is_panning_ = false;
        unsetCursor();
        event->accept();
        return;
    }

    if (is_drawing_ && event->button() == Qt::LeftButton) {
        const core::Vec2d pos{static_cast<double>(event->position().x()), static_cast<double>(event->position().y())};
        handle_pointer_up(pos);
        event->accept();
    }
}

void CanvasWidget::wheelEvent(QWheelEvent* event) {
    const double num_degrees = static_cast<double>(event->angleDelta().y()) / 8.0;
    const double num_steps = num_degrees / 15.0;
    const double factor = std::pow(1.12, num_steps);

    const auto mouse_pos = event->position();
    viewport_transform_.zoom_at(factor, {mouse_pos.x(), mouse_pos.y()});

    emit zoom_changed(viewport_transform_.zoom());
    update();
    event->accept();
}

void CanvasWidget::handle_pointer_down(const core::Vec2d& screen_pos, float pressure, float tilt_x, float tilt_y) {
    const auto world_pos = viewport_transform_.screen_to_world(screen_pos);

    if (current_tool_ == ink::ToolType::Eraser) {
        is_drawing_ = true;
        erased_strokes_this_gesture_.clear();

        auto notebook = doc_model_ ? doc_model_->current_notebook() : nullptr;
        auto page = notebook ? notebook->active_page() : nullptr;
        auto layer = page ? page->active_layer() : nullptr;
        if (layer) {
            for (const auto& s : layer->strokes()) {
                if (s && s->hits_point(world_pos, 14.0 / viewport_transform_.zoom())) {
                    erased_strokes_this_gesture_.push_back(s);
                    layer->remove_stroke(s->id());
                    update();
                    break;
                }
            }
        }
        return;
    }

    is_drawing_ = true;
    active_stroke_points_.clear();

    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    const auto ts = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());

    active_stroke_points_.emplace_back(world_pos.x, world_pos.y, pressure, tilt_x, tilt_y, ts);
    emit pointer_diagnostics(world_pos.x, world_pos.y, pressure, 1);
    update();
}

void CanvasWidget::handle_pointer_move(const core::Vec2d& screen_pos, float pressure, float tilt_x, float tilt_y) {
    if (!is_drawing_) return;

    const auto world_pos = viewport_transform_.screen_to_world(screen_pos);

    if (current_tool_ == ink::ToolType::Eraser) {
        auto notebook = doc_model_ ? doc_model_->current_notebook() : nullptr;
        auto page = notebook ? notebook->active_page() : nullptr;
        auto layer = page ? page->active_layer() : nullptr;
        if (layer) {
            for (const auto& s : layer->strokes()) {
                if (s && s->hits_point(world_pos, 14.0 / viewport_transform_.zoom())) {
                    erased_strokes_this_gesture_.push_back(s);
                    layer->remove_stroke(s->id());
                    update();
                    break;
                }
            }
        }
        return;
    }

    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    const auto ts = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());

    active_stroke_points_.emplace_back(world_pos.x, world_pos.y, pressure, tilt_x, tilt_y, ts);
    emit pointer_diagnostics(world_pos.x, world_pos.y, pressure, static_cast<int>(active_stroke_points_.size()));
    update();
}

void CanvasWidget::handle_pointer_up(const core::Vec2d& /*screen_pos*/) {
    if (!is_drawing_) return;
    is_drawing_ = false;

    auto notebook = doc_model_ ? doc_model_->current_notebook() : nullptr;
    auto page = notebook ? notebook->active_page() : nullptr;
    auto layer = page ? page->active_layer() : nullptr;

    if (current_tool_ == ink::ToolType::Eraser) {
        if (!erased_strokes_this_gesture_.empty() && layer && history_manager_) {
            // Restore strokes temporarily so the command execution encapsulates proper forward execution
            for (const auto& s : erased_strokes_this_gesture_) {
                layer->add_stroke(s);
            }
            auto batch_cmd = std::make_unique<commands::BatchRemoveStrokesCommand>(
                layer,
                std::move(erased_strokes_this_gesture_)
            );
            history_manager_->execute_command(std::move(batch_cmd));
            if (doc_model_) doc_model_->notify_modified();
        }
        erased_strokes_this_gesture_.clear();
        update();
        return;
    }

    if (active_stroke_points_.size() >= 2 && layer) {
        static uint64_t s_stroke_counter = 1000;
        const std::string s_id = "strk_" + std::to_string(++s_stroke_counter);
        auto new_stroke = std::make_shared<ink::Stroke>(s_id, current_tool_);
        new_stroke->set_color(current_color_);
        new_stroke->set_base_width(current_width_);

        for (const auto& pt : active_stroke_points_) {
            new_stroke->add_point(pt);
        }
        new_stroke->recompute_bounds();

        if (history_manager_) {
            history_manager_->execute_command(
                std::make_unique<commands::AddStrokeCommand>(layer, std::move(new_stroke))
            );
        }
        if (doc_model_) {
            doc_model_->notify_modified();
        }
    }

    active_stroke_points_.clear();
    update();
}

} // namespace inkforge::canvas
