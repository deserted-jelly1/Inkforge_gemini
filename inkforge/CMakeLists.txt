cmake_minimum_required(VERSION 3.24)

project(InkForge
    VERSION 0.1.0
    DESCRIPTION "AI-Enhanced Local-First Digital Handwriting Notebook"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Export compile commands for clangd / language servers
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Configure build options
option(INKFORGE_BUILD_TESTS "Build unit test suite" ON)
option(INKFORGE_ENABLE_WARNINGS_AS_ERRORS "Treat compiler warnings as errors" OFF)

# Platform detection
if(WIN32)
    add_compile_definitions(INKFORGE_PLATFORM_WINDOWS)
    # Enable UTF-8 encoding on MSVC
    if(MSVC)
        add_compile_options(/utf-8 /permissive- /Zc:__cplusplus /W4)
        if(INKFORGE_ENABLE_WARNINGS_AS_ERRORS)
            add_compile_options(/WX)
        endif()
    endif()
elseif(UNIX AND NOT APPLE)
    add_compile_definitions(INKFORGE_PLATFORM_LINUX)
    add_compile_options(-Wall -Wextra -Wpedantic)
    if(INKFORGE_ENABLE_WARNINGS_AS_ERRORS)
        add_compile_options(-Werror)
    endif()
endif()

# Find Qt 6 packages
find_package(Qt6 6.5 REQUIRED COMPONENTS
    Core
    Gui
    Widgets
    Sql
)

# Standard automoc/autouic/autorcc for Qt
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

# Global include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Core library targets and app
add_subdirectory(src)

# Tests
if(INKFORGE_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()
