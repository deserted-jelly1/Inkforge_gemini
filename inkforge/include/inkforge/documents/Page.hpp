#pragma once

#include <string>
#include <vector>
#include <memory>
#include <inkforge/core/Export.hpp>
#include <inkforge/documents/Layer.hpp>

namespace inkforge::documents {

enum class BackgroundPattern : uint8_t {
    Blank = 0,
    Lined = 1,
    Grid = 2,
    DotGrid = 3
};

class INKFORGE_API Page {
public:
    Page();
    explicit Page(std::string id, size_t index = 0);

    [[nodiscard]] const std::string& id() const noexcept { return id_; }
    [[nodiscard]] size_t index() const noexcept { return index_; }
    void set_index(size_t index) noexcept { index_ = index; }

    [[nodiscard]] BackgroundPattern background_pattern() const noexcept { return bg_pattern_; }
    void set_background_pattern(BackgroundPattern pattern) noexcept { bg_pattern_ = pattern; }

    [[nodiscard]] double grid_spacing() const noexcept { return grid_spacing_; }
    void set_grid_spacing(double spacing) noexcept { grid_spacing_ = spacing; }

    [[nodiscard]] const std::vector<Layer>& layers() const noexcept { return layers_; }
    [[nodiscard]] std::vector<Layer>& layers() noexcept { return layers_; }

    [[nodiscard]] size_t active_layer_index() const noexcept { return active_layer_index_; }
    void set_active_layer_index(size_t idx);

    [[nodiscard]] Layer* active_layer();
    [[nodiscard]] const Layer* active_layer() const;

    void add_layer(std::string name);
    bool remove_layer(size_t index);

    [[nodiscard]] size_t total_stroke_count() const noexcept;

private:
    std::string id_;
    size_t index_{0};
    BackgroundPattern bg_pattern_{BackgroundPattern::DotGrid};
    double grid_spacing_{24.0}; // 24 pt grid default
    std::vector<Layer> layers_;
    size_t active_layer_index_{0};
};

using PagePtr = std::shared_ptr<Page>;

} // namespace inkforge::documents
