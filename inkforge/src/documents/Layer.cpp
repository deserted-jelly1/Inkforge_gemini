#include <inkforge/documents/Layer.hpp>
#include <algorithm>

namespace inkforge::documents {

Layer::Layer()
    : id_("layer_default"), name_("Layer 1") {}

Layer::Layer(std::string id, std::string name)
    : id_(std::move(id)), name_(std::move(name)) {}

void Layer::add_stroke(ink::StrokePtr stroke) {
    if (stroke) {
        strokes_.push_back(std::move(stroke));
    }
}

bool Layer::remove_stroke(const std::string& stroke_id) {
    const auto it = std::remove_if(strokes_.begin(), strokes_.end(),
        [&stroke_id](const ink::StrokePtr& s) {
            return s && s->id() == stroke_id;
        });

    if (it != strokes_.end()) {
        strokes_.erase(it, strokes_.end());
        return true;
    }
    return false;
}

void Layer::clear() {
    strokes_.clear();
}

core::Rect2d Layer::bounding_box() const {
    if (strokes_.empty()) {
        return {};
    }
    core::Rect2d total_bounds;
    bool first = true;
    for (const auto& s : strokes_) {
        if (!s) continue;
        if (first) {
            total_bounds = s->bounding_box();
            first = false;
        } else {
            const auto& b = s->bounding_box();
            total_bounds.min_x = std::min(total_bounds.min_x, b.min_x);
            total_bounds.min_y = std::min(total_bounds.min_y, b.min_y);
            total_bounds.max_x = std::max(total_bounds.max_x, b.max_x);
            total_bounds.max_y = std::max(total_bounds.max_y, b.max_y);
        }
    }
    return total_bounds;
}

} // namespace inkforge::documents
