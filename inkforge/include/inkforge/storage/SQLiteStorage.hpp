#pragma once

#include <memory>
#include <QSqlDatabase>
#include <inkforge/core/Export.hpp>
#include <inkforge/storage/IDatabase.hpp>

namespace inkforge::storage {

class INKFORGE_API SQLiteStorage : public IDatabase {
public:
    SQLiteStorage();
    ~SQLiteStorage() override;

    StorageResult initialize(const StorageConfig& config) override;
    StorageResult save_notebook(const documents::Notebook& notebook) override;
    StorageResult load_notebook(const std::string& notebook_id, documents::Notebook& out_notebook) override;
    StorageResult list_notebooks(std::vector<documents::NotebookMetadata>& out_list) override;
    StorageResult delete_notebook(const std::string& notebook_id) override;

    [[nodiscard]] bool is_connected() const noexcept;

private:
    StorageResult run_migrations();
    StorageConfig config_;
    std::string connection_name_{"inkforge_sqlite_conn"};
};

} // namespace inkforge::storage
