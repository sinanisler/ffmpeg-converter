import { OUTPUT_FORMATS, FormatPreset } from "../presets";
import { Tooltip } from "./Tooltip";

interface FormatSelectorProps {
  selected: string;
  onSelect: (format: FormatPreset) => void;
}

export function FormatSelector({ selected, onSelect }: FormatSelectorProps) {
  const videoFormats = OUTPUT_FORMATS.filter((f) => !f.isAudioOnly);
  const audioFormats = OUTPUT_FORMATS.filter((f) => f.isAudioOnly);

  return (
    <div>
      <div
        className="text-xs font-semibold mb-2 uppercase tracking-wider"
        style={{ color: "var(--muted)" }}
      >
        Output Format
      </div>
      <div className="mb-3">
        <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
          Video
        </div>
        <div className="flex flex-wrap gap-2">
          {videoFormats.map((fmt) => (
            <FormatButton
              key={fmt.ext}
              fmt={fmt}
              selected={selected === fmt.ext}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
          Audio only
        </div>
        <div className="flex flex-wrap gap-2">
          {audioFormats.map((fmt) => (
            <FormatButton
              key={fmt.ext}
              fmt={fmt}
              selected={selected === fmt.ext}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FormatButton({
  fmt,
  selected,
  onSelect,
}: {
  fmt: FormatPreset;
  selected: boolean;
  onSelect: (f: FormatPreset) => void;
}) {
  return (
    <Tooltip content={fmt.description}>
      <button
        onClick={() => onSelect(fmt)}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{
          background: selected ? "var(--accent)" : "var(--surface2)",
          color: selected ? "white" : "var(--muted)",
          border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
          cursor: "pointer",
        }}
      >
        {fmt.label}
      </button>
    </Tooltip>
  );
}
