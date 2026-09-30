#pragma once

#include <QMainWindow>
#include <QToolBar>
#include <QAction>
#include <QLabel>
#include <QComboBox>
#include <memory>
#include <inkforge/documents/DocumentModel.hpp>
#include <inkforge/commands/HistoryManager.hpp>
#include <inkforge/storage/SQLiteStorage.hpp>
#include <inkforge/canvas/CanvasWidget.hpp>

namespace inkforge::app {

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow() override;

private slots:
    void on_tool_pen_selected();
    void on_tool_highlighter_selected();
    void on_tool_eraser_selected();
    void on_undo();
    void on_redo();
    void on_new_notebook();
    void on_add_page();
    void on_page_selected(int index);
    void on_reset_zoom();
    void on_zoom_updated(double zoom);
    void on_diagnostics_updated(double x, double y, float pressure, int point_count);

private:
    void setup_ui();
    void setup_menus();
    void setup_toolbar();
    void setup_statusbar();
    void sync_page_selector();

    std::shared_ptr<documents::DocumentModel> doc_model_;
    std::shared_ptr<commands::HistoryManager> history_manager_;
    std::shared_ptr<storage::SQLiteStorage> storage_;

    canvas::CanvasWidget* canvas_widget_{nullptr};

    // Actions
    QAction* action_undo_{nullptr};
    QAction* action_redo_{nullptr};
    QAction* action_pen_{nullptr};
    QAction* action_highlighter_{nullptr};
    QAction* action_eraser_{nullptr};

    // UI elements
    QComboBox* page_combo_{nullptr};
    QLabel* status_zoom_label_{nullptr};
    QLabel* status_diagnostics_label_{nullptr};
    QLabel* status_storage_label_{nullptr};
    QLabel* status_history_label_{nullptr};
};

} // namespace inkforge::app
