// All supported output formats / presets
export interface FormatPreset {
  ext: string;
  label: string;
  description: string;
  isAudioOnly: boolean;
  defaults: {
    video_codec?: string;
    audio_codec?: string;
    crf?: number;
    preset?: string;
    audio_bitrate?: string;
  };
}

export const OUTPUT_FORMATS: FormatPreset[] = [
  {
    ext: "mp4",
    label: "MP4",
    description: "Most compatible video format. Works everywhere.",
    isAudioOnly: false,
    defaults: {
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 23,
      preset: "medium",
      audio_bitrate: "192k",
    },
  },
  {
    ext: "mp4-h265",
    label: "MP4 (H.265)",
    description:
      "H.265/HEVC — smaller files than H.264 at same quality, less CPU intensive to decode but requires newer devices.",
    isAudioOnly: false,
    defaults: {
      video_codec: "libx265",
      audio_codec: "aac",
      crf: 28,
      preset: "medium",
      audio_bitrate: "192k",
    },
  },
  {
    ext: "webm",
    label: "WebM",
    description: "Open web format using VP9. Great for web embedding.",
    isAudioOnly: false,
    defaults: {
      video_codec: "libvpx-vp9",
      audio_codec: "libopus",
      crf: 33,
      audio_bitrate: "128k",
    },
  },
  {
    ext: "mkv",
    label: "MKV",
    description:
      "Matroska container — supports almost any codec. Great for archival.",
    isAudioOnly: false,
    defaults: {
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 23,
      preset: "medium",
    },
  },
  {
    ext: "avi",
    label: "AVI",
    description: "Legacy format with wide compatibility for older software.",
    isAudioOnly: false,
    defaults: { video_codec: "libx264", audio_codec: "mp3", crf: 23 },
  },
  {
    ext: "mov",
    label: "MOV",
    description: "Apple QuickTime format. Best for macOS/iOS workflows.",
    isAudioOnly: false,
    defaults: {
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 23,
      preset: "medium",
    },
  },
  {
    ext: "gif",
    label: "GIF",
    description: "Animated GIF. No audio. Best for short clips under 10s.",
    isAudioOnly: false,
    defaults: { video_codec: "gif", audio_codec: undefined, crf: undefined },
  },
  {
    ext: "mp3",
    label: "MP3",
    description: "Most compatible audio format. Strips video.",
    isAudioOnly: true,
    defaults: { audio_codec: "libmp3lame", audio_bitrate: "320k" },
  },
  {
    ext: "aac",
    label: "AAC",
    description: "High-quality audio codec. Used in MP4 containers.",
    isAudioOnly: true,
    defaults: { audio_codec: "aac", audio_bitrate: "256k" },
  },
  {
    ext: "flac",
    label: "FLAC",
    description: "Lossless audio compression. Perfect quality, larger files.",
    isAudioOnly: true,
    defaults: { audio_codec: "flac" },
  },
  {
    ext: "wav",
    label: "WAV",
    description: "Uncompressed audio. Maximum quality, large files.",
    isAudioOnly: true,
    defaults: { audio_codec: "pcm_s16le" },
  },
  {
    ext: "ogg",
    label: "OGG",
    description: "Open-source audio format using Vorbis codec.",
    isAudioOnly: true,
    defaults: { audio_codec: "libvorbis", audio_bitrate: "192k" },
  },
  {
    ext: "opus",
    label: "Opus",
    description:
      "Modern efficient audio codec. Best quality-per-bit for streaming.",
    isAudioOnly: true,
    defaults: { audio_codec: "libopus", audio_bitrate: "128k" },
  },
];

// Simple mode quick presets
export interface QuickPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  build: (inputExt: string) => Partial<{
    format: string;
    video_codec: string;
    audio_codec: string;
    crf: number;
    preset: string;
    audio_bitrate: string;
    no_video: boolean;
    resolution: string;
  }>;
}

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "extract-audio",
    label: "Extract Audio",
    description:
      "Pull the audio track out as MP3 (320kbps). Fast — no re-encoding of video needed.",
    icon: "♪",
    build: () => ({
      format: "mp3",
      audio_codec: "libmp3lame",
      audio_bitrate: "320k",
      no_video: true,
    }),
  },
  {
    id: "compress-web",
    label: "Compress for Web",
    description:
      "Shrink the video for web upload. H.264 MP4, CRF 28, 720p max. Good balance of size and quality.",
    icon: "📦",
    build: () => ({
      format: "mp4",
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 28,
      preset: "slow",
      resolution: "1280x720",
      audio_bitrate: "128k",
    }),
  },
  {
    id: "compress-small",
    label: "Max Compression",
    description:
      "Smallest file size possible. H.265, CRF 32, 480p. May take longer to encode.",
    icon: "🗜",
    build: () => ({
      format: "mp4",
      video_codec: "libx265",
      audio_codec: "aac",
      crf: 32,
      preset: "slow",
      resolution: "854x480",
      audio_bitrate: "96k",
    }),
  },
  {
    id: "keep-quality",
    label: "High Quality",
    description:
      "Keep near-original quality. H.264, CRF 18, original resolution. Larger output file.",
    icon: "⭐",
    build: () => ({
      format: "mp4",
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 18,
      preset: "slow",
      audio_bitrate: "320k",
    }),
  },
  {
    id: "to-gif",
    label: "To GIF",
    description:
      "Convert to GIF. Best for short clips. Keeps first 10 seconds, 480px wide, 15fps.",
    icon: "🎞",
    build: () => ({ format: "gif", video_codec: "gif", no_video: false }),
  },
  {
    id: "remux",
    label: "Fast Remux",
    description:
      "Change container without re-encoding. Instantaneous — just rewraps the streams.",
    icon: "⚡",
    build: (inputExt) => ({
      format: inputExt === "mp4" ? "mkv" : "mp4",
      video_codec: "copy",
      audio_codec: "copy",
    }),
  },
  // ── GPU Hardware Presets ─────────────────────────────────────────────────
  {
    id: "nvenc-h264",
    label: "NVENC H.264",
    description:
      "NVIDIA GPU H.264 via NVENC + CUDA. Insanely fast — full VRAM pipeline (NVDEC decode → NVENC encode), no CPU copies. Requires NVIDIA GTX/RTX.",
    icon: "🟢",
    build: () => ({
      format: "mp4",
      video_codec: "h264_nvenc",
      audio_codec: "aac",
      crf: 23,
      preset: "slow",
      audio_bitrate: "192k",
    }),
  },
  {
    id: "nvenc-hevc",
    label: "NVENC H.265",
    description:
      "NVIDIA GPU H.265 via NVENC. 50% smaller than H.264 at the same GPU encode speed. Best for storage/archival. Requires NVIDIA GTX/RTX.",
    icon: "🚀",
    build: () => ({
      format: "mp4",
      video_codec: "hevc_nvenc",
      audio_codec: "aac",
      crf: 26,
      preset: "slow",
      audio_bitrate: "192k",
    }),
  },
  {
    id: "amd-amf",
    label: "AMD AMF",
    description:
      "AMD GPU H.264 via AMF hardware encoder. Hardware decode (D3D11VA) + hardware encode using AMD's dedicated VCE cores. Requires AMD Radeon GPU.",
    icon: "🔴",
    build: () => ({
      format: "mp4",
      video_codec: "h264_amf",
      audio_codec: "aac",
      crf: 23,
      preset: "slow",
      audio_bitrate: "192k",
    }),
  },
];

// Video codecs for advanced panel
export const VIDEO_CODECS = [
  {
    value: "libx264",
    label: "H.264 (libx264)",
    description:
      "Most compatible. Hardware accelerated on most devices. Great default choice.",
  },
  {
    value: "libx265",
    label: "H.265 / HEVC (libx265)",
    description:
      "50% smaller than H.264 at same quality. Slower encoding. Requires newer devices to play.",
  },
  {
    value: "libvpx-vp9",
    label: "VP9 (libvpx-vp9)",
    description:
      "Open source competitor to H.265. Great for web. Slower encoding.",
  },
  {
    value: "libav1",
    label: "AV1 (libaom-av1)",
    description:
      "Next-gen codec. Best compression ratio but very slow encoding (10x slower than H.264).",
  },
  // ── NVIDIA NVENC ──────────────────────────────────────────────────────────
  {
    value: "h264_nvenc",
    label: "H.264 NVENC 🟢 NVIDIA GPU",
    description:
      "NVIDIA hardware H.264 encoding via NVENC. Insanely fast — uses dedicated encode silicon + NVDEC decode on VRAM. Requires NVIDIA GTX 10xx / RTX or newer.",
  },
  {
    value: "hevc_nvenc",
    label: "H.265 NVENC 🟢 NVIDIA GPU",
    description:
      "NVIDIA hardware H.265/HEVC encoding. 50% smaller files than H.264 at the same GPU speed. Requires NVIDIA GTX 10xx / RTX or newer.",
  },
  // ── AMD AMF ──────────────────────────────────────────────────────────────
  {
    value: "h264_amf",
    label: "H.264 AMF 🔴 AMD GPU",
    description:
      "AMD hardware H.264 encoding via AMF/VCE. Full hardware decode+encode pipeline using AMD's dedicated video cores. Requires AMD Radeon RX 400 or newer.",
  },
  {
    value: "hevc_amf",
    label: "H.265 AMF 🔴 AMD GPU",
    description:
      "AMD hardware H.265 encoding via AMF. Requires AMD Radeon RX 400 series or newer GPU.",
  },
  // ── Intel Quick Sync ─────────────────────────────────────────────────────
  {
    value: "h264_qsv",
    label: "H.264 QSV 🔵 Intel GPU",
    description:
      "Intel Quick Sync Video H.264 encoding. Very fast using Intel's built-in GPU encoder. Requires Intel HD/Iris/Arc GPU (6th gen+).",
  },
  {
    value: "hevc_qsv",
    label: "H.265 QSV 🔵 Intel GPU",
    description:
      "Intel Quick Sync Video H.265 encoding. Requires Intel Skylake (6th gen) or newer with QSV support.",
  },
  {
    value: "copy",
    label: "Copy (no re-encode)",
    description:
      "Copy the video stream as-is. Fastest option — no quality loss.",
  },
];

export const AUDIO_CODECS = [
  {
    value: "aac",
    label: "AAC",
    description: "Default for MP4. High quality, widely supported.",
  },
  {
    value: "libmp3lame",
    label: "MP3 (libmp3lame)",
    description:
      "Universal audio format. Slightly lower quality than AAC at same bitrate.",
  },
  {
    value: "libopus",
    label: "Opus",
    description: "Best quality per bit. Excellent for streaming and VoIP.",
  },
  {
    value: "libvorbis",
    label: "Vorbis",
    description: "Open source audio codec. Used in OGG/WebM containers.",
  },
  {
    value: "flac",
    label: "FLAC",
    description: "Lossless compression. Perfect quality, 50-60% of WAV size.",
  },
  {
    value: "pcm_s16le",
    label: "PCM 16-bit (WAV)",
    description: "Uncompressed audio. Maximum quality, ~10MB/min.",
  },
  {
    value: "copy",
    label: "Copy (no re-encode)",
    description:
      "Copy audio stream without re-encoding. No quality loss, fastest.",
  },
];

export const PRESETS = [
  {
    value: "ultrafast",
    label: "Ultrafast",
    description: "Fastest encoding, lowest compression. Largest output.",
  },
  {
    value: "superfast",
    label: "Superfast",
    description: "Very fast, slightly better compression.",
  },
  {
    value: "veryfast",
    label: "Veryfast",
    description: "Fast encode with decent compression.",
  },
  {
    value: "faster",
    label: "Faster",
    description: "Good speed with good compression.",
  },
  {
    value: "fast",
    label: "Fast",
    description: "Decent speed, good compression.",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Default. Balanced speed and compression.",
  },
  {
    value: "slow",
    label: "Slow",
    description: "Better compression, slower encode. Recommended for archival.",
  },
  {
    value: "slower",
    label: "Slower",
    description: "Even better compression, significantly slower.",
  },
  {
    value: "veryslow",
    label: "Veryslow",
    description:
      "Maximum compression, very slow. Use only when file size is critical.",
  },
];

export const RESOLUTIONS = [
  { value: "original", label: "Original" },
  { value: "3840x2160", label: "4K (3840×2160)" },
  { value: "1920x1080", label: "1080p (1920×1080)" },
  { value: "1280x720", label: "720p (1280×720)" },
  { value: "854x480", label: "480p (854×480)" },
  { value: "640x360", label: "360p (640×360)" },
  { value: "426x240", label: "240p (426×240)" },
];

export const AUDIO_BITRATES = [
  { value: "320k", label: "320 kbps (High)" },
  { value: "256k", label: "256 kbps" },
  { value: "192k", label: "192 kbps (Standard)" },
  { value: "128k", label: "128 kbps" },
  { value: "96k", label: "96 kbps" },
  { value: "64k", label: "64 kbps (Low)" },
];

export const SAMPLE_RATES = [
  { value: 48000, label: "48000 Hz (Video standard)" },
  { value: 44100, label: "44100 Hz (CD quality)" },
  { value: 22050, label: "22050 Hz" },
  { value: 16000, label: "16000 Hz" },
  { value: 8000, label: "8000 Hz (Phone quality)" },
];
