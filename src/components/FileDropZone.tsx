import React, { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface FileDropZoneProps {
  onFilesAdded: (paths: string[]) => void;
  compact?: boolean;
}

export function FileDropZone({
  onFilesAdded,
  compact = false,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const openFilePicker = async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Video / Audio",
          extensions: [
            "mp4",
            "mkv",
            "avi",
            "mov",
            "webm",
            "flv",
            "wmv",
            "m4v",
            "ts",
            "mp3",
            "aac",
            "flac",
            "wav",
            "ogg",
            "m4a",
            "opus",
            "wma",
          ],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (Array.isArray(selected) && selected.length > 0) {
      onFilesAdded(selected);
    } else if (typeof selected === "string") {
      onFilesAdded([selected]);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const paths = files
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => !!p);
      if (paths.length > 0) onFilesAdded(paths);
    },
    [onFilesAdded],
  );

  if (compact) {
    return (
      <button
        onClick={openFilePicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium transition-all"
        style={{
          background: dragging ? "var(--accent-glow)" : "var(--surface)",
          border: `1px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          color: "var(--accent)",
          cursor: "pointer",
        }}
      >
        <span className="text-lg font-bold">+</span>
        <span>Add more files</span>
      </button>
    );
  }

  return (
    <div
      onClick={openFilePicker}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none"
      style={{
        minHeight: 160,
        border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
        background: dragging ? "var(--accent-glow)" : "var(--surface)",
      }}
    >
      <div className="text-4xl">📂</div>
      <div className="text-center">
        <div
          className="font-semibold text-base"
          style={{ color: "var(--text)" }}
        >
          Drop files or click to browse
        </div>
        <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Select multiple files to queue them for conversion
        </div>
        <div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          MP4, MKV, AVI, MOV, MP3, FLAC, WAV + more
        </div>
      </div>
    </div>
  );
}
