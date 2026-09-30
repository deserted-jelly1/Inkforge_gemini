#pragma once

#include <memory>
#include <vector>
#include <functional>
#include <inkforge/core/Export.hpp>
#include <inkforge/documents/Notebook.hpp>

namespace inkforge::documents {

class INKFORGE_API DocumentModel {
public:
    using DocumentChangeCallback = std::function<void()>;

    DocumentModel();
    ~DocumentModel();

    void new_notebook(const std::string& title = "New Notebook");
    void set_notebook(NotebookPtr notebook);
    [[nodiscard]] NotebookPtr current_notebook() const noexcept { return current_notebook_; }

    void add_change_listener(DocumentChangeCallback cb);
    void notify_modified();

    [[nodiscard]] bool is_dirty() const noexcept { return is_dirty_; }
    void mark_clean() noexcept { is_dirty_ = false; }

private:
    NotebookPtr current_notebook_;
    bool is_dirty_{false};
    std::vector<DocumentChangeCallback> listeners_;
};

} // namespace inkforge::documents
