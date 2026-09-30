#pragma once

#include <cstdint>
#include <cmath>
#include <string>
#include <algorithm>

namespace inkforge::core {

struct Vec2d {
    double x{0.0};
    double y{0.0};

    constexpr Vec2d() noexcept = default;
    constexpr Vec2d(double in_x, double in_y) noexcept : x(in_x), y(in_y) {}

    [[nodiscard]] double length_squared() const noexcept {
        return x * x + y * y;
    }

    [[nodiscard]] double length() const noexcept {
        return std::sqrt(length_squared());
    }

    [[nodiscard]] double distance_to(const Vec2d& other) const noexcept {
        const double dx = x - other.x;
        const double dy = y - other.y;
        return std::sqrt(dx * dx + dy * dy);
    }

    constexpr Vec2d operator+(const Vec2d& o) const noexcept { return {x + o.x, y + o.y}; }
    constexpr Vec2d operator-(const Vec2d& o) const noexcept { return {x - o.x, y - o.y}; }
    constexpr Vec2d operator*(double s) const noexcept { return {x * s, y * s}; }
    constexpr Vec2d operator/(double s) const noexcept { return {x / s, y / s}; }
};

struct Rect2d {
    double min_x{0.0};
    double min_y{0.0};
    double max_x{0.0};
    double max_y{0.0};

    constexpr Rect2d() noexcept = default;
    constexpr Rect2d(double x0, double y0, double x1, double y1) noexcept
        : min_x(std::min(x0, x1)), min_y(std::min(y0, y1)),
          max_x(std::max(x0, x1)), max_y(std::max(y0, y1)) {}

    [[nodiscard]] double width() const noexcept { return max_x - min_x; }
    [[nodiscard]] double height() const noexcept { return max_y - min_y; }

    [[nodiscard]] bool intersects(const Rect2d& other) const noexcept {
        return !(max_x < other.min_x || min_x > other.max_x ||
                 max_y < other.min_y || min_y > other.max_y);
    }

    [[nodiscard]] bool contains(const Vec2d& pt) const noexcept {
        return pt.x >= min_x && pt.x <= max_x && pt.y >= min_y && pt.y <= max_y;
    }

    void expand_to_include(const Vec2d& pt) noexcept {
        min_x = std::min(min_x, pt.x);
        min_y = std::min(min_y, pt.y);
        max_x = std::max(max_x, pt.x);
        max_y = std::max(max_y, pt.y);
    }
};

struct ColorRgba {
    uint8_t r{0};
    uint8_t g{0};
    uint8_t b{0};
    uint8_t a{255};

    constexpr ColorRgba() noexcept = default;
    constexpr ColorRgba(uint8_t in_r, uint8_t in_g, uint8_t in_b, uint8_t in_a = 255) noexcept
        : r(in_r), g(in_g), b(in_b), a(in_a) {}

    [[nodiscard]] uint32_t to_u32() const noexcept {
        return (static_cast<uint32_t>(r) << 24) |
               (static_cast<uint32_t>(g) << 16) |
               (static_cast<uint32_t>(b) << 8)  |
               static_cast<uint32_t>(a);
    }

    static constexpr ColorRgba from_u32(uint32_t val) noexcept {
        return {
            static_cast<uint8_t>((val >> 24) & 0xFF),
            static_cast<uint8_t>((val >> 16) & 0xFF),
            static_cast<uint8_t>((val >> 8) & 0xFF),
            static_cast<uint8_t>(val & 0xFF)
        };
    }
};

} // namespace inkforge::core
