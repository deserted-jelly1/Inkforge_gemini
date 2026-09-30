#pragma once

#include <memory>
#include <string>
#include <inkforge/core/Export.hpp>
#include <inkforge/input/ITabletInputSource.hpp>

namespace inkforge::input {

class INKFORGE_API TabletDeviceManager {
public:
    static TabletDeviceManager& instance();

    void register_source(std::shared_ptr<ITabletInputSource> source);
    [[nodiscard]] std::shared_ptr<ITabletInputSource> active_source() const noexcept;
    [[nodiscard]] std::string active_backend_name() const;

private:
    TabletDeviceManager() = default;
    std::shared_ptr<ITabletInputSource> active_source_;
};

} // namespace inkforge::input
