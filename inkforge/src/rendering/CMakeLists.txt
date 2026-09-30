add_library(inkforge_rendering STATIC
    CanvasRenderer.cpp
)

target_include_directories(inkforge_rendering PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
)

target_link_libraries(inkforge_rendering PUBLIC
    inkforge_documents
    Qt6::Core
    Qt6::Gui
)
