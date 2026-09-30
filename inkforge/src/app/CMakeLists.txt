add_executable(inkforge_app
    main.cpp
    MainWindow.cpp
)

target_include_directories(inkforge_app PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(inkforge_app PRIVATE
    inkforge_canvas
    inkforge_documents
    inkforge_rendering
    inkforge_commands
    inkforge_storage
    inkforge_input
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
)

if(WIN32)
    # Target Windows desktop GUI subsystem
    set_target_properties(inkforge_app PROPERTIES
        WIN32_EXECUTABLE TRUE
    )
endif()
