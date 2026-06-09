import { QUICK_PRESETS } from "../presets";
import { HwEncoderStatus } from "../api";
import { Tooltip } from "./Tooltip";

interface QuickPresetsProps {
  selectedPresetId: string | null;
  onSelect: (presetId: string) => void;
  hwEncoders: HwEncoderStatus | null;
}

export function QuickPresets({
  selectedPresetId,
  onSelect,
  hwEncoders,
}: QuickPresetsProps) {
  const isGpuPresetUnavailable = (presetId: string): boolean => {
    if (!hwEncoders) return false; // haven't checked yet, show everything
    switch (presetId) {
      case "nvenc-h264": return !hwEncoders.nvenc_h264;
      case "nvenc-hevc": return !hwEncoders.nvenc_hevc;
      case "amd-amf":    return !hwEncoders.amf_h264;
      default:           return false;
    }
  };

  const unavailableReason = (presetId: string): string => {
    if (!hwEncoders) return "";
    switch (presetId) {
      case "nvenc-h264":
      case "nvenc-hevc":
        return "NVENC not found in this FFmpeg build. Install an FFmpeg build with --enable-nvenc, or install NVIDIA drivers v522+.";
      case "amd-amf":
        return "AMF not found in this FFmpeg build. Install an FFmpeg build with --enable-amf, or install AMD Adrenalin drivers.";
      default:
        return "";
    }
  };

  return (
    <div>
      <div
        className="text-xs font-semibold mb-2 uppercase tracking-wider"
        style={{ color: "var(--muted)" }}
      >
        Quick Presets
      </div>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          const disabled = isGpuPresetUnavailable(preset.id);
          const reason = unavailableReason(preset.id);
          return (
            <Tooltip key={preset.id} content={disabled ? `⚠ ${reason}` : preset.description}>
              <button
                onClick={() => { if (!disabled) onSelect(preset.id); }}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium text-center transition-all"
                style={{
                  background: isSelected
                    ? "var(--accent-glow)"
                    : "var(--surface)",
                  border: `1px solid ${isSelected ? "var(--accent)" : disabled ? "var(--border)" : "var(--border)"}`,
                  color: disabled ? "var(--muted)" : isSelected ? "var(--accent)" : "var(--text)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
                disabled={disabled}
                title={disabled ? reason : undefined}
              >
                {preset.label}
                {disabled && " (unavailable)"}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
