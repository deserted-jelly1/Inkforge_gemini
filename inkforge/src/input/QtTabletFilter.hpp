#pragma once

#include <QObject>
#include <QEvent>
#include <QTabletEvent>
#include <functional>
#include <inkforge/input/ITabletInputSource.hpp>

namespace inkforge::input {

class QtTabletFilter : public QObject, public ITabletInputSource {
    Q_OBJECT
public:
    explicit QtTabletFilter(QObject* parent = nullptr);
    ~QtTabletFilter() override = default;

    void start_listening(EventCallback callback) override;
    void stop_listening() override;
    [[nodiscard]] bool is_active() const override { return is_active_; }
    [[nodiscard]] const char* backend_name() const noexcept override { return "Qt6_Tablet_WinTab_Ink"; }

protected:
    bool eventFilter(QObject* watched, QEvent* event) override;

private:
    void process_tablet_event(const QTabletEvent* tablet_event, TabletEventType type);

    EventCallback callback_;
    bool is_active_{false};
};

} // namespace inkforge::input
