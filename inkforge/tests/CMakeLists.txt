add_executable(inkforge_tests
    TestMain.cpp
    TestStroke.cpp
    TestDocument.cpp
    TestHistoryManager.cpp
)

target_include_directories(inkforge_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

target_link_libraries(inkforge_tests PRIVATE
    inkforge_ink
    inkforge_documents
    inkforge_commands
    Qt6::Core
    Qt6::Gui
    Qt6::Sql
)

add_test(NAME InkForgeUnitTests COMMAND inkforge_tests)
