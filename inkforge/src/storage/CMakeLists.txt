add_library(inkforge_storage STATIC
    SQLiteStorage.cpp
)

target_include_directories(inkforge_storage PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
)

target_link_libraries(inkforge_storage PUBLIC
    inkforge_documents
    Qt6::Core
    Qt6::Sql
)
