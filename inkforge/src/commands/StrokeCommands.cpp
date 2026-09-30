#include <inkforge/commands/StrokeCommands.hpp>

namespace inkforge::commands {

// --- AddStrokeCommand ---
AddStrokeCommand::AddStrokeCommand(documents::Layer* target_layer, ink::StrokePtr stroke)
    : target_layer_(target_layer), stroke_(std::move(stroke)) {
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    timestamp_us_ = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());
}

void AddStrokeCommand::execute() {
    if (target_layer_ && stroke_) {
        target_layer_->add_stroke(stroke_);
    }
}

void AddStrokeCommand::undo() {
    if (target_layer_ && stroke_) {
        target_layer_->remove_stroke(stroke_->id());
    }
}

std::string AddStrokeCommand::description() const {
    const size_t pts = stroke_ ? stroke_->point_count() : 0;
    return "Add Stroke (" + std::to_string(pts) + " pts)";
}

size_t AddStrokeCommand::estimated_memory_bytes() const noexcept {
    const size_t pts_bytes = stroke_ ? stroke_->point_count() * sizeof(ink::Point) : 0;
    return sizeof(*this) + pts_bytes + sizeof(ink::Stroke);
}

// --- RemoveStrokeCommand ---
RemoveStrokeCommand::RemoveStrokeCommand(documents::Layer* target_layer, ink::StrokePtr stroke)
    : target_layer_(target_layer), stroke_(std::move(stroke)) {
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    timestamp_us_ = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());
}

void RemoveStrokeCommand::execute() {
    if (target_layer_ && stroke_) {
        target_layer_->remove_stroke(stroke_->id());
    }
}

void RemoveStrokeCommand::undo() {
    if (target_layer_ && stroke_) {
        target_layer_->add_stroke(stroke_);
    }
}

std::string RemoveStrokeCommand::description() const {
    return "Erase Stroke (" + (stroke_ ? stroke_->id() : "null") + ")";
}

size_t RemoveStrokeCommand::estimated_memory_bytes() const noexcept {
    const size_t pts_bytes = stroke_ ? stroke_->point_count() * sizeof(ink::Point) : 0;
    return sizeof(*this) + pts_bytes;
}

// --- BatchRemoveStrokesCommand ---
BatchRemoveStrokesCommand::BatchRemoveStrokesCommand(
    documents::Layer* target_layer,
    std::vector<ink::StrokePtr> strokes
)
    : target_layer_(target_layer), strokes_(std::move(strokes)) {
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    timestamp_us_ = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());
}

void BatchRemoveStrokesCommand::execute() {
    if (!target_layer_) return;
    for (const auto& s : strokes_) {
        if (s) {
            target_layer_->remove_stroke(s->id());
        }
    }
}

void BatchRemoveStrokesCommand::undo() {
    if (!target_layer_) return;
    for (const auto& s : strokes_) {
        if (s) {
            target_layer_->add_stroke(s);
        }
    }
}

std::string BatchRemoveStrokesCommand::description() const {
    return "Erase " + std::to_string(strokes_.size()) + " Strokes";
}

size_t BatchRemoveStrokesCommand::estimated_memory_bytes() const noexcept {
    size_t total = sizeof(*this) + strokes_.capacity() * sizeof(ink::StrokePtr);
    for (const auto& s : strokes_) {
        if (s) {
            total += s->point_count() * sizeof(ink::Point);
        }
    }
    return total;
}

// --- ClearLayerCommand ---
ClearLayerCommand::ClearLayerCommand(documents::Layer* target_layer)
    : target_layer_(target_layer) {
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    timestamp_us_ = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::microseconds>(now).count());
    if (target_layer_) {
        saved_strokes_ = target_layer_->strokes();
    }
}

void ClearLayerCommand::execute() {
    if (target_layer_) {
        target_layer_->clear();
    }
}

void ClearLayerCommand::undo() {
    if (target_layer_) {
        for (const auto& s : saved_strokes_) {
            target_layer_->add_stroke(s);
        }
    }
}

std::string ClearLayerCommand::description() const {
    return "Clear Canvas (" + std::to_string(saved_strokes_.size()) + " strokes wiped)";
}

size_t ClearLayerCommand::estimated_memory_bytes() const noexcept {
    size_t total = sizeof(*this) + saved_strokes_.capacity() * sizeof(ink::StrokePtr);
    for (const auto& s : saved_strokes_) {
        if (s) {
            total += s->point_count() * sizeof(ink::Point);
        }
    }
    return total;
}

} // namespace inkforge::commands
