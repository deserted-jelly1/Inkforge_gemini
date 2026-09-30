#pragma once

#include <string>
#include <vector>
#include <memory>
#include <cstdint>
#include <inkforge/core/Export.hpp>
#include <inkforge/documents/Page.hpp>

namespace inkforge::documents {

struct NotebookMetadata {
    std::string title{"Untitled Notebook"};
    std::string subject{"General Notes"};
    std::vector<std::string> tags;
    uint64_t created_at{0};
    uint64_t updated_at{0};
};

class INKFORGE_API Notebook {
public:
    Notebook();
    explicit Notebook(std::string id, std::string title = "Untitled Notebook");

    [[nodiscard]] const std::string& id() const noexcept { return id_; }
    [[nodiscard]] const NotebookMetadata& metadata() const noexcept { return metadata_; }
    [[nodiscard]] NotebookMetadata& metadata() noexcept { return metadata_; }

    [[nodiscard]] const std::vector<PagePtr>& pages() const noexcept { return pages_; }
    [[nodiscard]] size_t page_count() const noexcept { return pages_.size(); }

    [[nodiscard]] PagePtr active_page() const;
    [[nodiscard]] size_t active_page_index() const noexcept { return active_page_index_; }
    void set_active_page_index(size_t index);

    PagePtr add_page();
    bool remove_page(size_t index);

    [[nodiscard]] size_t total_stroke_count() const noexcept;

private:
    std::string id_;
    NotebookMetadata metadata_;
    std::vector<PagePtr> pages_;
    size_t active_page_index_{0};
};

using NotebookPtr = std::shared_ptr<Notebook>;

} // namespace inkforge::documents
