#include "TabletDeviceManager.hpp"

namespace inkforge::input {

TabletDeviceManager& TabletDeviceManager::instance() {
    static TabletDeviceManager s_instance;
    return s_instance;
}

void TabletDeviceManager::register_source(std::shared_ptr<ITabletInputSource> source) {
    active_source_ = std::move(source);
}

std::shared_ptr<ITabletInputSource> TabletDeviceManager::active_source() const noexcept {
    return active_source_;
}

std::string TabletDeviceManager::active_backend_name() const {
    if (active_source_) {
        return active_source_->backend_name();
    }
    return "None (Emulated Pointer)";
}

} // namespace inkforge::input
