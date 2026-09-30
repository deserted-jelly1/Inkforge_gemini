#include <inkforge/documents/DocumentModel.hpp>

namespace inkforge::documents {

DocumentModel::DocumentModel() {
    new_notebook("Quick Notes");
}

DocumentModel::~DocumentModel() = default;

void DocumentModel::new_notebook(const std::string& title) {
    current_notebook_ = std::make_shared<Notebook>("nb_initial", title);
    is_dirty_ = false;
    notify_modified();
}

void DocumentModel::set_notebook(NotebookPtr notebook) {
    current_notebook_ = std::move(notebook);
    is_dirty_ = false;
    notify_modified();
}

void DocumentModel::add_change_listener(DocumentChangeCallback cb) {
    listeners_.push_back(std::move(cb));
}

void DocumentModel::notify_modified() {
    is_dirty_ = true;
    for (const auto& listener : listeners_) {
        if (listener) {
            listener();
        }
    }
}

} // namespace inkforge::documents
