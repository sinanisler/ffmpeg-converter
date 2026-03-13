interface QueueResultItem {
  filename: string;
  outputPath: string;
  success: boolean;
  error?: string;
}

interface ProgressPanelProps {
  allFinished: boolean;
  currentFileName: string;
  currentOutputPath: string;
  percent: number;
  fps?: number;
  speed?: string;
  timeElapsed?: string;
  sizeKb?: number;
  queueCurrentIndex: number;
  queueTotal: number;
  queueDone: number;
  queueError: number;
  onCancel: () => void;
  onNewConversion: () => void;
  results: QueueResultItem[];
  onReveal: (path: string) => void;
}

export function ProgressPanel({
  allFinished,
  currentFileName,
  currentOutputPath,
  percent,
  fps,
  speed,
  timeElapsed,
  sizeKb,
  queueCurrentIndex,
  queueTotal,
  queueDone,
  queueError,
  onCancel,
  onNewConversion,
  results,
  onReveal,
}: ProgressPanelProps) {
  if (allFinished) {
    const allSuccess = queueError === 0;
    return (
      <div
        className="rounded-xl p-5 flex flex-col gap-4"
        style={{
          background: "var(--surface)",
          border: `1px solid ${allSuccess ? "var(--success)" : "var(--border)"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{allSuccess ? "✅" : "⚠"}</span>
          <div>
            <div
              className="font-semibold text-base"
              style={{
                color: allSuccess ? "var(--success)" : "var(--warning)",
              }}
            >
              {allSuccess
                ? "All done!"
                : `Done — ${queueError} file${queueError > 1 ? "s" : ""} failed`}
            </div>
            <div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
              {queueDone} converted
              {queueError > 0 ? `, ${queueError} failed` : ""}
            </div>
          </div>
        </div>

        {/* Results list */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  color: r.success ? "var(--success)" : "var(--danger)",
                  flexShrink: 0,
                }}
              >
                {r.success ? "✓" : "✗"}
              </span>
              <span
                className="flex-1 text-sm truncate"
                style={{ color: "var(--text)" }}
                title={r.outputPath}
              >
                {r.filename}
              </span>
              {r.success ? (
                <button
                  onClick={() => onReveal(r.outputPath)}
                  className="text-sm px-3 py-1 rounded flex-shrink-0"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  Reveal
                </button>
              ) : (
                <span
                  className="text-xs truncate max-w-xs flex-shrink-0"
                  style={{ color: "var(--danger)" }}
                  title={r.error}
                >
                  {r.error?.slice(0, 60)}
                </span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onNewConversion}
          className="text-sm py-2 px-4 rounded-lg font-medium w-fit"
          style={{
            background: "var(--surface2)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
        >
          ← Convert More Files
        </button>
      </div>
    );
  }

  // Converting state
  const outputFilename = currentOutputPath.split(/[\\/]/).pop() ?? "";

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="font-semibold text-base"
              style={{ color: "var(--text)" }}
            >
              Converting…
            </div>
            {queueTotal > 1 && (
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                File {queueCurrentIndex} of {queueTotal}
              </span>
            )}
          </div>
          <div
            className="text-sm mt-0.5 truncate"
            style={{ color: "var(--muted)" }}
            title={currentOutputPath}
          >
            {currentFileName}
            {outputFilename && currentFileName !== outputFilename && (
              <span> → {outputFilename}</span>
            )}
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-sm py-1.5 px-3 rounded-lg flex-shrink-0"
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger)",
            border: "1px solid var(--danger-bg)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface2)" }}
      >
        <div
          className="absolute h-full rounded-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            background:
              "linear-gradient(90deg, var(--accent-dark), var(--accent))",
          }}
        />
      </div>

      {/* Stats */}
      <div
        className="flex flex-wrap gap-4 text-sm"
        style={{ color: "var(--muted)" }}
      >
        <Stat label="Progress" value={`${percent.toFixed(1)}%`} />
        {timeElapsed && <Stat label="Time" value={timeElapsed} />}
        {fps !== undefined && fps > 0 && (
          <Stat label="FPS" value={fps.toFixed(1)} />
        )}
        {speed && <Stat label="Speed" value={speed} />}
        {sizeKb !== undefined && sizeKb > 0 && (
          <Stat
            label="Output size"
            value={
              sizeKb > 1024
                ? `${(sizeKb / 1024).toFixed(1)} MB`
                : `${sizeKb} KB`
            }
          />
        )}
        {queueTotal > 1 && (
          <Stat
            label="Queue"
            value={`${queueDone} done${queueError > 0 ? `, ${queueError} err` : ""}`}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      <span style={{ color: "var(--text)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
