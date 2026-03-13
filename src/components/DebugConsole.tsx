import { useEffect, useRef } from "react";
import { DebugEvent } from "../api";

export interface DebugEntry extends DebugEvent {
  id: number;
  ts: string;
}

interface DebugConsoleProps {
  open: boolean;
  logs: DebugEntry[];
  onToggle: () => void;
  onClear: () => void;
}

export function DebugConsole({
  open,
  logs,
  onToggle,
  onClear,
}: DebugConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, open]);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
      }}
    >
      {/* Toggle bar */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer select-none"
        style={{ background: "var(--surface2)" }}
        onClick={onToggle}
      >
        <div
          className="flex items-center gap-2 text-xs font-mono font-medium"
          style={{ color: "var(--muted)" }}
        >
          <span style={{ color: "var(--accent)" }}>{open ? "▼" : "▶"}</span>
          Debug Console
          {logs.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-xs"
              style={{ background: "var(--surface2)", color: "var(--muted)" }}
            >
              {logs.length}
            </span>
          )}
        </div>
        {open && logs.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: "transparent",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Log area */}
      {open && (
        <div
          className="overflow-y-auto font-mono text-xs"
          style={{
            height: 220,
            background: "#0f172a",
            padding: "8px 12px",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: "#475569" }}>
              No debug output yet. Start a conversion to see FFmpeg activity.
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-2 leading-relaxed"
                style={{ marginBottom: 1 }}
              >
                <span style={{ color: "#475569", flexShrink: 0 }}>
                  {entry.ts}
                </span>
                <span
                  style={{
                    color:
                      entry.level === "cmd"
                        ? "#818cf8"
                        : getLineColor(entry.message),
                    wordBreak: "break-all",
                  }}
                >
                  {entry.level === "cmd" && (
                    <span style={{ color: "#64748b" }}>$ </span>
                  )}
                  {entry.message}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

function getLineColor(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("invalid") ||
    lower.includes("no such file")
  ) {
    return "#f87171"; // red
  }
  if (lower.includes("warning") || lower.includes("deprecated")) {
    return "#fbbf24"; // amber
  }
  if (
    lower.startsWith("frame=") ||
    lower.startsWith("fps=") ||
    lower.startsWith("size=")
  ) {
    return "#34d399"; // green - progress lines
  }
  return "#94a3b8"; // default light grey
}
