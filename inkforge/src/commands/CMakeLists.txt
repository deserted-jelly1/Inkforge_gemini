add_library(inkforge_commands STATIC
    CommandStack.cpp
    CompoundCommand.cpp
    HistoryManager.cpp
    StrokeCommands.cpp
)

target_include_directories(inkforge_commands PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
)

target_link_libraries(inkforge_commands PUBLIC
    inkforge_documents
)
