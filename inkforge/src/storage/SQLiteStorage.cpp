#include <inkforge/storage/SQLiteStorage.hpp>
#include <QSqlQuery>
#include <QSqlError>
#include <QVariant>
#include <QDir>
#include <chrono>

namespace inkforge::storage {

SQLiteStorage::SQLiteStorage() = default;

SQLiteStorage::~SQLiteStorage() {
    if (QSqlDatabase::contains(QString::fromStdString(connection_name_))) {
        QSqlDatabase::removeDatabase(QString::fromStdString(connection_name_));
    }
}

StorageResult SQLiteStorage::initialize(const StorageConfig& config) {
    config_ = config;

    QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", QString::fromStdString(connection_name_));
    QString db_path = QString::fromStdString(config_.database_file);
    if (!config_.root_directory.empty()) {
        QDir dir(QString::fromStdString(config_.root_directory));
        if (!dir.exists()) {
            dir.mkpath(".");
        }
        db_path = dir.filePath(QString::fromStdString(config_.database_file));
    }

    db.setDatabaseName(db_path);
    if (!db.open()) {
        return StorageResult::DatabaseError;
    }

    if (config_.enable_wal_mode) {
        QSqlQuery wal_query(db);
        wal_query.exec("PRAGMA journal_mode = WAL;");
        wal_query.exec("PRAGMA synchronous = NORMAL;");
    }

    return run_migrations();
}

StorageResult SQLiteStorage::run_migrations() {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    if (!db.isOpen()) {
        return StorageResult::DatabaseError;
    }

    QSqlQuery q(db);
    const QString create_notebooks =
        "CREATE TABLE IF NOT EXISTS notebooks ("
        "  id TEXT PRIMARY KEY,"
        "  title TEXT NOT NULL,"
        "  created_at INTEGER NOT NULL,"
        "  updated_at INTEGER NOT NULL,"
        "  subject TEXT,"
        "  tags TEXT"
        ");";

    if (!q.exec(create_notebooks)) {
        return StorageResult::DatabaseError;
    }

    const QString create_pages =
        "CREATE TABLE IF NOT EXISTS pages ("
        "  id TEXT PRIMARY KEY,"
        "  notebook_id TEXT NOT NULL,"
        "  page_index INTEGER NOT NULL,"
        "  bg_pattern INTEGER DEFAULT 3,"
        "  grid_spacing REAL DEFAULT 24.0,"
        "  created_at INTEGER NOT NULL,"
        "  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE"
        ");";

    if (!q.exec(create_pages)) {
        return StorageResult::DatabaseError;
    }

    const QString create_layers =
        "CREATE TABLE IF NOT EXISTS layers ("
        "  id TEXT PRIMARY KEY,"
        "  page_id TEXT NOT NULL,"
        "  name TEXT NOT NULL,"
        "  is_visible INTEGER DEFAULT 1,"
        "  is_locked INTEGER DEFAULT 0,"
        "  opacity REAL DEFAULT 1.0,"
        "  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE"
        ");";

    if (!q.exec(create_layers)) {
        return StorageResult::DatabaseError;
    }

    return StorageResult::Success;
}

StorageResult SQLiteStorage::save_notebook(const documents::Notebook& notebook) {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    if (!db.isOpen()) return StorageResult::DatabaseError;

    db.transaction();

    QSqlQuery q(db);
    q.prepare("INSERT OR REPLACE INTO notebooks (id, title, created_at, updated_at, subject) "
              "VALUES (:id, :title, :created_at, :updated_at, :subject);");
    q.bindValue(":id", QString::fromStdString(notebook.id()));
    q.bindValue(":title", QString::fromStdString(notebook.metadata().title));
    q.bindValue(":created_at", static_cast<qulonglong>(notebook.metadata().created_at));
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    const auto now_sec = static_cast<qulonglong>(std::chrono::duration_cast<std::chrono::seconds>(now).count());
    q.bindValue(":updated_at", now_sec);
    q.bindValue(":subject", QString::fromStdString(notebook.metadata().subject));

    if (!q.exec()) {
        db.rollback();
        return StorageResult::DatabaseError;
    }

    db.commit();
    return StorageResult::Success;
}

StorageResult SQLiteStorage::load_notebook(const std::string& notebook_id, documents::Notebook& out_notebook) {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    if (!db.isOpen()) return StorageResult::DatabaseError;

    QSqlQuery q(db);
    q.prepare("SELECT title, subject, created_at, updated_at FROM notebooks WHERE id = :id;");
    q.bindValue(":id", QString::fromStdString(notebook_id));

    if (!q.exec() || !q.next()) {
        return StorageResult::FileNotFound;
    }

    const std::string title = q.value(0).toString().toStdString();
    out_notebook = documents::Notebook(notebook_id, title);
    out_notebook.metadata().subject = q.value(1).toString().toStdString();
    out_notebook.metadata().created_at = q.value(2).toULongLong();
    out_notebook.metadata().updated_at = q.value(3).toULongLong();

    return StorageResult::Success;
}

StorageResult SQLiteStorage::list_notebooks(std::vector<documents::NotebookMetadata>& out_list) {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    if (!db.isOpen()) return StorageResult::DatabaseError;

    QSqlQuery q("SELECT title, subject, created_at, updated_at FROM notebooks ORDER BY updated_at DESC;", db);
    if (!q.exec()) {
        return StorageResult::DatabaseError;
    }

    out_list.clear();
    while (q.next()) {
        documents::NotebookMetadata meta;
        meta.title = q.value(0).toString().toStdString();
        meta.subject = q.value(1).toString().toStdString();
        meta.created_at = q.value(2).toULongLong();
        meta.updated_at = q.value(3).toULongLong();
        out_list.push_back(meta);
    }

    return StorageResult::Success;
}

StorageResult SQLiteStorage::delete_notebook(const std::string& notebook_id) {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    if (!db.isOpen()) return StorageResult::DatabaseError;

    QSqlQuery q(db);
    q.prepare("DELETE FROM notebooks WHERE id = :id;");
    q.bindValue(":id", QString::fromStdString(notebook_id));

    if (!q.exec()) {
        return StorageResult::DatabaseError;
    }
    return StorageResult::Success;
}

bool SQLiteStorage::is_connected() const noexcept {
    auto db = QSqlDatabase::database(QString::fromStdString(connection_name_));
    return db.isOpen();
}

} // namespace inkforge::storage
