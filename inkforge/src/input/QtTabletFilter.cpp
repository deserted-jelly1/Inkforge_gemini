#include "QtTabletFilter.hpp"
#include <chrono>

namespace inkforge::input {

QtTabletFilter::QtTabletFilter(QObject* parent)
    : QObject(parent) {}

void QtTabletFilter::start_listening(EventCallback callback) {
    callback_ = std::move(callback);
    is_active_ = true;
}

void QtTabletFilter::stop_listening() {
    callback_ = nullptr;
    is_active_ = false;
}

bool QtTabletFilter::eventFilter(QObject* /*watched*/, QEvent* event) {
    if (!is_active_ || !callback_) {
        return false;
    }

    switch (event->type()) {
        case QEvent::TabletPress:
            process_tablet_event(static_cast<const QTabletEvent*>(event), TabletEventType::Down);
            return true;
        case QEvent::TabletMove:
            process_tablet_event(static_cast<const QTabletEvent*>(event), TabletEventType::Move);
            return true;
        case QEvent::TabletRelease:
            process_tablet_event(static_cast<const QTabletEvent*>(event), TabletEventType::Up);
            return true;
        default:
            break;
    }
    return false;
}

void QtTabletFilter::process_tablet_event(const QTabletEvent* te, TabletEventType type) {
    TabletInputEvent evt;
    evt.type = type;

    // Detect stylus tip vs eraser end
    if (te->pointerType() == QPointingDevice::PointerType::Eraser) {
        evt.device = PointerDeviceType::EraserTip;
    } else {
        evt.device = PointerDeviceType::Stylus;
    }

    evt.screen_pos = {te->position().x(), te->position().y()};
    evt.pressure = static_cast<float>(te->pressure());
    evt.tilt_x = static_cast<float>(te->xTilt());
    evt.tilt_y = static_cast<float>(te->yTilt());

    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    evt.timestamp_us = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());

    callback_(evt);
}

} // namespace inkforge::input
