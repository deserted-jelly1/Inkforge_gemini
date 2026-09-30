#include <inkforge/ink/Stroke.hpp>
#include <inkforge/ink/SplineCurve.hpp>
#include <inkforge/ink/InkEngine.hpp>
#include <iostream>

#define TEST_ASSERT(expr) \
    do { \
        if (!(expr)) { \
            std::cerr << "Assertion failed: " #expr " at " << __FILE__ << ":" << __LINE__ << "\n"; \
            std::exit(1); \
        } \
    } while (0)

namespace inkforge::test {
void register_test(std::string name, std::function<void()> func);
}

static void test_stroke_bounds() {
    inkforge::ink::Stroke stroke("s1", inkforge::ink::ToolType::Pen);
    TEST_ASSERT(stroke.empty());

    stroke.add_point(inkforge::ink::Point(10.0, 20.0, 0.5f));
    stroke.add_point(inkforge::ink::Point(50.0, 80.0, 0.8f));
    TEST_ASSERT(stroke.point_count() == 2);

    stroke.recompute_bounds();
    const auto& bounds = stroke.bounding_box();
    TEST_ASSERT(bounds.min_x <= 10.0);
    TEST_ASSERT(bounds.min_y <= 20.0);
    TEST_ASSERT(bounds.max_x >= 50.0);
    TEST_ASSERT(bounds.max_y >= 80.0);
}

static void test_catmull_rom_interpolation() {
    std::vector<inkforge::ink::Point> pts = {
        inkforge::ink::Point(0.0, 0.0, 0.2f),
        inkforge::ink::Point(10.0, 20.0, 0.5f),
        inkforge::ink::Point(20.0, 15.0, 0.6f),
        inkforge::ink::Point(30.0, 30.0, 0.8f)
    };

    auto smoothed = inkforge::ink::SplineCurve::evaluate_catmull_rom(pts, 4);
    TEST_ASSERT(smoothed.size() > pts.size());
    TEST_ASSERT(smoothed.front().x == 0.0);
}

static void test_dynamic_width() {
    float w_low = inkforge::ink::InkEngine::compute_dynamic_width(4.0f, 0.1f, inkforge::ink::ToolType::Pen);
    float w_high = inkforge::ink::InkEngine::compute_dynamic_width(4.0f, 1.0f, inkforge::ink::ToolType::Pen);
    TEST_ASSERT(w_low < w_high);
}

namespace {
struct RegisterStrokeTests {
    RegisterStrokeTests() {
        inkforge::test::register_test("Stroke_BoundingBox", &test_stroke_bounds);
        inkforge::test::register_test("Stroke_CatmullRom", &test_catmull_rom_interpolation);
        inkforge::test::register_test("Stroke_DynamicWidth", &test_dynamic_width);
    }
} s_reg_stroke_tests;
}
