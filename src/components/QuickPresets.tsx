import { QUICK_PRESETS } from "../presets";
import { Tooltip } from "./Tooltip";

interface QuickPresetsProps {
  selectedPresetId: string | null;
  onSelect: (presetId: string) => void;
}

export function QuickPresets({
  selectedPresetId,
  onSelect,
}: QuickPresetsProps) {
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
          return (
            <Tooltip key={preset.id} content={preset.description}>
              <button
                onClick={() => onSelect(preset.id)}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium text-center transition-all"
                style={{
                  background: isSelected
                    ? "var(--accent-glow)"
                    : "var(--surface)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  color: isSelected ? "var(--accent)" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {preset.label}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
