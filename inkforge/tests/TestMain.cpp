#include <iostream>
#include <vector>
#include <string>
#include <functional>

// Lightweight modern test framework without external dependencies
namespace inkforge::test {

struct TestCase {
    std::string name;
    std::function<void()> func;
};

inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> s_tests;
    return s_tests;
}

inline void register_test(std::string name, std::function<void()> func) {
    registry().push_back({std::move(name), std::move(func)});
}

} // namespace inkforge::test

#define INKFORGE_TEST(name) \
    static void test_func_##name(); \
    namespace { \
        struct Reg_##name { \
            Reg_##name() { ::inkforge::test::register_test(#name, &test_func_##name); } \
        } s_reg_##name; \
    } \
    static void test_func_##name()

#define TEST_ASSERT(expr) \
    do { \
        if (!(expr)) { \
            std::cerr << "Assertion failed: " #expr " at " << __FILE__ << ":" << __LINE__ << "\n"; \
            std::exit(1); \
        } \
    } while (0)

int main() {
    std::cout << "Running InkForge Unit Test Suite...\n";
    int passed = 0;
    for (const auto& test : inkforge::test::registry()) {
        std::cout << " [RUN]  " << test.name << " ... ";
        test.func();
        std::cout << "PASSED\n";
        passed++;
    }
    std::cout << "All " << passed << " tests passed successfully!\n";
    return 0;
}
