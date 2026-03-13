import { useCallback, useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { UnlistenFn } from "@tauri-apps/api/event";

import {
  api,
  ConversionOptions,
  FFmpegStatus,
  MediaInfo,
  ProgressEvent,
  ConversionDoneEvent,
} from "./api";
import { OUTPUT_FORMATS, QUICK_PRESETS, FormatPreset } from "./presets";

import { FileDropZone } from "./components/FileDropZone";
import { FormatSelector } from "./components/FormatSelector";
import { QuickPresets } from "./components/QuickPresets";
import { AdvancedOptions } from "./components/AdvancedOptions";
import { ProgressPanel } from "./components/ProgressPanel";
import { DebugConsole, DebugEntry } from "./components/DebugConsole";

type Theme = "dark" | "light";

export interface QueueItem {
  id: string;
  inputPath: string;
  outputPath: string;
  mediaInfo: MediaInfo | null;
  status: "loading" | "pending" | "converting" | "done" | "error";
  progress: number;
  errorMsg?: string;
  jobId?: string;
}

interface CurrentProgress {
  percent: number;
  fps?: number;
  speed?: string;
  timeElapsed?: string;
  sizeKb?: number;
}

const DEFAULT_OPTIONS: Partial<ConversionOptions> = {
  format: "mp4",
  video_codec: "libx264",
  audio_codec: "aac",
  crf: 23,
  preset: "medium",
  audio_bitrate: "192k",
  resolution: "original",
  fps: "original",
};

let _itemIdSeq = 0;
const nextItemId = () => String(++_itemIdSeq);

function autoOutputPath(inputPath: string, format: FormatPreset): string {
  const ext = format.ext === "mp4-h265" ? "mp4" : format.ext;
  const noExt = inputPath.replace(/\.[^/.]+$/, "");
  return `${noExt}_converted.${ext}`;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ffmpegStatus, setFfmpegStatus] = useState<FFmpegStatus | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<CurrentProgress>({
    percent: 0,
  });
  const [selectedFormat, setSelectedFormat] = useState<FormatPreset>(
    OUTPUT_FORMATS[0],
  );
  const [options, setOptions] = useState<Partial<ConversionOptions>>({
    ...DEFAULT_OPTIONS,
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugEntry[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);

  const debugSeq = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const selectedFormatRef = useRef<FormatPreset>(OUTPUT_FORMATS[0]);
  const optionsRef = useRef<Partial<ConversionOptions>>({ ...DEFAULT_OPTIONS });
  const isConvertingRef = useRef(false);

  const unlistenProgress = useRef<UnlistenFn | null>(null);
  const unlistenDone = useRef<UnlistenFn | null>(null);
  const unlistenDebug = useRef<UnlistenFn | null>(null);
  const unlistenVersion = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    selectedFormatRef.current = selectedFormat;
  }, [selectedFormat]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const startNextConversion = useCallback(async () => {
    if (!isConvertingRef.current) return;

    const nextItem = queueRef.current.find((q) => q.status === "pending");
    if (!nextItem) {
      isConvertingRef.current = false;
      setIsConverting(false);
      return;
    }

    const after1 = queueRef.current.map((q) =>
      q.id === nextItem.id ? { ...q, status: "converting" as const } : q,
    );
    queueRef.current = after1;
    setQueue(after1);

    const fmt = selectedFormatRef.current;
    const ext = fmt.ext === "mp4-h265" ? "mp4" : fmt.ext;
    const finalOpts: ConversionOptions = {
      ...(optionsRef.current as ConversionOptions),
      format: ext,
    };

    try {
      const jobId = await api.startConversion({
        input_path: nextItem.inputPath,
        output_path: nextItem.outputPath,
        options: finalOpts,
        input_duration_secs: nextItem.mediaInfo?.duration ?? 0,
      });
      const after2 = queueRef.current.map((q) =>
        q.id === nextItem.id ? { ...q, jobId } : q,
      );
      queueRef.current = after2;
      setQueue(after2);
    } catch (e) {
      const after2 = queueRef.current.map((q) =>
        q.id === nextItem.id
          ? { ...q, status: "error" as const, errorMsg: String(e) }
          : q,
      );
      queueRef.current = after2;
      setQueue(after2);
      setTimeout(() => startNextConversion(), 0);
    }
  }, []);

  useEffect(() => {
    api.getFFmpegStatus().then(setFfmpegStatus);

    api
      .onVersion((e) => {
        setFfmpegStatus((prev) =>
          prev ? { ...prev, version: e.version ?? prev.version } : prev,
        );
      })
      .then((fn) => {
        unlistenVersion.current = fn;
      });

    api
      .onProgress((e: ProgressEvent) => {
        setCurrentProgress({
          percent: e.percent,
          fps: e.fps,
          speed: e.speed,
          timeElapsed: e.time_elapsed,
          sizeKb: e.size_kb,
        });
        const updated = queueRef.current.map((q) =>
          q.jobId === e.job_id ? { ...q, progress: e.percent } : q,
        );
        queueRef.current = updated;
        setQueue(updated);
      })
      .then((fn) => {
        unlistenProgress.current = fn;
      });

    api
      .onDone((e: ConversionDoneEvent) => {
        const updated = queueRef.current.map((q) =>
          q.jobId === e.job_id
            ? {
                ...q,
                status: (e.success ? "done" : "error") as QueueItem["status"],
                errorMsg: e.error,
                progress: e.success ? 100 : q.progress,
              }
            : q,
        );
        queueRef.current = updated;
        setQueue(updated);
        setTimeout(() => startNextConversion(), 0);
      })
      .then((fn) => {
        unlistenDone.current = fn;
      });

    api
      .onDebug((e) => {
        const now = new Date();
        const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        setDebugLogs((prev) => {
          const entry: DebugEntry = { ...e, id: ++debugSeq.current, ts };
          const next = [...prev, entry];
          return next.length > 500 ? next.slice(-500) : next;
        });
      })
      .then((fn) => {
        unlistenDebug.current = fn;
      });

    return () => {
      unlistenProgress.current?.();
      unlistenDone.current?.();
      unlistenDebug.current?.();
      unlistenVersion.current?.();
    };
  }, [startNextConversion]);

  const handleFilesAdded = useCallback(async (paths: string[]) => {
    const fmt = selectedFormatRef.current;
    const newItems: QueueItem[] = paths.map((p) => ({
      id: nextItemId(),
      inputPath: p,
      outputPath: autoOutputPath(p, fmt),
      mediaInfo: null,
      status: "loading" as const,
      progress: 0,
    }));

    const combined = [...queueRef.current, ...newItems];
    queueRef.current = combined;
    setQueue(combined);

    for (const item of newItems) {
      try {
        const info = await api.getMediaInfo(item.inputPath);
        const updated = queueRef.current.map((q) =>
          q.id === item.id
            ? { ...q, mediaInfo: info, status: "pending" as const }
            : q,
        );
        queueRef.current = updated;
        setQueue(updated);
      } catch {
        const updated = queueRef.current.map((q) =>
          q.id === item.id ? { ...q, status: "pending" as const } : q,
        );
        queueRef.current = updated;
        setQueue(updated);
      }
    }
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    const updated = queueRef.current.filter((q) => q.id !== id);
    queueRef.current = updated;
    setQueue(updated);
  }, []);

  const handleClearQueue = useCallback(() => {
    queueRef.current = [];
    setQueue([]);
  }, []);

  const handleFormatSelect = useCallback((fmt: FormatPreset) => {
    setSelectedFormat(fmt);
    selectedFormatRef.current = fmt;
    setActivePresetId(null);
    const ext = fmt.ext === "mp4-h265" ? "mp4" : fmt.ext;
    setOptions((prev) => ({
      format: ext,
      ...fmt.defaults,
      resolution: prev.resolution ?? "original",
      fps: prev.fps ?? "original",
      start_time: prev.start_time,
      end_time: prev.end_time,
      extra_args: prev.extra_args,
    }));
    const updated = queueRef.current.map((q) =>
      q.status === "pending" || q.status === "loading"
        ? { ...q, outputPath: autoOutputPath(q.inputPath, fmt) }
        : q,
    );
    queueRef.current = updated;
    setQueue(updated);
  }, []);

  const handleQuickPreset = useCallback((presetId: string) => {
    setActivePresetId(presetId);
    const preset = QUICK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const inputExt =
      queueRef.current[0]?.inputPath?.split(".").pop()?.toLowerCase() ?? "mp4";
    const built = preset.build(inputExt);
    setOptions({ ...DEFAULT_OPTIONS, ...built } as Partial<ConversionOptions>);
    const outputFmt = (built as { format?: string }).format ?? "mp4";
    const matchedFmt = OUTPUT_FORMATS.find((f) => f.ext === outputFmt);
    if (matchedFmt) {
      setSelectedFormat(matchedFmt);
      selectedFormatRef.current = matchedFmt;
      const updated = queueRef.current.map((q) =>
        q.status === "pending" || q.status === "loading"
          ? { ...q, outputPath: autoOutputPath(q.inputPath, matchedFmt) }
          : q,
      );
      queueRef.current = updated;
      setQueue(updated);
    }
  }, []);

  const handleOptionChange = useCallback(
    (
      key: keyof ConversionOptions,
      value: ConversionOptions[keyof ConversionOptions],
    ) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
      setActivePresetId(null);
    },
    [],
  );

  const handleBrowseOutput = useCallback(async (itemId: string) => {
    const item = queueRef.current.find((q) => q.id === itemId);
    if (!item) return;
    const ext = item.outputPath.split(".").pop() ?? "mp4";
    const path = await save({
      defaultPath: item.outputPath,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (path) {
      const updated = queueRef.current.map((q) =>
        q.id === itemId ? { ...q, outputPath: path } : q,
      );
      queueRef.current = updated;
      setQueue(updated);
    }
  }, []);

  const handleConvertAll = async () => {
    if (!ffmpegStatus?.available) return;
    const hasPending = queueRef.current.some((q) => q.status === "pending");
    if (!hasPending) return;
    isConvertingRef.current = true;
    setIsConverting(true);
    setCurrentProgress({ percent: 0 });
    startNextConversion();
  };

  const handleCancelCurrent = async () => {
    isConvertingRef.current = false;
    setIsConverting(false);
    const convertingItem = queueRef.current.find(
      (q) => q.status === "converting",
    );
    if (convertingItem?.jobId) {
      await api.cancelConversion(convertingItem.jobId);
    }
    const updated = queueRef.current.map((q) =>
      q.status === "converting"
        ? { ...q, status: "pending" as const, progress: 0, jobId: undefined }
        : q,
    );
    queueRef.current = updated;
    setQueue(updated);
  };

  const handleRevealFile = async (outputPath: string) => {
    try {
      await revealItemInDir(outputPath);
    } catch {}
  };

  const handleNewConversion = () => {
    queueRef.current = [];
    setQueue([]);
    setIsConverting(false);
    isConvertingRef.current = false;
    setCurrentProgress({ percent: 0 });
    setActivePresetId(null);
  };

  // Derived values
  const hasItems = queue.length > 0;
  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const convertingItem = queue.find((q) => q.status === "converting");
  const isAudioOnly = selectedFormat.isAudioOnly;
  const allFinished = isConverting && !convertingItem && pendingCount === 0;
  const canConvert =
    hasItems && pendingCount > 0 && !isConverting && !!ffmpegStatus?.available;
  const queueCurrentIndex = doneCount + errorCount + (convertingItem ? 1 : 0);

  return (
    <div
      data-theme={theme}
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎬</span>
          <div>
            <div
              className="font-bold text-base"
              style={{ color: "var(--text)" }}
            >
              FFmpeg Converter
            </div>
            <div
              className="text-sm"
              style={{
                color: "var(--muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {ffmpegStatus?.available
                ? ffmpegStatus.version?.slice(0, 60)
                : "FFmpeg not found"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ffmpegStatus && !ffmpegStatus.available && (
            <div
              className="text-sm px-3 py-1 rounded-full"
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger)",
                border: "1px solid var(--danger-bg)",
              }}
            >
              ⚠ FFmpeg not found
            </div>
          )}
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "var(--surface2)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 mx-auto w-full" style={{ maxWidth: 1400 }}>
        <div className="space-y-5">
          {/* Drop zone — always visible when not converting */}
          {!isConverting && (
            <FileDropZone onFilesAdded={handleFilesAdded} compact={hasItems} />
          )}

          {/* Queue list */}
          {hasItems && !isConverting && (
            <QueueList
              items={queue}
              onRemove={handleRemoveItem}
              onClear={handleClearQueue}
              onBrowseOutput={handleBrowseOutput}
              onReveal={handleRevealFile}
            />
          )}

          {/* Format + Options — visible when queue has items and not converting */}
          {hasItems && !isConverting && (
            <>
              <QuickPresets
                selectedPresetId={activePresetId}
                onSelect={handleQuickPreset}
              />
              <FormatSelector
                selected={selectedFormat.ext}
                onSelect={handleFormatSelect}
              />
              <AdvancedOptions
                options={options}
                onChange={handleOptionChange}
                isAudioOnly={isAudioOnly}
              />
            </>
          )}

          {/* Convert button */}
          {hasItems && !isConverting && (
            <button
              onClick={handleConvertAll}
              disabled={!canConvert}
              className="w-full py-3 rounded-xl font-semibold text-base transition-all"
              style={{
                background: canConvert
                  ? "linear-gradient(135deg, var(--accent-dark), var(--accent))"
                  : "var(--surface2)",
                color: canConvert ? "white" : "var(--muted)",
                border: "none",
                cursor: canConvert ? "pointer" : "not-allowed",
                boxShadow: canConvert
                  ? "0 4px 20px var(--accent-glow)"
                  : "none",
              }}
            >
              {!ffmpegStatus?.available
                ? "⚠ FFmpeg not found"
                : pendingCount === 0
                  ? "No pending files"
                  : pendingCount === 1
                    ? "▶  Convert 1 File"
                    : `▶  Convert All (${pendingCount} files)`}
            </button>
          )}

          {/* Progress panel */}
          {isConverting && (
            <ProgressPanel
              allFinished={allFinished}
              currentFileName={
                convertingItem?.inputPath.split(/[\\/]/).pop() ?? ""
              }
              currentOutputPath={convertingItem?.outputPath ?? ""}
              percent={currentProgress.percent}
              fps={currentProgress.fps}
              speed={currentProgress.speed}
              timeElapsed={currentProgress.timeElapsed}
              sizeKb={currentProgress.sizeKb}
              queueCurrentIndex={queueCurrentIndex}
              queueTotal={queue.length}
              queueDone={doneCount}
              queueError={errorCount}
              onCancel={handleCancelCurrent}
              onNewConversion={handleNewConversion}
              results={queue
                .filter((q) => q.status === "done" || q.status === "error")
                .map((q) => ({
                  filename: q.inputPath.split(/[\\/]/).pop() ?? "",
                  outputPath: q.outputPath,
                  success: q.status === "done",
                  error: q.errorMsg,
                }))}
              onReveal={handleRevealFile}
            />
          )}
        </div>
      </main>

      <DebugConsole
        open={debugOpen}
        logs={debugLogs}
        onToggle={() => setDebugOpen((o) => !o)}
        onClear={() => setDebugLogs([])}
      />
    </div>
  );
}

// ─── Queue List Component ─────────────────────────────────────────────────────

interface QueueListProps {
  items: QueueItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onBrowseOutput: (id: string) => void;
  onReveal: (path: string) => void;
}

function QueueList({
  items,
  onRemove,
  onClear,
  onBrowseOutput,
  onReveal,
}: QueueListProps) {
  const loadingCount = items.filter((i) => i.status === "loading").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--muted)" }}
        >
          {items.length} file{items.length !== 1 ? "s" : ""} in queue
          {loadingCount > 0 && (
            <span className="ml-2 text-sm" style={{ color: "var(--accent)" }}>
              (reading info…)
            </span>
          )}
          {pendingCount > 0 && loadingCount === 0 && (
            <span className="ml-2 text-sm" style={{ color: "var(--muted)" }}>
              — {pendingCount} ready
            </span>
          )}
        </div>
        {items.length > 1 && (
          <button
            onClick={onClear}
            className="text-sm px-2 py-1 rounded"
            style={{
              background: "transparent",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Clear all
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            onRemove={onRemove}
            onBrowseOutput={onBrowseOutput}
            onReveal={onReveal}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Queue Row Component ──────────────────────────────────────────────────────

interface QueueRowProps {
  item: QueueItem;
  onRemove: (id: string) => void;
  onBrowseOutput: (id: string) => void;
  onReveal: (path: string) => void;
}

function QueueRow({ item, onRemove, onBrowseOutput, onReveal }: QueueRowProps) {
  const filename = item.inputPath.split(/[\\/]/).pop() ?? "";
  const ext = filename.split(".").pop()?.toUpperCase() ?? "";
  const outputFilename = item.outputPath.split(/[\\/]/).pop() ?? "";

  const statusColor: Record<QueueItem["status"], string> = {
    loading: "var(--muted)",
    pending: "var(--muted)",
    converting: "var(--accent)",
    done: "var(--success)",
    error: "var(--danger)",
  };

  const statusLabel: Record<QueueItem["status"], string> = {
    loading: "loading…",
    pending: "ready",
    converting: `${item.progress.toFixed(0)}%`,
    done: "done",
    error: "failed",
  };

  return (
    <div
      className="rounded-xl px-4 py-3 group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* File type badge */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{
            background: "var(--surface2)",
            color: "var(--accent)",
            border: "1px solid var(--border)",
          }}
        >
          {ext}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium truncate"
            style={{ color: "var(--text)" }}
            title={item.inputPath}
          >
            {filename}
          </div>
          {item.mediaInfo && (
            <div
              className="flex flex-wrap gap-2 mt-0.5 text-xs"
              style={{ color: "var(--muted)" }}
            >
              {item.mediaInfo.width && item.mediaInfo.height && (
                <span>
                  {item.mediaInfo.width}×{item.mediaInfo.height}
                </span>
              )}
              {item.mediaInfo.duration_str && (
                <span>{item.mediaInfo.duration_str}</span>
              )}
              {item.mediaInfo.video_codec && (
                <span>{item.mediaInfo.video_codec.toUpperCase()}</span>
              )}
            </div>
          )}
          {/* Output path row */}
          {item.status !== "done" && item.status !== "error" && (
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="text-xs truncate"
                style={{ color: "var(--muted)" }}
                title={item.outputPath}
              >
                → {outputFilename}
              </span>
              {(item.status === "pending" || item.status === "loading") && (
                <button
                  onClick={() => onBrowseOutput(item.id)}
                  className="text-xs flex-shrink-0"
                  style={{
                    color: "var(--accent)",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                  }}
                >
                  edit
                </button>
              )}
            </div>
          )}
          {/* Error message */}
          {item.status === "error" && item.errorMsg && (
            <div
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--danger)" }}
              title={item.errorMsg}
            >
              {item.errorMsg.slice(0, 100)}
            </div>
          )}
          {/* Progress bar while converting */}
          {item.status === "converting" && (
            <div
              className="h-1 rounded-full mt-1.5 overflow-hidden"
              style={{ background: "var(--surface2)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${item.progress}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          )}
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.status === "done" && (
            <button
              onClick={() => onReveal(item.outputPath)}
              className="text-sm px-2 py-1 rounded-lg"
              style={{
                background: "var(--success-bg)",
                color: "var(--success)",
                cursor: "pointer",
                border: "none",
              }}
            >
              Reveal
            </button>
          )}
          <span
            className="text-sm font-medium"
            style={{ color: statusColor[item.status] }}
          >
            {statusLabel[item.status]}
          </span>
          {item.status !== "converting" && (
            <button
              onClick={() => onRemove(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center"
              style={{
                background: "transparent",
                color: "var(--muted)",
                cursor: "pointer",
                border: "none",
                fontSize: 14,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
