add_library(inkforge_canvas STATIC
    CanvasWidget.cpp
)

target_include_directories(inkforge_canvas PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(inkforge_canvas PUBLIC
    inkforge_documents
    inkforge_rendering
    inkforge_input
    inkforge_commands
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
)
