import { MediaInfo, api, ConversionOptions } from "../api";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { VIDEO_CODECS, AUDIO_CODECS } from "../presets";

// ─── Output metadata helpers ─────────────────────────────────────────────────

/** Parse a time string (HH:MM:SS, MM:SS, or raw seconds) to seconds. */
function parseTimeToSeconds(t: string): number {
  const trimmed = t.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed); // raw seconds
  const parts = trimmed.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Format seconds as HH:MM:SS or MM:SS string. */
function formatDuration(secs: number): string {
  if (secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Get a friendly display label for a codec value. */
function getCodecLabel(codecValue: string | undefined, isVideo: boolean): string {
  if (!codecValue) return "Unknown";
  const list = isVideo ? VIDEO_CODECS : AUDIO_CODECS;
  const found = list.find((c) => c.value === codecValue);
  return found ? found.label : codecValue;
}

interface OutputMeta {
  codec: string;
  resolution: string;
  duration: string;
}

/** Derive output metadata from source info + encoding options. */
function getOutputMetadata(
  mediaInfo: MediaInfo | null,
  options?: ConversionOptions,
): OutputMeta | null {
  if (!mediaInfo) return null;

  const isSourceVideo = !!mediaInfo.video_codec;
  const isAudioOnly =
    options?.no_video ||
    (!isSourceVideo && !options?.video_codec);

  // ── Codec ──────────────────────────────────────────────────────────────
  let codec: string;
  if (isAudioOnly) {
    codec = getCodecLabel(options?.audio_codec, false);
  } else {
    codec = getCodecLabel(options?.video_codec, true);
  }

  // ── Resolution ─────────────────────────────────────────────────────────
  let resolution: string;
  if (options?.resolution && options.resolution !== "original") {
    resolution = options.resolution; // e.g. "1920x1080"
  } else if (mediaInfo.width && mediaInfo.height) {
    resolution = `${mediaInfo.width}x${mediaInfo.height}`;
  } else {
    resolution = "—";
  }

  // ── Duration (with trimming) ───────────────────────────────────────────
  let duration: string;
  if (options?.start_time || options?.end_time) {
    const startSecs = options.start_time
      ? parseTimeToSeconds(options.start_time)
      : 0;
    const endSecs = options.end_time
      ? parseTimeToSeconds(options.end_time)
      : mediaInfo.duration;
    const trimmedSecs = Math.max(0, endSecs - startSecs);
    duration = formatDuration(trimmedSecs);
  } else {
    duration = mediaInfo.duration_str || formatDuration(mediaInfo.duration);
  }

  return { codec, resolution, duration };
}

// ─────────────────────────────────────────────────────────────────────────────

interface VideoPreviewProps {
  filePath: string | null;
  mediaInfo: MediaInfo | null;
  options?: ConversionOptions;
}

export function VideoPreview({ filePath, mediaInfo, options }: VideoPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const requestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFrame = useCallback(async (time: number) => {
    if (!filePath) return;
    setIsLoading(true);
    try {
      const base64 = await api.getThumbnail(filePath, time, options);
      setThumbnail(base64);
      setError(null);
    } catch (err) {
      console.error("Frame fetch error:", err);
      setError("Failed to extract frame.");
    } finally {
      setIsLoading(false);
    }
  }, [filePath, options]);

  useEffect(() => {
    setError(null);
    setThumbnail(null);
    setCurrentTime(0);
    setIsLoading(false);

    if (filePath) {
      fetchFrame(0);
    }
  }, [filePath, fetchFrame]);

  if (!filePath) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full rounded-xl border-2 border-dashed"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span className="text-4xl mb-2" style={{ opacity: 0.3 }}>🎬</span>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Select a video to preview
        </p>
      </div>
    );
  }

  const isVideo = mediaInfo?.video_codec !== undefined;
  const duration = mediaInfo?.duration || 0;

  const outputMeta = useMemo(
    () => getOutputMetadata(mediaInfo, options),
    [mediaInfo, options],
  );

  const handleOpenSystem = async () => {
    try {
      await openPath(filePath);
    } catch (err) {
      console.error("Failed to open file:", err);
      setError(`System player error: ${err}`);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);

    // Debounce FFmpeg requests
    if (requestTimeout.current) clearTimeout(requestTimeout.current);
    requestTimeout.current = setTimeout(() => {
      fetchFrame(time);
    }, 50);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border group/preview"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex-1 bg-black flex items-center justify-center min-h-0 relative overflow-hidden">
        {/* Universal Frame Preview */}
        {thumbnail ? (
          <img 
            src={thumbnail} 
            className={`w-full h-full object-contain transition-opacity duration-200 ${isLoading ? 'opacity-70' : 'opacity-100'}`}
            alt="Frame Preview"
          />
        ) : (
          <div className="text-center p-6">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-accent rounded-full mb-4" role="status">
              <span className="sr-only">Loading...</span>
            </div>
            <p className="text-sm text-white/50">Extracting frame...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center p-6">
              <span className="text-3xl block mb-2">⚠️</span>
              <p className="text-sm font-medium text-white mb-4 max-w-xs">
                {error}
              </p>
              <button
                onClick={handleOpenSystem}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors border border-white/20"
              >
                Open in System Player
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && thumbnail && (
          <div className="absolute top-4 right-4 z-30">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      <div className="p-4 border-t" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
        {isVideo && duration > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest">Universal Scrubber</span>
              <span className="text-xs font-mono text-white/70">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <input 
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent hover:accent-accent-light transition-all"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold truncate mb-1" style={{ color: "var(--text)" }}>
              {filePath.split(/[\\/]/).pop()}
            </h3>
            {outputMeta && (
              <div className="mt-2">
                <span
                  className="text-[9px] font-semibold uppercase tracking-widest mb-1 block"
                  style={{ color: "var(--accent)" }}
                >
                  Encoding
                </span>
                <div className="flex flex-wrap gap-2">
                  <InfoChip label="Codec" value={outputMeta.codec} />
                  <InfoChip label="Size" value={outputMeta.resolution} />
                  <InfoChip label="Duration" value={outputMeta.duration} />
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleOpenSystem}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
            title="Open in System Player"
            style={{ color: "var(--muted)" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider flex flex-col" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}
