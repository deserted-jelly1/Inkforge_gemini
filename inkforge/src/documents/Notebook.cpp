#include <inkforge/documents/Notebook.hpp>
#include <chrono>

namespace inkforge::documents {

Notebook::Notebook()
    : id_("notebook_default") {
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    const auto ts = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::seconds>(now).count());
    metadata_.created_at = ts;
    metadata_.updated_at = ts;
    add_page();
}

Notebook::Notebook(std::string id, std::string title)
    : id_(std::move(id)) {
    metadata_.title = std::move(title);
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    const auto ts = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::seconds>(now).count());
    metadata_.created_at = ts;
    metadata_.updated_at = ts;
    add_page();
}

PagePtr Notebook::active_page() const {
    if (pages_.empty()) {
        return nullptr;
    }
    const size_t safe_idx = std::min(active_page_index_, pages_.size() - 1);
    return pages_[safe_idx];
}

void Notebook::set_active_page_index(size_t index) {
    if (index < pages_.size()) {
        active_page_index_ = index;
    }
}

PagePtr Notebook::add_page() {
    const size_t new_idx = pages_.size();
    const std::string page_id = "page_" + std::to_string(new_idx + 1);
    auto page = std::make_shared<Page>(page_id, new_idx);
    pages_.push_back(page);
    active_page_index_ = new_idx;
    return page;
}

bool Notebook::remove_page(size_t index) {
    if (pages_.size() <= 1 || index >= pages_.size()) {
        return false;
    }
    pages_.erase(pages_.begin() + static_cast<ptrdiff_t>(index));
    for (size_t i = 0; i < pages_.size(); ++i) {
        pages_[i]->set_index(i);
    }
    if (active_page_index_ >= pages_.size()) {
        active_page_index_ = pages_.size() - 1;
    }
    return true;
}

size_t Notebook::total_stroke_count() const noexcept {
    size_t count = 0;
    for (const auto& p : pages_) {
        if (p) count += p->total_stroke_count();
    }
    return count;
}

} // namespace inkforge::documents
