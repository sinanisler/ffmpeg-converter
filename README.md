# FFmpeg Converter 


<br>
<a href="https://github.com/sponsors/sinanisler">
<img src="https://img.shields.io/badge/Consider_Supporting_My_Projects_❤-GitHub-d46" width="280" height="auto" />
</a>
<br>


A native Windows desktop application that wraps FFmpeg with a clean, modern GUI.  
Convert video and audio files without touching a terminal — with full GPU hardware acceleration support.

---

## Features

### Core

- **Drag & drop or browse** to open any video/audio file
- **13 output formats** — MP4, MP4 H.265, WebM, MKV, AVI, MOV, GIF, MP3, AAC, FLAC, WAV, OGG, Opus
- **Live progress bar** — accurate percentage from file duration (via ffprobe)
- **Conversion stats** — FPS, encode speed, elapsed time, output size
- **Cancel** a running conversion at any time

### GPU Hardware Acceleration

| Vendor | Codec                      | What it uses                                                                                                    |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| NVIDIA | `h264_nvenc`, `hevc_nvenc` | NVDEC (decode) + NVENC encode silicon on the GPU die. Full zero-copy VRAM pipeline when no filters are applied. |
| AMD    | `h264_amf`, `hevc_amf`     | D3D11VA (decode) + AMF/VCE hardware encoder on the GPU die. CQP mode.                                           |
| Intel  | `h264_qsv`, `hevc_qsv`     | Intel Quick Sync Video — built-in encoder on Core iX CPUs.                                                      |
| CPU    | libx264, libx265, VP9, AV1 | All available CPU cores (`-threads 0`).                                                                         |

### Quick Presets (9 one-click cards)

| Preset           | Description                                |
| ---------------- | ------------------------------------------ |
| Extract Audio    | Lossless MP3 audio pull, no re-encode      |
| Compress for Web | H.264 720p, CRF 28                         |
| Max Compression  | H.265 480p, CRF 32                         |
| High Quality     | H.264 original res, CRF 18                 |
| To GIF           | Short clip to animated GIF                 |
| Fast Remux       | Change container without re-encoding       |
| 🟢 NVENC H.264   | NVIDIA GPU H.264 (p6 quality, adaptive-QC) |
| 🚀 NVENC H.265   | NVIDIA GPU H.265 — 50% smaller files       |
| 🔴 AMD AMF       | AMD GPU H.264 (CQP mode)                   |

### Advanced Options

- **Video**: codec, CRF/quality, preset, bitrate, resolution scale, FPS, strip video
- **Audio**: codec, bitrate, sample rate, channels, strip audio
- **Trim**: start/end time
- **Extra FFmpeg args**: raw passthrough for power users

### Debug Console

- Collapsible terminal panel at the bottom of the window
- Shows the exact FFmpeg command being run
- Streams every stderr line in real time (colour-coded: commands in blue, errors in red, progress in green)
- Max 500 lines, auto-scroll, Clear button

---

## How It Works

```
┌─────────────────────────────────────┐
│          React + TypeScript UI       │
│  (Vite dev server / Tauri WebView)   │
│                                     │
│  File drop → ffprobe → MediaInfo    │
│  Options → startConversion invoke   │
└──────────────┬──────────────────────┘
               │ Tauri IPC (invoke / emit)
┌──────────────▼──────────────────────┐
│         Rust Backend (lib.rs)        │
│                                     │
│  get_ffmpeg_status  → async thread  │
│  get_media_info     → ffprobe JSON  │
│  start_conversion   → FFmpeg spawn  │
│    • HW accel flags before -i       │
│    • stderr → ffmpeg://debug event  │
│    • stdout → conversion://progress │
│  cancel_conversion  → kill child    │
└──────────────┬──────────────────────┘
               │ child process
┌──────────────▼──────────────────────┐
│  ffmpeg / ffprobe (bundled ~191 MB) │
└─────────────────────────────────────┘
```

### NVENC full-GPU pipeline

```
Input file
  → NVDEC (GPU decode, frames stay in VRAM)
  → NVENC encode silicon (no CPU copy)
  → Output file
```

When scaling or FPS conversion is needed, frames transit through CPU for filtering, then back to NVENC — still much faster than pure CPU encoding.

---

## Requirements

### Runtime

- Windows 10/11 x64
- FFmpeg GPL static build — `ffmpeg.exe` and `ffprobe.exe` must be named with the target triple:
  - `ffmpeg-x86_64-pc-windows-msvc.exe`
  - `ffprobe-x86_64-pc-windows-msvc.exe`
- For GPU acceleration: NVIDIA drivers 522+, AMD Adrenalin 2023+, or Intel drivers with QSV

### Build Tools

| Tool             | Version     | Notes                                   |
| ---------------- | ----------- | --------------------------------------- |
| Node.js          | ≥ 20        |                                         |
| Rust + Cargo     | ≥ 1.75      | Install via [rustup](https://rustup.rs) |
| MSVC Build Tools | 2022        | VC++ workload + Windows 11 SDK          |
| Windows SDK      | 10.0.22000+ | Required by Rust/MSVC linker            |

---

## Build & Run

### 1. Clone and install

```powershell
git clone <repo-url>
cd ffmpeg-converter
npm install
```

### 2. Add FFmpeg binaries

Download the FFmpeg GPL static build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (`ffmpeg-release-full.7z`).  
Extract `ffmpeg.exe` and `ffprobe.exe`, then rename and place them:

```
src-tauri/binaries/
├── ffmpeg-x86_64-pc-windows-msvc.exe
└── ffprobe-x86_64-pc-windows-msvc.exe
```

### 3. Dev mode (hot-reload)

```powershell
npm run tauri dev
```

Or use **Ctrl+Shift+B** → `FFmpeg Converter: Dev (hot-reload)` in VS Code.

### 4. Production build

```powershell
npm run tauri build
```

Output installer: `src-tauri/target/release/bundle/nsis/`

### 5. Type-check only (fast)

```powershell
cd src-tauri
cargo check
```

---

## Environment Variables (MSVC)

If Cargo can't find the linker, set these in PowerShell before building:

```powershell
$msvc = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
$sdk  = "C:\Program Files (x86)\Windows Kits\10"
$ver  = "10.0.22000.0"

$env:PATH    = "C:\Program Files\nodejs;$msvc\bin\Hostx64\x64;$env:PATH;$env:USERPROFILE\.cargo\bin"
$env:LIB     = "$msvc\lib\x64;$sdk\Lib\$ver\ucrt\x64;$sdk\Lib\$ver\um\x64"
$env:INCLUDE = "$msvc\include;$sdk\Include\$ver\ucrt;$sdk\Include\$ver\um;$sdk\Include\$ver\shared"
```

These are pre-configured in `.vscode/tasks.json` and `.vscode/settings.json`.

---

## Project Structure

```
ffmpeg-converter/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component, state machine
│   ├── api.ts                  # Tauri invoke wrappers + TypeScript types
│   ├── presets.ts              # Output formats, quick presets, codec lists
│   ├── index.css               # Tailwind + CSS custom properties (light mode)
│   └── components/
│       ├── FileDropZone.tsx    # Drag-drop / click-to-pick file input
│       ├── FormatSelector.tsx  # Format button grid
│       ├── QuickPresets.tsx    # 9 one-click preset cards (incl. GPU presets)
│       ├── AdvancedOptions.tsx # Collapsible panel (video/audio/trim/extra)
│       ├── ProgressPanel.tsx   # Progress bar + stats + cancel/done
│       ├── DebugConsole.tsx    # Collapsible FFmpeg stderr terminal
│       └── Tooltip.tsx         # Hover tooltip (fixed position, 400ms delay)
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # All Rust logic (commands, GPU accel, events)
│   │   └── main.rs             # Entry point
│   ├── binaries/               # FFmpeg static binaries (target-triple suffix)
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 permission declarations
│   ├── Cargo.toml
│   └── tauri.conf.json
└── .vscode/
    ├── tasks.json              # 6 build tasks (all include MSVC env vars)
    └── settings.json           # rust-analyzer + terminal env
```

---

## Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Desktop shell | Tauri 2 (Rust)                                          |
| Frontend      | React 18 + TypeScript + Vite                            |
| Styling       | Tailwind CSS v4 (`@tailwindcss/vite`) — light mode only |
| Backend / IPC | Rust (`lib.rs`)                                         |
| FFmpeg        | GPL static build, bundled in `src-tauri/binaries/`      |

---

## Adding a New Output Format

Edit `OUTPUT_FORMATS` in `src/presets.ts`:

```typescript
{
  ext: "format_ext",
  label: "Display Name",
  description: "Tooltip shown on hover",
  isAudioOnly: false,
  defaults: { video_codec: "libx264", audio_codec: "aac", crf: 23, preset: "medium" }
}
```

## Adding a New Quick Preset

Edit `QUICK_PRESETS` in `src/presets.ts`:

```typescript
{
  id: "unique-id",
  label: "Short Name",
  icon: "🎵",
  description: "What this preset does",
  build: (inputExt: string) => ({ format: "mp4", video_codec: "copy", ... })
}
```

---

## Known Limitations

- Windows only (macOS/Linux would need binary naming + path resolution changes)
- Hardware presets assume driver support — if NVENC/AMF fails, check the Debug Console for the FFmpeg error
- NVENC `p1`–`p7` presets require NVIDIA GTX 16xx / RTX or newer (NVENC SDK 10+)
- Batch conversion not yet implemented (one file at a time)
