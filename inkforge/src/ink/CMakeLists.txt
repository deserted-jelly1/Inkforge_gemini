add_library(inkforge_ink STATIC
    Stroke.cpp
    SplineCurve.cpp
    InkEngine.cpp
)

target_include_directories(inkforge_ink PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../include
)
