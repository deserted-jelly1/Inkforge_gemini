#pragma once

#include <string>
#include <vector>
#include <memory>
#include <inkforge/core/Export.hpp>
#include <inkforge/ink/Stroke.hpp>

namespace inkforge::documents {

class INKFORGE_API Layer {
public:
    Layer();
    explicit Layer(std::string id, std::string name);

    [[nodiscard]] const std::string& id() const noexcept { return id_; }
    [[nodiscard]] const std::string& name() const noexcept { return name_; }
    void set_name(std::string name) { name_ = std::move(name); }

    [[nodiscard]] bool is_visible() const noexcept { return is_visible_; }
    void set_visible(bool visible) noexcept { is_visible_ = visible; }

    [[nodiscard]] bool is_locked() const noexcept { return is_locked_; }
    void set_locked(bool locked) noexcept { is_locked_ = locked; }

    [[nodiscard]] float opacity() const noexcept { return opacity_; }
    void set_opacity(float opacity) noexcept { opacity_ = opacity; }

    [[nodiscard]] const std::vector<ink::StrokePtr>& strokes() const noexcept { return strokes_; }

    void add_stroke(ink::StrokePtr stroke);
    bool remove_stroke(const std::string& stroke_id);
    void clear();

    [[nodiscard]] core::Rect2d bounding_box() const;

private:
    std::string id_;
    std::string name_{"Layer 1"};
    bool is_visible_{true};
    bool is_locked_{false};
    float opacity_{1.0f};
    std::vector<ink::StrokePtr> strokes_;
};

} // namespace inkforge::documents
