#pragma once

#include <memory>
#include <vector>
#include <chrono>
#include <inkforge/commands/ICommand.hpp>
#include <inkforge/documents/Layer.hpp>
#include <inkforge/ink/Stroke.hpp>

namespace inkforge::commands {

/**
 * @brief Command to commit a newly drawn vector stroke to a layer.
 */
class INKFORGE_API AddStrokeCommand : public ICommand {
public:
    AddStrokeCommand(documents::Layer* target_layer, ink::StrokePtr stroke);

    void execute() override;
    void undo() override;

    [[nodiscard]] std::string description() const override;
    [[nodiscard]] CommandType command_type() const noexcept override { return CommandType::AddStroke; }
    [[nodiscard]] uint64_t timestamp_us() const noexcept override { return timestamp_us_; }
    [[nodiscard]] size_t estimated_memory_bytes() const noexcept override;
    [[nodiscard]] const ink::StrokePtr& stroke() const noexcept { return stroke_; }

private:
    documents::Layer* target_layer_{nullptr};
    ink::StrokePtr stroke_;
    uint64_t timestamp_us_{0};
};

/**
 * @brief Command to remove a single stroke from a layer.
 */
class INKFORGE_API RemoveStrokeCommand : public ICommand {
public:
    RemoveStrokeCommand(documents::Layer* target_layer, ink::StrokePtr stroke);

    void execute() override;
    void undo() override;

    [[nodiscard]] std::string description() const override;
    [[nodiscard]] CommandType command_type() const noexcept override { return CommandType::RemoveStroke; }
    [[nodiscard]] uint64_t timestamp_us() const noexcept override { return timestamp_us_; }
    [[nodiscard]] size_t estimated_memory_bytes() const noexcept override;

private:
    documents::Layer* target_layer_{nullptr};
    ink::StrokePtr stroke_;
    size_t original_index_{0};
    uint64_t timestamp_us_{0};
};

/**
 * @brief Transactional command removing multiple strokes in one user gesture (e.g. eraser sweep).
 */
class INKFORGE_API BatchRemoveStrokesCommand : public ICommand {
public:
    BatchRemoveStrokesCommand(documents::Layer* target_layer, std::vector<ink::StrokePtr> strokes);

    void execute() override;
    void undo() override;

    [[nodiscard]] std::string description() const override;
    [[nodiscard]] CommandType command_type() const noexcept override { return CommandType::BatchRemoveStrokes; }
    [[nodiscard]] uint64_t timestamp_us() const noexcept override { return timestamp_us_; }
    [[nodiscard]] size_t estimated_memory_bytes() const noexcept override;
    [[nodiscard]] size_t removed_count() const noexcept { return strokes_.size(); }

private:
    documents::Layer* target_layer_{nullptr};
    std::vector<ink::StrokePtr> strokes_;
    uint64_t timestamp_us_{0};
};

/**
 * @brief Command to wipe an entire layer, retaining prior strokes for full undo recovery.
 */
class INKFORGE_API ClearLayerCommand : public ICommand {
public:
    explicit ClearLayerCommand(documents::Layer* target_layer);

    void execute() override;
    void undo() override;

    [[nodiscard]] std::string description() const override;
    [[nodiscard]] CommandType command_type() const noexcept override { return CommandType::ClearLayer; }
    [[nodiscard]] uint64_t timestamp_us() const noexcept override { return timestamp_us_; }
    [[nodiscard]] size_t estimated_memory_bytes() const noexcept override;

private:
    documents::Layer* target_layer_{nullptr};
    std::vector<ink::StrokePtr> saved_strokes_;
    uint64_t timestamp_us_{0};
};

} // namespace inkforge::commands
