# InkForge — Build and Compilation Guide

This document describes how to configure, compile, test, and run InkForge on Windows and Linux systems.

---

## 1. System Requirements

### Hardware
- **Processor**: x86_64 architecture (Intel Core i5/i7/i9 8th gen+ or AMD Ryzen 3000+)
- **Memory**: Minimum 8 GB RAM (16 GB recommended for building with Qt 6)
- **Tablet**: Wacom Intuos, Cintiq, or any Windows Ink / libinput compatible digitizer

### Software Toolchains
- **CMake**: >= 3.24
- **C++ Compiler**:
  - Windows: Visual Studio 2022 (MSVC 19.34+ or newer)
  - Linux: GCC 13.0+ or Clang 17.0+ with full C++20 support
- **Qt 6 Framework**: Qt 6.5.0 LTS or newer (Qt 6.7.x recommended)
  - Components: `Qt6Core`, `Qt6Gui`, `Qt6Widgets`, `Qt6Sql`
  - Optional for Linux: `Qt6WaylandClient` if running under native Wayland

---

## 2. Windows Build Instructions

### A. Install Qt 6 via Qt Online Installer
Install Qt 6.7.x for `MSVC 2022 64-bit`. Note the installation path (typically `C:\Qt\6.7.2\msvc2022_64`).

### B. Configure and Compile using CMake & Ninja (Recommended)
Open **x64 Native Tools Command Prompt for VS 2022** and execute:

```powershell
# Clone or navigate to the repository
cd inkforge

# Configure with CMake
cmake -B build -S . -G "Ninja" `
    -DCMAKE_BUILD_TYPE=Release `
    -DCMAKE_PREFIX_PATH="C:\Qt\6.7.2\msvc2022_64" `
    -DINKFORGE_BUILD_TESTS=ON

# Build the application
cmake --build build --config Release

# Run automated tests
ctest --test-dir build --output-on-failure

# Launch the executable
.\build\src\app\inkforge_app.exe
```

### C. Visual Studio IDE Workflow
1. Open Visual Studio 2022.
2. Select **File > Open > Folder...** and choose the `inkforge` directory.
3. In `CMakeSettings.json` or CMakePresets, set `CMAKE_PREFIX_PATH` to your Qt 6 MSVC directory.
4. Select target `inkforge_app.exe` and press **F5** to build and debug.

---

## 3. Linux Build Instructions (Ubuntu / Debian / Fedora)

### A. Install Dependencies
```bash
# Ubuntu 24.04+
sudo apt update
sudo apt install -y build-essential cmake ninja-build git \
    qt6-base-dev qt6-base-dev-tools libgl1-mesa-dev libxkbcommon-dev
```

### B. Build and Test
```bash
cd inkforge
cmake -B build -S . -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DINKFORGE_BUILD_TESTS=ON

cmake --build build
ctest --test-dir build --output-on-failure
./build/src/app/inkforge_app
```

---

## 4. CMake Options Summary

| Option | Default | Description |
| :--- | :--- | :--- |
| `INKFORGE_BUILD_TESTS` | `ON` | Builds the Catch2/CTest automated unit test suite |
| `INKFORGE_ENABLE_WARNINGS_AS_ERRORS` | `OFF` | Treats all compiler warnings as fatal errors |
| `CMAKE_BUILD_TYPE` | `Release` | `Debug`, `Release`, or `RelWithDebInfo` |
