#pragma once

#include <cstdint>

namespace inkforge::input {

enum class PointerDeviceType : uint8_t {
    Stylus = 0,
    EraserTip = 1,
    Mouse = 2,
    Touch = 3
};

enum class PointerButtonState : uint8_t {
    None = 0,
    TipDown = 1 << 0,
    BarrelButton1 = 1 << 1,
    BarrelButton2 = 1 << 2,
    InvertEraser = 1 << 3
};

constexpr PointerButtonState operator|(PointerButtonState a, PointerButtonState b) noexcept {
    return static_cast<PointerButtonState>(static_cast<uint8_t>(a) | static_cast<uint8_t>(b));
}

constexpr bool has_flag(PointerButtonState val, PointerButtonState flag) noexcept {
    return (static_cast<uint8_t>(val) & static_cast<uint8_t>(flag)) != 0;
}

} // namespace inkforge::input
