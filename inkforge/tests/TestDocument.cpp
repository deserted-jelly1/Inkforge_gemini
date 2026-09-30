#include <inkforge/documents/Notebook.hpp>
#include <inkforge/documents/DocumentModel.hpp>
#include <inkforge/commands/CommandStack.hpp>
#include <inkforge/commands/StrokeCommands.hpp>
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

static void test_notebook_pages() {
    inkforge::documents::Notebook nb("nb1", "Research Notes");
    TEST_ASSERT(nb.page_count() == 1);

    auto page2 = nb.add_page();
    TEST_ASSERT(nb.page_count() == 2);
    TEST_ASSERT(page2 != nullptr);
    TEST_ASSERT(nb.active_page_index() == 1);
}

static void test_command_undo_redo() {
    auto nb = std::make_shared<inkforge::documents::Notebook>("nb1", "Math");
    auto page = nb->active_page();
    auto layer = page->active_layer();
    TEST_ASSERT(layer->strokes().empty());

    inkforge::commands::CommandStack stack;
    auto s1 = std::make_shared<inkforge::ink::Stroke>("s1");
    s1->add_point(inkforge::ink::Point(5, 5));

    stack.push_and_execute(std::make_unique<inkforge::commands::AddStrokeCommand>(layer, s1));
    TEST_ASSERT(layer->strokes().size() == 1);
    TEST_ASSERT(stack.can_undo());
    TEST_ASSERT(!stack.can_redo());

    stack.undo();
    TEST_ASSERT(layer->strokes().empty());
    TEST_ASSERT(!stack.can_undo());
    TEST_ASSERT(stack.can_redo());

    stack.redo();
    TEST_ASSERT(layer->strokes().size() == 1);
}

namespace {
struct RegisterDocTests {
    RegisterDocTests() {
        inkforge::test::register_test("Document_NotebookPages", &test_notebook_pages);
        inkforge::test::register_test("Command_UndoRedo", &test_command_undo_redo);
    }
} s_reg_doc_tests;
}
