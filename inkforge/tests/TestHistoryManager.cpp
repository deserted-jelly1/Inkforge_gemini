#include <inkforge/commands/HistoryManager.hpp>
#include <inkforge/commands/StrokeCommands.hpp>
#include <inkforge/commands/CompoundCommand.hpp>
#include <inkforge/documents/Layer.hpp>
#include <inkforge/ink/Stroke.hpp>
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

static void test_history_basic_undo_redo() {
    inkforge::documents::Layer layer("l1", "Ink Layer");
    inkforge::commands::HistoryManager history(50);

    TEST_ASSERT(!history.can_undo());
    TEST_ASSERT(!history.can_redo());
    TEST_ASSERT(history.undo_count() == 0);

    auto s1 = std::make_shared<inkforge::ink::Stroke>("s1");
    s1->add_point(inkforge::ink::Point(10, 10));

    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s1));
    TEST_ASSERT(layer.strokes().size() == 1);
    TEST_ASSERT(history.can_undo());
    TEST_ASSERT(!history.can_redo());
    TEST_ASSERT(history.undo_count() == 1);

    // Test Undo
    bool undone = history.undo();
    TEST_ASSERT(undone);
    TEST_ASSERT(layer.strokes().empty());
    TEST_ASSERT(!history.can_undo());
    TEST_ASSERT(history.can_redo());
    TEST_ASSERT(history.redo_count() == 1);

    // Test Redo
    bool redone = history.redo();
    TEST_ASSERT(redone);
    TEST_ASSERT(layer.strokes().size() == 1);
    TEST_ASSERT(history.can_undo());
    TEST_ASSERT(!history.can_redo());
}

static void test_history_batch_erase_and_clear() {
    inkforge::documents::Layer layer("l1", "Ink Layer");
    inkforge::commands::HistoryManager history;

    auto s1 = std::make_shared<inkforge::ink::Stroke>("s1");
    auto s2 = std::make_shared<inkforge::ink::Stroke>("s2");
    auto s3 = std::make_shared<inkforge::ink::Stroke>("s3");

    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s1));
    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s2));
    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s3));
    TEST_ASSERT(layer.strokes().size() == 3);

    // Batch erase s1 and s2 in a single command
    std::vector<inkforge::ink::StrokePtr> to_erase = {s1, s2};
    history.execute_command(std::make_unique<inkforge::commands::BatchRemoveStrokesCommand>(&layer, to_erase));
    TEST_ASSERT(layer.strokes().size() == 1);
    TEST_ASSERT(layer.strokes()[0]->id() == "s3");

    // Undo batch erase
    history.undo();
    TEST_ASSERT(layer.strokes().size() == 3);

    // Test ClearLayerCommand
    history.execute_command(std::make_unique<inkforge::commands::ClearLayerCommand>(&layer));
    TEST_ASSERT(layer.strokes().empty());

    // Undo Clear
    history.undo();
    TEST_ASSERT(layer.strokes().size() == 3);
}

static void test_history_macros_and_time_travel() {
    inkforge::documents::Layer layer("l1", "Ink Layer");
    inkforge::commands::HistoryManager history;

    // Macro operation
    history.begin_macro("Draw Signature");
    auto s1 = std::make_shared<inkforge::ink::Stroke>("s1");
    auto s2 = std::make_shared<inkforge::ink::Stroke>("s2");
    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s1));
    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s2));
    history.end_macro();

    // Despite 2 strokes, it's 1 undo step!
    TEST_ASSERT(history.undo_count() == 1);
    TEST_ASSERT(layer.strokes().size() == 2);

    history.undo();
    TEST_ASSERT(layer.strokes().empty());

    history.redo();
    TEST_ASSERT(layer.strokes().size() == 2);

    // Time travel jump
    auto s3 = std::make_shared<inkforge::ink::Stroke>("s3");
    history.execute_command(std::make_unique<inkforge::commands::AddStrokeCommand>(&layer, s3));
    TEST_ASSERT(history.undo_count() == 2);

    history.jump_to_step(0); // Jump to beginning
    TEST_ASSERT(layer.strokes().empty());

    history.jump_to_step(2); // Jump back to latest
    TEST_ASSERT(layer.strokes().size() == 3);
}

namespace {
struct RegisterHistoryTests {
    RegisterHistoryTests() {
        inkforge::test::register_test("History_BasicUndoRedo", &test_history_basic_undo_redo);
        inkforge::test::register_test("History_BatchEraseAndClear", &test_history_batch_erase_and_clear);
        inkforge::test::register_test("History_MacrosAndTimeTravel", &test_history_macros_and_time_travel);
    }
} s_reg_history_tests;
}
