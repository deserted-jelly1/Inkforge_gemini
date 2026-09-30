add_library(inkforge_input STATIC
    QtTabletFilter.cpp
    TabletDeviceManager.cpp
)

target_include_directories(inkforge_input PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(inkforge_input PUBLIC
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
)
