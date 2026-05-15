# AGENTS.md — Project Memory for AI Assistants

> **Read this file at the start of every session.** It contains the full
> history, architecture decisions, known pitfalls, and pending work for the
> FFmpeg Converter project.
  
---

## 1. What Is This Project?

**FFmpeg Converter** is a native Windows desktop application that wraps FFmpeg
with a clean, user-friendly GUI. Users can convert video/audio files without
touching a terminal.

| Layer         | Technology                                                  |
| ------------- | ----------------------------------------------------------- |
| Desktop shell | Tauri 2 (Rust)                                              |
| Frontend      | React 18 + TypeScript + Vite                                |
| Styling       | Tailwind CSS v4 (`@tailwindcss/vite`) — **light mode only** |
| Backend / IPC | Rust (`src-tauri/src/lib.rs`)                               |
| FFmpeg        | GPL static build bundled in `src-tauri/binaries/`           |

---

## 2. Repository Layout

```
ffmpeg-converter/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component, state machine, event wiring
│   ├── api.ts                  # Tauri invoke wrappers + TypeScript interfaces
│   ├── presets.ts              # OUTPUT_FORMATS, QUICK_PRESETS, codecs lists
│   ├── index.css               # Tailwind import + CSS custom properties (light)
│   └── components/
│       ├── FileDropZone.tsx    # Drag-drop / click-to-pick file input
│       ├── FormatSelector.tsx  # Grid of format buttons (video + audio)
│       ├── QuickPresets.tsx    # 6 one-click preset cards
│       ├── AdvancedOptions.tsx # Collapsible panel (video/audio/trim/extra)
│       ├── ProgressPanel.tsx   # Progress bar + stats + cancel/done states
│       └── Tooltip.tsx         # Hover tooltip (fixed-position, 400 ms delay)
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # All Rust logic (commands, FFmpeg spawn, events)
│   │   └── main.rs             # Entry point — calls ffmpeg_converter_lib::run()
│   ├── binaries/               # FFmpeg static binaries (MUST have target-triple suffix)
│   │   ├── ffmpeg-x86_64-pc-windows-msvc.exe   (~191 MB)
│   │   └── ffprobe-x86_64-pc-windows-msvc.exe  (~191 MB)
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 permission declarations
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── .vscode/
│   ├── tasks.json              # 6 VS Code build tasks (all include MSVC env vars)
│   ├── launch.json             # F5 launch config
│   ├── settings.json           # rust-analyzer env, terminal env (LIB/INCLUDE/PATH)
│   └── extensions.json
├── AGENTS.md                   ← this file
└── README.md
```

---

## 3. Rust Backend (`lib.rs`) — Key Facts

### Tauri Commands (all in `pub mod commands { … }`)

Wrapped in a submodule to avoid E0255 macro namespace collision with
`crate-type = ["staticlib", "cdylib", "rlib"]`.

| Command             | Description                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_ffmpeg_status` | Resolves binary paths, caches them in `AppState`. **Non-blocking** — version string is emitted async via `ffmpeg://version` event to avoid freezing the UI on first Windows Defender scan of the 191 MB binary. |
| `get_media_info`    | Runs `ffprobe -print_format json -show_format -show_streams`. Returns `MediaInfo`.                                                                                                                              |
| `start_conversion`  | Spawns FFmpeg in a background thread. Accepts `input_duration_secs` from caller for accurate progress %. Emits `conversion://progress` and `conversion://done`.                                                 |
| `cancel_conversion` | Sets an `AtomicBool` flag that kills the child process.                                                                                                                                                         |

### Tauri Events emitted by Rust

| Event                   | Payload                                       | Purpose                                                 |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `ffmpeg://version`      | `{ version: string \| null }`                 | Async FFmpeg version string after startup               |
| `ffmpeg://debug`        | `{ level: "cmd"\|"stderr", job_id, message }` | Full FFmpeg command + every stderr line → debug console |
| `conversion://progress` | `ProgressEvent`                               | Live progress (percent, fps, speed, size_kb, out_time)  |
| `conversion://done`     | `ConversionDoneEvent`                         | Success/failure + output path                           |

### Progress % Calculation

FFmpeg's `-progress pipe:1` output **never** reliably emits a `duration=` key.
The fix: `ConversionJob` now carries `input_duration_secs: f64` (from `MediaInfo.duration`
populated by ffprobe). The backend computes:

```
percent = (out_time_us / (input_duration_secs * 1_000_000)) * 100
```

### AppState

```rust
pub struct AppState {
    pub active_jobs: Arc<Mutex<HashMap<String, AtomicBool>>>,
    pub ffmpeg_path:  Mutex<Option<PathBuf>>,
    pub ffprobe_path: Mutex<Option<PathBuf>>,
}
```

### Binary Resolution Order (`resolve_binary`)

1. Same dir as `.exe`
2. `<exe_dir>/binaries/`
3. Tauri resource dir / `binaries/`
4. Dev path: `src-tauri/binaries/<name>-x86_64-pc-windows-msvc.exe`
5. System `PATH` via `where <name>`

---

## 4. Frontend — Key Facts

### State Machine (`App.tsx`)

```
idle ──[convert]──► converting ──[done event]──► done
                              └──[error]──────► error
     ◄──────────────────────────────[new conversion]
```

### `api.ts` — Important: `ConversionJob` needs `input_duration_secs`

The TypeScript `ConversionJob` interface **must** include `input_duration_secs: number`
(added after the progress-bar fix). When `startConversion` is called it passes
`mediaInfo.duration` as this field.

### CSS Theme — Light Mode Only (`index.css`)

The app uses CSS custom properties. The theme is **white/light only** — there is
no dark mode. Variables defined in `:root`:

```
--bg, --surface, --surface2, --border, --accent (#4f46e5),
--text, --muted, --success, --warning, --danger
```

### Output Formats (13 total in `presets.ts`)

Video: `mp4`, `mp4-h265`, `webm`, `mkv`, `avi`, `mov`, `gif`
Audio: `mp3`, `aac`, `flac`, `wav`, `ogg`, `opus`

### Quick Presets (6 in `presets.ts`)

`extract-audio`, `compress-web`, `compress-small`, `keep-quality`, `to-gif`, `remux`

### Debug Console

A collapsible terminal-style panel pinned to the bottom of the window.

- Toggle with the **`> Debug Console`** button in the footer.
- Receives `ffmpeg://debug` events (full command + all stderr lines).
- Displays `ffmpeg://version` on startup.
- Max 500 lines, auto-scrolls, colour-coded by level.
- "Clear" button included.

---

## 5. Tauri Capabilities (`capabilities/default.json`)

```json
"permissions": [
  "core:default",
  "core:event:allow-listen",
  "core:event:allow-emit",
  "opener:default",
  "opener:allow-reveal-item-in-dir",
  "opener:allow-open-path",
  "dialog:allow-open",
  "dialog:allow-save",
  "fs:read-all",
  "fs:write-all",
  "fs:allow-exists",
  "shell:allow-execute",
  "shell:allow-spawn",
  "shell:allow-kill"
]
```

**Watch out:** permission IDs use `fs:read-all` / `fs:write-all` (NOT
`fs:allow-read-all`). Wrong names cause a silent build failure.

---

## 6. Build Environment (Windows)

### Required Toolchain

| Tool             | Version           | Location                                                          |
| ---------------- | ----------------- | ----------------------------------------------------------------- |
| Node.js          | v24.14.0          | `C:\Program Files\nodejs\`                                        |
| Rust / Cargo     | 1.94.0            | `%USERPROFILE%\.cargo\bin\`                                       |
| MSVC Build Tools | 2022 v14.44.35207 | `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\` |
| Windows SDK      | 10.0.22000.0      | `C:\Program Files (x86)\Windows Kits\10\`                         |

### Required Environment Variables for Rust Build

```powershell
$msvc = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
$sdk  = "C:\Program Files (x86)\Windows Kits\10"
$ver  = "10.0.22000.0"

$env:PATH    = "C:\Program Files\nodejs;$msvc\bin\Hostx64\x64;$env:PATH;$env:USERPROFILE\.cargo\bin"
$env:LIB     = "$msvc\lib\x64;$sdk\Lib\$ver\ucrt\x64;$sdk\Lib\$ver\um\x64"
$env:INCLUDE = "$msvc\include;$sdk\Include\$ver\ucrt;$sdk\Include\$ver\um;$sdk\Include\$ver\shared"
```

These are baked into `.vscode/tasks.json` and `.vscode/settings.json`.

### Build Commands

```powershell
# Dev with hot-reload (Ctrl+Shift+B → "FFmpeg Converter: Dev (hot-reload)")
npm run tauri dev

# Production installer
npm run tauri build

# Fast Rust type check only
cd src-tauri; cargo check

# Frontend only (no Tauri)
npm run dev
```

---

## 7. Known Issues & Pitfalls

| Issue                           | Root Cause                                                                                                     | Fix                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **E0255 macro collision**       | `crate-type` includes both `cdylib` and `rlib`, so `#[tauri::command]` macros conflict in the top-level module | All `#[tauri::command]` fns wrapped in `pub mod commands { … }` — `generate_handler!` must use `commands::fn_name`                   |
| **First-launch freeze**         | Windows Defender scans the 191 MB `ffmpeg.exe` when first executed, blocking the main thread                   | `get_ffmpeg_status` no longer runs `ffmpeg -version` synchronously; version is obtained in a background thread and emitted via event |
| **Progress bar stuck at 0%**    | FFmpeg's `-progress pipe:1` never reliably emits `duration=` on stdout                                         | `ConversionJob.input_duration_secs` field passes duration from ffprobe; backend uses it directly                                     |
| **Binaries not found by Tauri** | Tauri's `externalBin` requires the binary filename to include the target triple                                | Binaries MUST be named `ffmpeg-x86_64-pc-windows-msvc.exe`, not `ffmpeg.exe`                                                         |
| **Wrong fs permission names**   | Tauri v2 uses `fs:read-all` not `fs:allow-read-all`                                                            | Use exact identifiers from the error output                                                                                          |
| **Port 1420 in use**            | Previous dev server not properly terminated                                                                    | Kill all `node.exe` processes before re-running `npm run tauri dev`                                                                  |

---

## 8. Session History

### Session 1 — Full project build from scratch

- Installed Node.js v24.14.0 and Rust 1.94.0 via winget
- Scaffolded Tauri + React + TypeScript project
- Installed Tailwind CSS v4 (`@tailwindcss/vite`)
- Downloaded FFmpeg GPL static build (~191 MB each for ffmpeg + ffprobe)
- Wrote all Rust backend code in `lib.rs`
- Wrote all React frontend code (App + 6 components + api.ts + presets.ts)
- Configured `tauri.conf.json`, `capabilities/default.json`

### Session 2 — VS Code build setup + MSVC toolchain

- Created `.vscode/tasks.json` (6 tasks), `launch.json`, `settings.json`, `extensions.json`
- Installed VS Build Tools 2022 + Windows SDK 10.0.22000.0 via winget
- Fixed all compilation errors:
  - E0255 macro conflict → `pub mod commands {}`
  - Binary naming → added target triple suffix
  - Permission names → `fs:read-all` not `fs:allow-read-all`
  - `opener:default` missing → added `tauri-plugin-opener` to Cargo.toml + lib.rs
- **First successful `npm run tauri dev` build and launch**

### Session 4 — Dark mode, multi-file queue, UX polish

- **Dark mode as default** — `index.css` rewritten with CSS custom properties for dark (default) and light theme. Baby-blue accent (`#60a5fa` dark / `#3b82f6` light). All hardcoded hex colors replaced with CSS vars across every component.
- **Theme toggle** — "☀ Light / ☾ Dark" button added to header top-right. `data-theme="light"` attribute applied to root div when toggled.
- **Max width 1400 px** — `main` container changes from `max-w-3xl` to `style={{ maxWidth: 1400 }}`.
- **Base font 16 px** — `font-size: 16px` set on `body` in `index.css`.
- **Tooltip fix** — `Tooltip.tsx` captured `e.currentTarget` as `target` before the `setTimeout` so it isn't null when the delay fires (React clears `currentTarget` after event handler returns).
- **Debug console text selectable** — Added `userSelect: "text"` / `WebkitUserSelect: "text"` to the log area div in `DebugConsole.tsx`.
<!-- - **Quick presets compact** — Removed emoji icons from preset buttons in `QuickPresets.tsx`; now text-only compact pills. -->
- **Multi-file queue** — Complete rewrite of `App.tsx` and `FileDropZone.tsx`:
  - `FileDropZone` now accepts `multiple: true` and calls `onFilesAdded(paths: string[])`.
  - `App.tsx` introduces `QueueItem[]` state with statuses `loading | pending | converting | done | error`.
  - Files load `MediaInfo` concurrently after being added.
  - "Convert All (N files)" button starts sequential conversions via `startNextConversion` → auto-advance on `onDone`.
  - Cancel reverts converting item to `pending` and stops auto-advance.
  - Per-item output path editable via "edit" button (opens Tauri `save` dialog).
  - Queue list shows filename, resolution/duration chips, progress bar (while converting), Reveal button (when done).
- **ProgressPanel redesign** — Multi-file aware: shows "File X of Y", live queue summary (done/errors), and a results list with Reveal buttons when all finished.
- **Advanced Options tooltips** — Already-populated tooltips now work after the `Tooltip.tsx` `currentTarget` fix.

- **Startup freeze** → `get_ffmpeg_status` made non-blocking (async version via event)
- **Progress bar fix** → `ConversionJob` gains `input_duration_secs` field; progress uses it
- **Debug console** → bottom collapsible panel receiving `ffmpeg://debug` events
- **Light mode** → CSS theme converted to white/light palette throughout all components
- **UX improvements** → (file size estimate, recent files, keyboard shortcuts, etc.)
- **README.md** created with full user + developer documentation
- **AGENTS.md** created (this file)

---

## 9. Pending / Future Work

- [ ] **Recent files list** — persist last 10 input files to localStorage / Tauri store
- [ ] **Batch conversion** — queue multiple files
- [ ] **Drag-and-drop from Explorer** — Tauri's `drag-drop` event (currently only works for files already on disk)
- [ ] **Estimated output size** — show prediction before converting based on bitrate × duration
- [ ] **Hardware acceleration** — expose NVENC / QSV / AMF codecs in the codec dropdown
- [ ] **Progress ETA** — calculate estimated time remaining from speed field
- [ ] **App icon** — replace placeholder Tauri icons with a proper converter icon
- [ ] **Auto-update** — Tauri updater plugin
- [ ] **macOS / Linux support** — binary naming and path resolution need platform branches

---

## 10. Important Code Snippets to Remember

### Adding a new Tauri command

1. Add function in `pub mod commands { … }` in `lib.rs` with `#[tauri::command]`
2. Register it in `generate_handler![commands::my_fn]` in `run()`
3. Add TypeScript wrapper in `api.ts` using `invoke("my_fn", { … })`
4. Add any new permissions to `capabilities/default.json`

### Adding a new output format

Edit `OUTPUT_FORMATS` array in `src/presets.ts` — each entry is a `FormatPreset`:

```typescript
{
  ext: "format_ext",
  label: "Display Name",
  description: "Tooltip text shown on hover",
  isAudioOnly: false,
  defaults: { video_codec: "libx264", audio_codec: "aac", crf: 23, preset: "medium" }
}
```

### Adding a new quick preset

Edit `QUICK_PRESETS` array in `src/presets.ts`:

```typescript
{
  id: "unique-id",
  label: "Short Name",
  icon: "🎵",
  description: "What this preset does",
  build: (inputExt: string) => ({ format: "mp4", video_codec: "copy", … })
}
```
