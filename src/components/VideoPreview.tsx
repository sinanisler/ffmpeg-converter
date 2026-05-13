import { MediaInfo } from "../api";
import { convertFileSrc } from "@tauri-apps/api/core";

interface VideoPreviewProps {
  filePath: string | null;
  mediaInfo: MediaInfo | null;
}

export function VideoPreview({ filePath, mediaInfo }: VideoPreviewProps) {
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
  const assetUrl = convertFileSrc(filePath);

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex-1 bg-black flex items-center justify-center min-h-0">
        {isVideo ? (
          <video
            key={filePath}
            src={assetUrl}
            controls
            className="max-w-full max-h-full"
          />
        ) : (
          <div className="text-center p-8">
            <span className="text-4xl block mb-4">🎵</span>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Audio File
            </p>
            <audio
              key={filePath}
              src={assetUrl}
              controls
              className="mt-4 w-full"
            />
          </div>
        )}
      </div>
      
      <div className="p-4 border-t" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
        <h3 className="text-sm font-bold truncate mb-1" style={{ color: "var(--text)" }}>
          {filePath.split(/[\\/]/).pop()}
        </h3>
        {mediaInfo && (
          <div className="flex flex-wrap gap-2 mt-2">
            <InfoChip label="Format" value={mediaInfo.video_codec || mediaInfo.audio_codec || "Unknown"} />
            {mediaInfo.width && mediaInfo.height && (
              <InfoChip label="Size" value={`${mediaInfo.width}x${mediaInfo.height}`} />
            )}
            <InfoChip label="Duration" value={mediaInfo.duration_str} />
          </div>
        )}
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
