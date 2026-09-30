#include <inkforge/rendering/CanvasRenderer.hpp>
#include <inkforge/ink/InkEngine.hpp>
#include <QPainterPath>
#include <QColor>
#include <cmath>

namespace inkforge::rendering {

CanvasRenderer::CanvasRenderer() = default;
CanvasRenderer::~CanvasRenderer() = default;

void CanvasRenderer::set_painter(QPainter* painter) {
    painter_ = painter;
}

void CanvasRenderer::begin_frame(int width, int height) {
    width_ = width;
    height_ = height;
    if (painter_) {
        painter_->setRenderHint(QPainter::Antialiasing, true);
        painter_->setRenderHint(QPainter::SmoothPixmapTransform, true);
    }
}

void CanvasRenderer::render_background(
    documents::BackgroundPattern pattern,
    double grid_spacing,
    const ViewportTransform& transform
) {
    if (!painter_ || width_ <= 0 || height_ <= 0) return;

    // Fill clean paper tone
    painter_->fillRect(0, 0, width_, height_, QColor(250, 250, 252));

    if (pattern == documents::BackgroundPattern::Blank) {
        return;
    }

    const auto visible_rect = transform.visible_world_rect(width_, height_);
    const double spacing = std::max(grid_spacing, 12.0);

    const double start_x = std::floor(visible_rect.min_x / spacing) * spacing;
    const double start_y = std::floor(visible_rect.min_y / spacing) * spacing;

    if (pattern == documents::BackgroundPattern::DotGrid) {
        painter_->setPen(Qt::NoPen);
        painter_->setBrush(QColor(180, 185, 195, 160));
        const double dot_radius = std::max(1.0, 1.2 * transform.zoom());

        for (double wx = start_x; wx <= visible_rect.max_x; wx += spacing) {
            for (double wy = start_y; wy <= visible_rect.max_y; wy += spacing) {
                const auto sp = transform.world_to_screen({wx, wy});
                painter_->drawEllipse(QPointF(sp.x, sp.y), dot_radius, dot_radius);
            }
        }
    } else if (pattern == documents::BackgroundPattern::Grid) {
        QPen grid_pen(QColor(220, 224, 232), 1.0);
        painter_->setPen(grid_pen);

        for (double wx = start_x; wx <= visible_rect.max_x; wx += spacing) {
            const auto top = transform.world_to_screen({wx, visible_rect.min_y});
            const auto bot = transform.world_to_screen({wx, visible_rect.max_y});
            painter_->drawLine(QPointF(top.x, top.y), QPointF(bot.x, bot.y));
        }
        for (double wy = start_y; wy <= visible_rect.max_y; wy += spacing) {
            const auto left = transform.world_to_screen({visible_rect.min_x, wy});
            const auto right = transform.world_to_screen({visible_rect.max_x, wy});
            painter_->drawLine(QPointF(left.x, left.y), QPointF(right.x, right.y));
        }
    } else if (pattern == documents::BackgroundPattern::Lined) {
        QPen line_pen(QColor(215, 220, 230), 1.0);
        painter_->setPen(line_pen);

        for (double wy = start_y; wy <= visible_rect.max_y; wy += spacing) {
            const auto left = transform.world_to_screen({visible_rect.min_x, wy});
            const auto right = transform.world_to_screen({visible_rect.max_x, wy});
            painter_->drawLine(QPointF(left.x, left.y), QPointF(right.x, right.y));
        }
    }
}

void CanvasRenderer::render_stroke(const ink::Stroke& stroke, const ViewportTransform& transform) {
    if (!painter_ || stroke.empty()) return;

    // Viewport Culling Check
    const auto visible_bounds = transform.visible_world_rect(width_, height_);
    if (!stroke.intersects(visible_bounds)) {
        return; // Culled: outside viewport
    }

    const auto smooth_pts = ink::InkEngine::smooth_stroke(stroke);
    if (smooth_pts.size() < 2) return;

    const auto c = stroke.color();
    const float base_w = stroke.base_width() * static_cast<float>(transform.zoom());

    if (stroke.tool_type() == ink::ToolType::Highlighter) {
        painter_->save();
        painter_->setCompositionMode(QPainter::CompositionMode_Multiply);
        QPen pen(QColor(c.r, c.g, c.b, 110), base_w * 3.5f, Qt::SolidLine, Qt::FlatCap, Qt::RoundJoin);
        painter_->setPen(pen);

        QPainterPath path;
        const auto p0 = transform.world_to_screen({smooth_pts[0].x, smooth_pts[0].y});
        path.moveTo(p0.x, p0.y);
        for (size_t i = 1; i < smooth_pts.size(); ++i) {
            const auto p = transform.world_to_screen({smooth_pts[i].x, smooth_pts[i].y});
            path.lineTo(p.x, p.y);
        }
        painter_->drawPath(path);
        painter_->restore();
        return;
    }

    // Dynamic variable-width pen rendering with segment interpolation
    for (size_t i = 0; i < smooth_pts.size() - 1; ++i) {
        const auto& p1 = smooth_pts[i];
        const auto& p2 = smooth_pts[i + 1];

        const auto s1 = transform.world_to_screen({p1.x, p1.y});
        const auto s2 = transform.world_to_screen({p2.x, p2.y});

        const float avg_p = (p1.pressure + p2.pressure) * 0.5f;
        const float dyn_w = ink::InkEngine::compute_dynamic_width(base_w, avg_p, stroke.tool_type());

        QPen pen(QColor(c.r, c.g, c.b, c.a), dyn_w, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin);
        painter_->setPen(pen);
        painter_->drawLine(QPointF(s1.x, s1.y), QPointF(s2.x, s2.y));
    }
}

void CanvasRenderer::render_in_flight_points(
    const std::vector<ink::Point>& points,
    ink::ToolType tool,
    core::ColorRgba color,
    float base_width,
    const ViewportTransform& transform
) {
    if (!painter_ || points.size() < 2) return;

    const float scaled_base_w = base_width * static_cast<float>(transform.zoom());

    for (size_t i = 0; i < points.size() - 1; ++i) {
        const auto s1 = transform.world_to_screen({points[i].x, points[i].y});
        const auto s2 = transform.world_to_screen({points[i + 1].x, points[i + 1].y});

        const float avg_p = (points[i].pressure + points[i + 1].pressure) * 0.5f;
        const float dyn_w = ink::InkEngine::compute_dynamic_width(scaled_base_w, avg_p, tool);

        QPen pen(QColor(color.r, color.g, color.b, color.a), dyn_w, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin);
        painter_->setPen(pen);
        painter_->drawLine(QPointF(s1.x, s1.y), QPointF(s2.x, s2.y));
    }
}

void CanvasRenderer::end_frame() {
    painter_ = nullptr;
}

} // namespace inkforge::rendering
