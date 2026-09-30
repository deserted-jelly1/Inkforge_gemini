#include <QApplication>
#include "MainWindow.hpp"
#include <inkforge/input/QtTabletFilter.hpp>
#include <inkforge/input/TabletDeviceManager.hpp>

int main(int argc, char* argv[]) {
    // Enable high-DPI canvas scaling
    QApplication::setHighDpiScaleFactorRoundingPolicy(
        Qt::HighDpiScaleFactorRoundingPolicy::PassThrough
    );

    QApplication app(argc, argv);
    app.setApplicationName("InkForge");
    app.setApplicationVersion("0.1.0");
    app.setOrganizationName("InkForgeLab");

    // Install global tablet event hook
    auto tablet_filter = std::make_shared<inkforge::input::QtTabletFilter>();
    inkforge::input::TabletDeviceManager::instance().register_source(tablet_filter);

    inkforge::app::MainWindow main_window;
    main_window.show();

    return app.exec();
}
