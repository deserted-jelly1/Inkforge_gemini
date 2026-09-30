#include <inkforge/documents/Page.hpp>

namespace inkforge::documents {

Page::Page()
    : id_("page_default"), index_(0) {
    layers_.emplace_back("layer_0", "Ink Layer");
}

Page::Page(std::string id, size_t index)
    : id_(std::move(id)), index_(index) {
    layers_.emplace_back("layer_0", "Ink Layer");
}

void Page::set_active_layer_index(size_t idx) {
    if (idx < layers_.size()) {
        active_layer_index_ = idx;
    }
}

Layer* Page::active_layer() {
    if (layers_.empty()) {
        layers_.emplace_back("layer_0", "Ink Layer");
        active_layer_index_ = 0;
    }
    if (active_layer_index_ >= layers_.size()) {
        active_layer_index_ = layers_.size() - 1;
    }
    return &layers_[active_layer_index_];
}

const Layer* Page::active_layer() const {
    if (layers_.empty()) return nullptr;
    const size_t safe_idx = std::min(active_layer_index_, layers_.size() - 1);
    return &layers_[safe_idx];
}

void Page::add_layer(std::string name) {
    const std::string new_id = "layer_" + std::to_string(layers_.size());
    layers_.emplace_back(new_id, std::move(name));
    active_layer_index_ = layers_.size() - 1;
}

bool Page::remove_layer(size_t index) {
    if (layers_.size() <= 1 || index >= layers_.size()) {
        return false; // Retain at least 1 layer
    }
    layers_.erase(layers_.begin() + static_cast<ptrdiff_t>(index));
    if (active_layer_index_ >= layers_.size()) {
        active_layer_index_ = layers_.size() - 1;
    }
    return true;
}

size_t Page::total_stroke_count() const noexcept {
    size_t count = 0;
    for (const auto& layer : layers_) {
        count += layer.strokes().size();
    }
    return count;
}

} // namespace inkforge::documents
