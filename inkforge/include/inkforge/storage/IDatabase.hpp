#pragma once

#include <string>
#include <vector>
#include <memory>
#include <inkforge/core/Export.hpp>
#include <inkforge/documents/Notebook.hpp>
#include <inkforge/storage/StorageTypes.hpp>

namespace inkforge::storage {

class INKFORGE_API IDatabase {
public:
    virtual ~IDatabase() = default;

    virtual StorageResult initialize(const StorageConfig& config) = 0;
    virtual StorageResult save_notebook(const documents::Notebook& notebook) = 0;
    virtual StorageResult load_notebook(const std::string& notebook_id, documents::Notebook& out_notebook) = 0;
    virtual StorageResult list_notebooks(std::vector<documents::NotebookMetadata>& out_list) = 0;
    virtual StorageResult delete_notebook(const std::string& notebook_id) = 0;
};

} // namespace inkforge::storage
