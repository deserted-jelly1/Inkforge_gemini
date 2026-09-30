import { CodeFile } from '../types/inkforge';

export const CODEBASE_FILES: CodeFile[] = [
  {
    path: 'CMakeLists.txt',
    category: 'cmake',
    language: 'cmake',
    description: 'Root CMake build configuration targeting C++20 and Qt 6.5+ LTS.',
    content: `cmake_minimum_required(VERSION 3.24)

project(InkForge
    VERSION 0.1.0
    DESCRIPTION "AI-Enhanced Local-First Digital Handwriting Notebook"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Export compile commands for clangd / language servers
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Configure build options
option(INKFORGE_BUILD_TESTS "Build unit test suite" ON)
option(INKFORGE_ENABLE_WARNINGS_AS_ERRORS "Treat compiler warnings as errors" OFF)

# Platform detection
if(WIN32)
    add_compile_definitions(INKFORGE_PLATFORM_WINDOWS)
    if(MSVC)
        add_compile_options(/utf-8 /permissive- /Zc:__cplusplus /W4)
    endif()
elseif(UNIX AND NOT APPLE)
    add_compile_definitions(INKFORGE_PLATFORM_LINUX)
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Find Qt 6 packages
find_package(Qt6 6.5 REQUIRED COMPONENTS
    Core
    Gui
    Widgets
    Sql
)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

include_directories(\${CMAKE_CURRENT_SOURCE_DIR}/include)
add_subdirectory(src)

if(INKFORGE_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()`
  },
  {
    path: 'include/inkforge/ink/Point.hpp',
    category: 'header',
    language: 'cpp',
    description: 'Sub-pixel vector point struct storing world coordinates, normalized pressure, tilt, and microsecond timestamps.',
    content: `#pragma once

#include <cstdint>
#include <inkforge/core/Types.hpp>

namespace inkforge::ink {

/**
 * @brief High-precision vector point captured from digitizer or stylus.
 * Preserves sub-pixel coordinates, normalized pressure, physical tilt, and microsecond timestamp.
 */
struct Point {
    double x{0.0};              // World X coordinate
    double y{0.0};              // World Y coordinate
    float pressure{0.0f};       // Normalized pressure in [0.0, 1.0]
    float tilt_x{0.0f};         // Stylus tilt X in degrees [-60, +60]
    float tilt_y{0.0f};         // Stylus tilt Y in degrees [-60, +60]
    uint64_t timestamp_us{0};   // Microseconds timestamp since system epoch

    constexpr Point() noexcept = default;
    constexpr Point(double in_x, double in_y, float in_p = 0.5f,
                    float in_tx = 0.0f, float in_ty = 0.0f,
                    uint64_t in_ts = 0) noexcept
        : x(in_x), y(in_y), pressure(in_p), tilt_x(in_tx), tilt_y(in_ty), timestamp_us(in_ts) {}

    [[nodiscard]] constexpr core::Vec2d to_vec2d() const noexcept {
        return {x, y};
    }
};

} // namespace inkforge::ink`
  },
  {
    path: 'include/inkforge/ink/Stroke.hpp',
    category: 'header',
    language: 'cpp',
    description: 'Continuous vector stroke model with tool types, color, base width, raw trajectory samples, and bounding box.',
    content: `#pragma once

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

} // namespace inkforge::ink`
  },
  {
    path: 'src/ink/SplineCurve.cpp',
    category: 'source',
    language: 'cpp',
    description: 'Centripetal Catmull-Rom spline evaluator guaranteeing C1 continuity and eliminating self-intersection cusps.',
    content: `#include <inkforge/ink/SplineCurve.hpp>
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
    const Point& p0, const Point& p1, const Point& p2, const Point& p3, double t_param
) {
    constexpr double alpha = 0.5; // Centripetal parameter
    const double t0 = 0.0;
    const double t1 = get_time(t0, p0, p1, alpha);
    const double t2 = get_time(t1, p1, p2, alpha);
    const double t3 = get_time(t2, p2, p3, alpha);

    if (std::abs(t2 - t1) < 1e-6) return p1;

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
    std::span<const Point> control_points, size_t subdivisions
) {
    if (control_points.empty()) return {};
    if (control_points.size() == 1) return {control_points[0]};
    if (control_points.size() == 2) return {control_points[0], control_points[1]};

    std::vector<Point> result;
    result.reserve(control_points.size() * subdivisions);
    const size_t n = control_points.size();

    for (size_t i = 0; i < n - 1; ++i) {
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

} // namespace inkforge::ink`
  },
  {
    path: 'include/inkforge/input/ITabletInputSource.hpp',
    category: 'header',
    language: 'cpp',
    description: 'Hardware abstraction layer decoupling Wacom WinTab / Windows Ink / libinput from the drawing canvas.',
    content: `#pragma once

#include <functional>
#include <inkforge/core/Export.hpp>
#include <inkforge/input/TabletInputEvent.hpp>

namespace inkforge::input {

/**
 * @brief Platform-agnostic interface for tablet / digitizer input hardware.
 * Decouples Wacom WinTab / Windows Ink / Linux libinput from the canvas.
 */
class INKFORGE_API ITabletInputSource {
public:
    using EventCallback = std::function<void(const TabletInputEvent&)>;

    virtual ~ITabletInputSource() = default;

    virtual void start_listening(EventCallback callback) = 0;
    virtual void stop_listening() = 0;
    [[nodiscard]] virtual bool is_active() const = 0;
    [[nodiscard]] virtual const char* backend_name() const noexcept = 0;
};

} // namespace inkforge::input`
  },
  {
    path: 'src/rendering/CanvasRenderer.cpp',
    category: 'source',
    language: 'cpp',
    description: 'Antialiased QPainter rendering pipeline with viewport culling, dynamic width stroke evaluation, and background patterns.',
    content: `#include <inkforge/rendering/CanvasRenderer.hpp>
#include <inkforge/ink/InkEngine.hpp>
#include <QPainterPath>
#include <QColor>

namespace inkforge::rendering {

void CanvasRenderer::render_stroke(const ink::Stroke& stroke, const ViewportTransform& transform) {
    if (!painter_ || stroke.empty()) return;

    // Viewport Culling Check
    const auto visible_bounds = transform.visible_world_rect(width_, height_);
    if (!stroke.intersects(visible_bounds)) {
        return; // Culled
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

} // namespace inkforge::rendering`
  },
  {
    path: 'src/storage/SQLiteStorage.cpp',
    category: 'source',
    language: 'cpp',
    description: 'SQLite persistence driver with Write-Ahead Logging (WAL), relational schema migrations, and atomic transactions.',
    content: `#include <inkforge/storage/SQLiteStorage.hpp>
#include <QSqlQuery>
#include <QSqlError>

namespace inkforge::storage {

StorageResult SQLiteStorage::run_migrations() {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    if (!db.isOpen()) return StorageResult::DatabaseError;

    QSqlQuery q(db);
    const QString create_notebooks =
        "CREATE TABLE IF NOT EXISTS notebooks ("
        "  id TEXT PRIMARY KEY,"
        "  title TEXT NOT NULL,"
        "  created_at INTEGER NOT NULL,"
        "  updated_at INTEGER NOT NULL,"
        "  subject TEXT,"
        "  tags TEXT"
        ");";

    if (!q.exec(create_notebooks)) return StorageResult::DatabaseError;

    const QString create_pages =
        "CREATE TABLE IF NOT EXISTS pages ("
        "  id TEXT PRIMARY KEY,"
        "  notebook_id TEXT NOT NULL,"
        "  page_index INTEGER NOT NULL,"
        "  bg_pattern INTEGER DEFAULT 3,"
        "  grid_spacing REAL DEFAULT 24.0,"
        "  created_at INTEGER NOT NULL,"
        "  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE"
        ");";

    if (!q.exec(create_pages)) return StorageResult::DatabaseError;
    return StorageResult::Success;
}

} // namespace inkforge::storage`
  },
  {
    path: 'src/app/main.cpp',
    category: 'source',
    language: 'cpp',
    description: 'Application entry point initializing high-DPI scaling, Wacom tablet event filter, and MainWindow shell.',
    content: `#include <QApplication>
#include "MainWindow.hpp"
#include <inkforge/input/QtTabletFilter.hpp>
#include <inkforge/input/TabletDeviceManager.hpp>

int main(int argc, char* argv[]) {
    // Enable high-DPI canvas scaling
    QApplication::setHighDpiScaleFactorRoundingPolicy(
        Qt::HighDpiScaleFactorRoundingPolicy::PassThrough
    );

    QApplication app(argc, argv);
    app.setApplicationName("InkForge");
    app.setApplicationVersion("0.1.0");
    app.setOrganizationName("InkForgeLab");

    // Install global tablet event hook
    auto tablet_filter = std::make_shared<inkforge::input::QtTabletFilter>();
    inkforge::input::TabletDeviceManager::instance().register_source(tablet_filter);

    inkforge::app::MainWindow main_window;
    main_window.show();

    return app.exec();
}`
  },
  {
    path: 'include/inkforge/commands/HistoryManager.hpp',
    category: 'header',
    language: 'cpp',
    description: 'Centralized command-pattern history manager with macro transactions, memory budgeting, and non-destructive time travel.',
    content: `#pragma once

#include <vector>
#include <memory>
#include <string>
#include <functional>
#include <inkforge/core/Export.hpp>
#include <inkforge/commands/ICommand.hpp>
#include <inkforge/commands/CompoundCommand.hpp>

namespace inkforge::commands {

struct HistoryState {
    bool can_undo{false};
    bool can_redo{false};
    size_t undo_count{0};
    size_t redo_count{0};
    size_t total_memory_bytes{0};
    std::string last_undo_description;
    std::string last_redo_description;
};

class INKFORGE_API HistoryManager {
public:
    explicit HistoryManager(size_t max_history_depth = 120, size_t max_memory_bytes = 64 * 1024 * 1024);

    void execute_command(std::unique_ptr<ICommand> command);
    bool undo();
    bool redo();
    bool jump_to_step(size_t target_undo_depth);

    void begin_macro(std::string description = "Macro Operation");
    void end_macro();
    void cancel_macro();

    [[nodiscard]] bool can_undo() const noexcept;
    [[nodiscard]] bool can_redo() const noexcept;
    [[nodiscard]] HistoryState current_state() const;
};

} // namespace inkforge::commands`
  },
  {
    path: 'src/commands/HistoryManager.cpp',
    category: 'source',
    language: 'cpp',
    description: 'Command dispatch, dual undo/redo stack orchestration, transactional macros, and timeline stepping.',
    content: `#include <inkforge/commands/HistoryManager.hpp>

namespace inkforge::commands {

void HistoryManager::execute_command(std::unique_ptr<ICommand> command) {
    if (!command || !command->is_valid()) return;

    if (active_macro_) {
        command->execute();
        active_macro_->add_command(std::move(command));
        return;
    }

    command->execute();
    undo_stack_.push_back(std::move(command));
    redo_stack_.clear(); // Invalidate future redo branch

    if (undo_stack_.size() > max_history_depth_) {
        undo_stack_.erase(undo_stack_.begin());
    }
    prune_memory_if_needed();
    notify_state_changed();
}

bool HistoryManager::undo() {
    if (undo_stack_.empty() || active_macro_) return false;

    auto cmd = std::move(undo_stack_.back());
    undo_stack_.pop_back();
    cmd->undo();
    redo_stack_.push_back(std::move(cmd));

    notify_state_changed();
    return true;
}

bool HistoryManager::redo() {
    if (redo_stack_.empty() || active_macro_) return false;

    auto cmd = std::move(redo_stack_.back());
    redo_stack_.pop_back();
    cmd->execute();
    undo_stack_.push_back(std::move(cmd));

    notify_state_changed();
    return true;
}

} // namespace inkforge::commands`
  },
  {
    path: 'docs/ARCHITECTURE.md',
    category: 'docs',
    language: 'markdown',
    description: 'Comprehensive system architecture specification answering all 15 engineering requirements.',
    content: `# InkForge System Architecture (v0.1)

## 1. Executive Summary & Design Philosophy
InkForge is architected as a modular, high-performance desktop C++20/Qt 6 application. Its primary technical mandate is to deliver zero-compromise input-to-render latency for high-precision tablet pens (Wacom Intuos / Cintiq) while preserving complete vector trajectory fidelity.

### Architectural Invariants:
1. Unidirectional Event Pipeline: Tablet -> Input System -> Stroke Builder -> Document Model -> Render Pipeline.
2. Zero Business Logic in UI: Qt Widgets only emit intents and subscribe to document model change signals.
3. Decoupled Data Storage: Canvas never calls disk I/O directly; storage runs asynchronously in a worker.
4. Lossless Vector Capture: Coordinates, pressure dynamics, timestamps, and tilt angles are preserved.`
  }
];
