add_library(inkforge_documents STATIC
    Layer.cpp
    Page.cpp
    Notebook.cpp
    DocumentModel.cpp
)

target_include_directories(inkforge_documents PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
)

target_link_libraries(inkforge_documents PUBLIC
    inkforge_ink
)
