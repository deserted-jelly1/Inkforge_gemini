#include "MainWindow.hpp"
#include <QMenuBar>
#include <QStatusBar>
#include <QMessageBox>
#include <QKeySequence>

namespace inkforge::app {

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent) {
    setWindowTitle("InkForge — AI-Enhanced Handwriting Notebook (v0.1.0)");
    resize(1280, 800);

    doc_model_ = std::make_shared<documents::DocumentModel>();
    history_manager_ = std::make_shared<commands::HistoryManager>(120);
    storage_ = std::make_shared<storage::SQLiteStorage>();

    // Initialize local SQLite library
    storage::StorageConfig config;
    config.root_directory = "./inkforge_data";
    config.database_file = "notebooks.sqlite";
    storage_->initialize(config);

    setup_ui();
    setup_menus();
    setup_toolbar();
    setup_statusbar();

    history_manager_->set_state_callback([this](const commands::HistoryState& state) {
        if (action_undo_) action_undo_->setEnabled(state.can_undo);
        if (action_redo_) action_redo_->setEnabled(state.can_redo);
        if (status_history_label_) {
            status_history_label_->setText(
                QString("History: %1 undo / %2 redo").arg(state.undo_count).arg(state.redo_count)
            );
        }
    });

    sync_page_selector();
}

MainWindow::~MainWindow() = default;

void MainWindow::setup_ui() {
    canvas_widget_ = new canvas::CanvasWidget(doc_model_, history_manager_, this);
    setCentralWidget(canvas_widget_);

    connect(canvas_widget_, &canvas::CanvasWidget::zoom_changed,
            this, &MainWindow::on_zoom_updated);
    connect(canvas_widget_, &canvas::CanvasWidget::pointer_diagnostics,
            this, &MainWindow::on_diagnostics_updated);
}

void MainWindow::setup_menus() {
    auto file_menu = menuBar()->addMenu("&File");
    file_menu->addAction("&New Notebook", this, &MainWindow::on_new_notebook, QKeySequence::New);
    file_menu->addAction("&Add Page", this, &MainWindow::on_add_page, QKeySequence("Ctrl+Shift+N"));
    file_menu->addSeparator();
    file_menu->addAction("E&xit", this, &QWidget::close, QKeySequence::Quit);

    auto edit_menu = menuBar()->addMenu("&Edit");
    action_undo_ = edit_menu->addAction("&Undo", this, &MainWindow::on_undo, QKeySequence::Undo);
    action_redo_ = edit_menu->addAction("&Redo", this, &MainWindow::on_redo, QKeySequence::Redo);
    action_undo_->setEnabled(false);
    action_redo_->setEnabled(false);

    auto view_menu = menuBar()->addMenu("&View");
    view_menu->addAction("&Reset Zoom (100%)", this, &MainWindow::on_reset_zoom, QKeySequence("Ctrl+0"));
}

void MainWindow::setup_toolbar() {
    auto toolbar = addToolBar("Main Toolbar");
    toolbar->setMovable(false);

    action_pen_ = toolbar->addAction("Pen", this, &MainWindow::on_tool_pen_selected);
    action_pen_->setCheckable(true);
    action_pen_->setChecked(true);

    action_highlighter_ = toolbar->addAction("Highlighter", this, &MainWindow::on_tool_highlighter_selected);
    action_highlighter_->setCheckable(true);

    action_eraser_ = toolbar->addAction("Eraser", this, &MainWindow::on_tool_eraser_selected);
    action_eraser_->setCheckable(true);

    toolbar->addSeparator();

    page_combo_ = new QComboBox(toolbar);
    connect(page_combo_, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &MainWindow::on_page_selected);
    toolbar->addWidget(page_combo_);

    toolbar->addAction("+ Page", this, &MainWindow::on_add_page);
}

void MainWindow::setup_statusbar() {
    status_zoom_label_ = new QLabel("Zoom: 100%", this);
    status_diagnostics_label_ = new QLabel("Digitizer: Ready", this);
    status_history_label_ = new QLabel("History: 0 undo / 0 redo", this);
    status_storage_label_ = new QLabel("SQLite: Connected (WAL)", this);

    statusBar()->addPermanentWidget(status_storage_label_);
    statusBar()->addPermanentWidget(status_history_label_);
    statusBar()->addPermanentWidget(status_diagnostics_label_);
    statusBar()->addPermanentWidget(status_zoom_label_);
}

void MainWindow::on_tool_pen_selected() {
    action_pen_->setChecked(true);
    action_highlighter_->setChecked(false);
    action_eraser_->setChecked(false);
    canvas_widget_->set_active_tool(ink::ToolType::Pen);
    canvas_widget_->set_stroke_color(core::ColorRgba(15, 23, 42, 255));
    canvas_widget_->set_stroke_width(2.5f);
}

void MainWindow::on_tool_highlighter_selected() {
    action_pen_->setChecked(false);
    action_highlighter_->setChecked(true);
    action_eraser_->setChecked(false);
    canvas_widget_->set_active_tool(ink::ToolType::Highlighter);
    canvas_widget_->set_stroke_color(core::ColorRgba(250, 204, 21, 140));
    canvas_widget_->set_stroke_width(14.0f);
}

void MainWindow::on_tool_eraser_selected() {
    action_pen_->setChecked(false);
    action_highlighter_->setChecked(false);
    action_eraser_->setChecked(true);
    canvas_widget_->set_active_tool(ink::ToolType::Eraser);
}

void MainWindow::on_undo() {
    if (history_manager_) {
        history_manager_->undo();
        canvas_widget_->update();
    }
}

void MainWindow::on_redo() {
    if (history_manager_) {
        history_manager_->redo();
        canvas_widget_->update();
    }
}

void MainWindow::on_new_notebook() {
    doc_model_->new_notebook("Untitled Notebook");
    if (history_manager_) {
        history_manager_->clear();
    }
    sync_page_selector();
    canvas_widget_->update();
}

void MainWindow::on_add_page() {
    auto notebook = doc_model_->current_notebook();
    if (notebook) {
        notebook->add_page();
        sync_page_selector();
        canvas_widget_->update();
    }
}

void MainWindow::on_page_selected(int index) {
    auto notebook = doc_model_->current_notebook();
    if (notebook && index >= 0 && static_cast<size_t>(index) < notebook->page_count()) {
        notebook->set_active_page_index(static_cast<size_t>(index));
        canvas_widget_->update();
    }
}

void MainWindow::on_reset_zoom() {
    canvas_widget_->reset_viewport();
}

void MainWindow::on_zoom_updated(double zoom) {
    if (status_zoom_label_) {
        status_zoom_label_->setText(QString("Zoom: %1%").arg(static_cast<int>(zoom * 100.0)));
    }
}

void MainWindow::on_diagnostics_updated(double x, double y, float pressure, int point_count) {
    if (status_diagnostics_label_) {
        status_diagnostics_label_->setText(
            QString("Pos: (%1, %2) | Pressure: %3 | Pts: %4")
                .arg(static_cast<int>(x))
                .arg(static_cast<int>(y))
                .arg(QString::number(pressure, 'f', 2))
                .arg(point_count)
        );
    }
}

void MainWindow::sync_page_selector() {
    if (!page_combo_ || !doc_model_) return;

    page_combo_->blockSignals(true);
    page_combo_->clear();

    auto notebook = doc_model_->current_notebook();
    if (notebook) {
        for (size_t i = 0; i < notebook->page_count(); ++i) {
            page_combo_->addItem(QString("Page %1").arg(i + 1));
        }
        page_combo_->setCurrentIndex(static_cast<int>(notebook->active_page_index()));
    }
    page_combo_->blockSignals(false);
}

} // namespace inkforge::app
