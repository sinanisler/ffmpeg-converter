use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaInfo {
    pub duration: f64,
    pub duration_str: String,
    pub size: u64,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<String>,
    pub video_bitrate: Option<String>,
    pub audio_bitrate: Option<String>,
    pub sample_rate: Option<String>,
    pub channels: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversionOptions {
    pub format: String,
    pub video_codec: Option<String>,
    pub crf: Option<u32>,
    pub preset: Option<String>,
    pub video_bitrate: Option<String>,
    pub resolution: Option<String>,
    pub fps: Option<String>,
    pub video_filter: Option<String>,
    pub brightness: Option<f64>,
    pub contrast: Option<f64>,
    pub saturation: Option<f64>,
    pub gamma: Option<f64>,
    pub hue: Option<f64>,
    pub audio_codec: Option<String>,
    pub audio_bitrate: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub extra_args: Option<String>,
    pub no_video: Option<bool>,
    pub no_audio: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionJob {
    pub input_path: String,
    pub output_path: String,
    pub options: ConversionOptions,
    /// Duration of the input file in seconds (from ffprobe). Used for progress % calculation.
    pub input_duration_secs: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProgressEvent {
    pub job_id: String,
    pub percent: f64,
    pub fps: Option<f64>,
    pub speed: Option<String>,
    pub time_elapsed: Option<String>,
    pub size_kb: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ConversionDoneEvent {
    pub job_id: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
}

// ─── State ────────────────────────────────────────────────────────────────────

pub struct AppState {
    pub active_jobs: Arc<Mutex<HashMap<String, std::sync::atomic::AtomicBool>>>,
    pub ffmpeg_path: Mutex<Option<PathBuf>>,
    pub ffprobe_path: Mutex<Option<PathBuf>>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
            ffmpeg_path: Mutex::new(None),
            ffprobe_path: Mutex::new(None),
        }
    }
}

// ─── FFmpeg path resolution ────────────────────────────────────────────────────

fn resolve_binary(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let exe_name = format!("{}.exe", name);

    // 1. Same directory as the executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let c = exe_dir.join(&exe_name);
            if c.exists() { return Some(c); }
            let c2 = exe_dir.join("binaries").join(&exe_name);
            if c2.exists() { return Some(c2); }
        }
    }

    // 2. Tauri resource dir
    if let Ok(resource_path) = app.path().resource_dir() {
        let c = resource_path.join("binaries").join(&exe_name);
        if c.exists() { return Some(c); }
        let c2 = resource_path.join(&exe_name);
        if c2.exists() { return Some(c2); }
    }

    // 3. Local binaries dir (dev mode, relative to workspace root)
    let dev = PathBuf::from(format!("src-tauri/binaries/{}", exe_name));
    if dev.exists() {
        return dev.canonicalize().ok().or(Some(dev));
    }

    // 4. System PATH
    if let Ok(out) = Command::new("where").arg(name).output() {
        if out.status.success() {
            let path_str = String::from_utf8_lossy(&out.stdout);
            let first = path_str.lines().next().unwrap_or("").trim().to_string();
            if !first.is_empty() {
                return Some(PathBuf::from(first));
            }
        }
    }

    None
}

// ─── Commands ─────────────────────────────────────────────────────────────────

pub mod commands {
    use super::*;

#[tauri::command]
pub fn get_ffmpeg_status(app: AppHandle, state: State<AppState>) -> serde_json::Value {
    let ffmpeg = resolve_binary(&app, "ffmpeg");
    let ffprobe = resolve_binary(&app, "ffprobe");

    let ffmpeg_str = ffmpeg.clone().map(|p| p.to_string_lossy().to_string());
    let ffprobe_str = ffprobe.clone().map(|p| p.to_string_lossy().to_string());
    let available = ffmpeg_str.is_some();

    if let Ok(mut lock) = state.ffmpeg_path.lock() { *lock = ffmpeg; }
    if let Ok(mut lock) = state.ffprobe_path.lock() { *lock = ffprobe; }

    // Spawn background thread so we don't block the UI on first AV scan of the 200 MB binary.
    // Version string arrives via the "ffmpeg://version" event a moment later.
    if let Some(path) = ffmpeg_str.clone() {
        let app2 = app.clone();
        std::thread::spawn(move || {
            let version = Command::new(&path)
                .arg("-version")
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("").to_string());
            let _ = app2.emit("ffmpeg://version", serde_json::json!({ "version": version }));
        });
    }

    serde_json::json!({
        "available": available,
        "ffmpeg_path": ffmpeg_str,
        "ffprobe_path": ffprobe_str,
        "version": null,   // delivered async via ffmpeg://version event
    })
}

#[tauri::command]
pub fn get_media_info(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> Result<MediaInfo, String> {
    let ffprobe_path = {
        let lock = state.ffprobe_path.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .or_else(|| resolve_binary(&app, "ffprobe"))
            .unwrap_or_default()
    };

    if ffprobe_path.as_os_str().is_empty() {
        return Err("ffprobe not found".into());
    }

    let output = Command::new(&ffprobe_path)
        .args(["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", &path])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    parse_media_info(json, &path)
}

fn parse_media_info(json: serde_json::Value, path: &str) -> Result<MediaInfo, String> {
    let format = json.get("format");
    let streams = json.get("streams").and_then(|s| s.as_array()).cloned().unwrap_or_default();

    let duration: f64 = format
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|d| d.parse().ok())
        .unwrap_or(0.0);

    let size: u64 = format
        .and_then(|f| f.get("size"))
        .and_then(|s| s.as_str())
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| std::fs::metadata(path).map(|m| m.len()).unwrap_or(0));

    let video = streams.iter().find(|s| s.get("codec_type").and_then(|ct| ct.as_str()) == Some("video"));
    let audio = streams.iter().find(|s| s.get("codec_type").and_then(|ct| ct.as_str()) == Some("audio"));

    let fps = video.and_then(|s| s.get("r_frame_rate")).and_then(|r| r.as_str()).map(|r| {
        let parts: Vec<f64> = r.split('/').filter_map(|p| p.parse().ok()).collect();
        if parts.len() == 2 && parts[1] != 0.0 {
            format!("{:.2}", parts[0] / parts[1])
        } else {
            r.to_string()
        }
    });

    Ok(MediaInfo {
        duration,
        duration_str: seconds_to_hms(duration),
        size,
        video_codec: video.and_then(|s| s["codec_name"].as_str()).map(String::from),
        audio_codec: audio.and_then(|s| s["codec_name"].as_str()).map(String::from),
        width: video.and_then(|s| s["width"].as_u64()).map(|w| w as u32),
        height: video.and_then(|s| s["height"].as_u64()).map(|h| h as u32),
        fps,
        video_bitrate: video.and_then(|s| s["bit_rate"].as_str()).map(|b| format!("{}k", b.parse::<u64>().unwrap_or(0) / 1000)),
        audio_bitrate: audio.and_then(|s| s["bit_rate"].as_str()).map(|b| format!("{}k", b.parse::<u64>().unwrap_or(0) / 1000)),
        sample_rate: audio.and_then(|s| s["sample_rate"].as_str()).map(String::from),
        channels: audio.and_then(|s| s["channels"].as_u64()).map(|c| c as u32),
    })
}

#[tauri::command]
pub fn start_conversion(
    app: AppHandle,
    state: State<AppState>,
    job: ConversionJob,
) -> Result<String, String> {
    let ffmpeg_path = {
        let lock = state.ffmpeg_path.lock().map_err(|e| e.to_string())?;
        lock.clone()
            .or_else(|| resolve_binary(&app, "ffmpeg"))
            .unwrap_or_default()
    };

    if ffmpeg_path.as_os_str().is_empty() {
        return Err("FFmpeg not found. Place ffmpeg.exe in the app folder or install FFmpeg system-wide.".into());
    }

    let job_id = Uuid::new_v4().to_string();
    let jid = job_id.clone();
    let app2 = app.clone();
    let active = Arc::clone(&state.active_jobs);

    {
        let mut jobs = state.active_jobs.lock().map_err(|e| e.to_string())?;
        jobs.insert(job_id.clone(), std::sync::atomic::AtomicBool::new(false));
    }

    std::thread::spawn(move || {
        let result = run_conversion(&app2, &ffmpeg_path, &job, &jid, &active);
        let cancelled = active.lock().ok()
            .and_then(|j| j.get(&jid).map(|b| b.load(std::sync::atomic::Ordering::SeqCst)))
            .unwrap_or(false);

        let (success, error) = match result {
            Ok(_) => (true, None),
            Err(e) => (false, Some(e)),
        };

        let _ = app2.emit("conversion://done", ConversionDoneEvent {
            job_id: jid.clone(),
            output_path: job.output_path.clone(),
            success: success && !cancelled,
            error: if cancelled { Some("Cancelled".into()) } else { error },
        });

        if let Ok(mut jobs) = active.lock() { jobs.remove(&jid); }
    });

    Ok(job_id)
}

#[tauri::command]
pub fn cancel_conversion(state: State<AppState>, job_id: String) -> Result<(), String> {
    let jobs = state.active_jobs.lock().map_err(|e| e.to_string())?;
    if let Some(flag) = jobs.get(&job_id) {
        flag.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_thumbnail(
    state: State<'_, AppState>,
    path: String,
    time: Option<f64>,
    options: Option<ConversionOptions>,
) -> Result<String, String> {
    let ffmpeg = state.ffmpeg_path.lock().unwrap().clone().ok_or("FFmpeg not found")?;
    
    let time_str = format!("{:.3}", time.unwrap_or(1.0));

    let mut args = vec![
        "-ss".to_string(), time_str,
        "-i".to_string(), path,
    ];

    // Apply color filters if options are provided
    if let Some(opts) = options {
        let mut filters = Vec::new();
        
        let b = opts.brightness.unwrap_or(0.0);
        let c = opts.contrast.unwrap_or(1.0);
        let s = opts.saturation.unwrap_or(1.0);
        let g = opts.gamma.unwrap_or(1.0);
        
        if b != 0.0 || c != 1.0 || s != 1.0 || g != 1.0 {
            filters.push(format!("eq=brightness={}:contrast={}:saturation={}:gamma={}", b, c, s, g));
        }

        if let Some(hue) = opts.hue {
            if hue != 0.0 {
                filters.push(format!("hue=h={}", hue));
            }
        }

        if !filters.is_empty() {
            args.push("-vf".to_string());
            args.push(filters.join(","));
        }
    }

    args.extend([
        "-frames:v".to_string(), "1".to_string(),
        "-q:v".to_string(), "4".to_string(), // Slightly lower quality for faster scrubbing
        "-f".to_string(), "mjpeg".to_string(),
        "pipe:1".to_string()
    ]);

    let output = Command::new(ffmpeg)
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to extract thumbnail".into());
    }

    Ok(format!("data:image/jpeg;base64,{}", base64_simd::STANDARD.encode_to_string(&output.stdout)))
}

} // end mod commands

// ─── Hardware-acceleration helpers ───────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
enum HwAccel { None, Nvenc, Amf, Qsv }

impl HwAccel {
    fn from_codec(codec: &str) -> Self {
        if      codec.ends_with("_nvenc") { Self::Nvenc }
        else if codec.ends_with("_amf")   { Self::Amf   }
        else if codec.ends_with("_qsv")   { Self::Qsv   }
        else                              { Self::None   }
    }
}

/// Map x264/x265 speed-preset names → NVENC p-scale  (p7 = best quality, p1 = fastest)
fn map_preset_nvenc(p: &str) -> &'static str {
    match p {
        "ultrafast" | "superfast" => "p1",
        "veryfast"                => "p2",
        "faster"                  => "p3",
        "fast"                    => "p4",
        "medium"                  => "p5",
        "slow"                    => "p6",
        "slower" | "veryslow"     => "p7",
        _                         => "p5",
    }
}

/// Map x264/x265 speed-preset names → AMF quality string
fn map_preset_amf(p: &str) -> &'static str {
    match p {
        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" => "speed",
        "slower"    | "veryslow"                                    => "quality",
        _                                                           => "balanced",
    }
}

// ─── FFmpeg execution ──────────────────────────────────────────────────────────

fn run_conversion(
    app: &AppHandle,
    ffmpeg_path: &Path,
    job: &ConversionJob,
    job_id: &str,
    active_jobs: &Arc<Mutex<HashMap<String, std::sync::atomic::AtomicBool>>>,
) -> Result<(), String> {
    let opts = &job.options;
    let vcodec = opts.video_codec.as_deref().unwrap_or_default();
    let hw = HwAccel::from_codec(vcodec);

    // If scaling/fps/custom filters are needed, frames must transit through CPU
    // (prevents the zero-copy VRAM pipeline from breaking on filters)
    let needs_filter =
        opts.resolution.as_deref().map(|r| !r.is_empty() && r != "original").unwrap_or(false)
        || opts.fps.as_deref().map(|f| !f.is_empty() && f != "original").unwrap_or(false)
        || opts.video_filter.as_deref().map(|v| !v.is_empty()).unwrap_or(false);

    let mut args: Vec<String> = vec![
        "-y".into(), "-progress".into(), "pipe:1".into(), "-nostats".into(),
    ];

    // ── HW decode acceleration (must come before -i) ──────────────────────────
    match hw {
        HwAccel::Nvenc => {
            args.extend(["-hwaccel".into(), "cuda".into()]);
            if !needs_filter {
                // Full zero-copy GPU pipeline: NVDEC → VRAM → NVENC (no CPU copies)
                args.extend(["-hwaccel_output_format".into(), "cuda".into()]);
            }
        }
        HwAccel::Amf => { args.extend(["-hwaccel".into(), "d3d11va".into()]); }
        HwAccel::Qsv => { args.extend(["-hwaccel".into(), "qsv".into()]);     }
        HwAccel::None => {}
    }

    if let Some(start) = &opts.start_time {
        if !start.is_empty() { args.extend(["-ss".into(), start.clone()]); }
    }
    args.extend(["-i".into(), job.input_path.clone()]);
    if let Some(end) = &opts.end_time {
        if !end.is_empty() { args.extend(["-to".into(), end.clone()]); }
    }

    // ── Video ─────────────────────────────────────────────────────────────────
    if opts.no_video.unwrap_or(false) {
        args.push("-vn".into());
    } else if !vcodec.is_empty() {
        args.extend(["-c:v".into(), vcodec.to_string()]);
        if vcodec != "copy" {
            match hw {
                HwAccel::Nvenc => {
                    // VBR + CQ mode: GPU chooses per-frame bits, quality target set by CQ
                    if let Some(vb) = &opts.video_bitrate {
                        if !vb.is_empty() {
                            args.extend(["-b:v".into(), vb.clone(), "-maxrate:v".into(), vb.clone()]);
                        }
                    } else {
                        let cq = opts.crf.unwrap_or(23);
                        args.extend([
                            "-rc:v".into(), "vbr".into(),
                            "-cq:v".into(),      cq.to_string(),
                            "-b:v".into(),       "0".into(),
                            "-maxrate:v".into(), "500M".into(),
                            "-bufsize:v".into(), "500M".into(),
                        ]);
                    }
                    let p = opts.preset.as_deref().unwrap_or("medium");
                    args.extend([
                        "-preset:v".into(),    map_preset_nvenc(p).into(),
                        // Adaptive quantization — maximizes perceptual sharpness
                        "-tune:v".into(),      "hq".into(),
                        "-spatial-aq".into(),  "1".into(),
                        "-temporal-aq".into(), "1".into(),
                        "-aq-strength".into(), "8".into(),
                    ]);
                }
                HwAccel::Amf => {
                    if let Some(vb) = &opts.video_bitrate {
                        if !vb.is_empty() { args.extend(["-b:v".into(), vb.clone()]); }
                    } else {
                        // CQP: constant quantizer — AMD's equivalent of CRF
                        let qp = opts.crf.unwrap_or(23).clamp(0, 51) as u8;
                        args.extend([
                            "-rc".into(),   "cqp".into(),
                            "-qp_i".into(), qp.to_string(),
                            "-qp_p".into(), (qp + 2).min(51).to_string(),
                            "-qp_b".into(), (qp + 4).min(51).to_string(),
                        ]);
                    }
                    let p = opts.preset.as_deref().unwrap_or("medium");
                    args.extend(["-quality".into(), map_preset_amf(p).into()]);
                }
                HwAccel::Qsv => {
                    if let Some(vb) = &opts.video_bitrate {
                        if !vb.is_empty() { args.extend(["-b:v".into(), vb.clone()]); }
                    } else {
                        let gq = opts.crf.unwrap_or(23);
                        args.extend([
                            "-global_quality".into(), gq.to_string(),
                            "-look_ahead".into(),     "1".into(),
                        ]);
                    }
                    if let Some(p) = &opts.preset { if !p.is_empty() { args.extend(["-preset".into(), p.clone()]); } }
                }
                HwAccel::None => {
                    // CPU — standard x264/x265/VP9 quality flags, all cores used
                    if let Some(crf) = opts.crf { args.extend(["-crf".into(), crf.to_string()]); }
                    if let Some(p) = &opts.preset { if !p.is_empty() { args.extend(["-preset".into(), p.clone()]); } }
                    if let Some(vb) = &opts.video_bitrate { if !vb.is_empty() { args.extend(["-b:v".into(), vb.clone()]); } }
                    args.extend(["-threads".into(), "0".into()]); // use all CPU cores
                }
            }
        }
    }
    if let Some(res) = &opts.resolution { if !res.is_empty() && res != "original" { args.extend(["-s".into(), res.clone()]); } }
    if let Some(fps) = &opts.fps { if !fps.is_empty() && fps != "original" { args.extend(["-r".into(), fps.clone()]); } }

    // ── Video Filters ─────────────────────────────────────────────────────────
    let mut filters = Vec::new();
    
    // Color adjustments (eq filter)
    // eq=brightness=0:contrast=1:saturation=1:gamma=1
    let b = opts.brightness.unwrap_or(0.0);
    let c = opts.contrast.unwrap_or(1.0);
    let s = opts.saturation.unwrap_or(1.0);
    let g = opts.gamma.unwrap_or(1.0);
    
    if b != 0.0 || c != 1.0 || s != 1.0 || g != 1.0 {
        filters.push(format!("eq=brightness={}:contrast={}:saturation={}:gamma={}", b, c, s, g));
    }

    if let Some(hue) = opts.hue {
        if hue != 0.0 {
            filters.push(format!("hue=h={}", hue));
        }
    }

    if let Some(vf) = &opts.video_filter {
        if !vf.is_empty() { filters.push(vf.clone()); }
    }

    if !filters.is_empty() {
        args.extend(["-vf".into(), filters.join(",")]);
    }

    // Audio
    if opts.no_audio.unwrap_or(false) {
        args.push("-an".into());
    } else if let Some(ac) = &opts.audio_codec {
        if !ac.is_empty() {
            args.extend(["-c:a".into(), ac.clone()]);
            if ac != "copy" {
                if let Some(ab) = &opts.audio_bitrate { if !ab.is_empty() { args.extend(["-b:a".into(), ab.clone()]); } }
                if let Some(sr) = opts.sample_rate { args.extend(["-ar".into(), sr.to_string()]); }
                if let Some(ch) = opts.channels { args.extend(["-ac".into(), ch.to_string()]); }
            }
        }
    }

    if let Some(extra) = &opts.extra_args {
        for part in extra.split_whitespace() { args.push(part.to_string()); }
    }

    args.push(job.output_path.clone());

    // Emit the full FFmpeg command to the debug log
    let _ = app.emit("ffmpeg://debug", serde_json::json!({
        "level": "cmd",
        "job_id": job_id,
        "message": format!("ffmpeg {}", args.join(" "))
    }));

    let mut child = Command::new(ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    let stderr = child.stderr.take().unwrap();
    let app_stderr = app.clone();
    let jid_stderr = job_id.to_string();
    
    // Store last relevant stderr lines for better error reporting
    let last_errors = Arc::new(Mutex::new(Vec::new()));
    let last_errors_clone = Arc::clone(&last_errors);

    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().flatten() {
            if !line.trim().is_empty() {
                let _ = app_stderr.emit("ffmpeg://debug", serde_json::json!({
                    "level": "stderr",
                    "job_id": jid_stderr,
                    "message": line
                }));
                
                let lower = line.to_lowercase();
                if lower.contains("error") || lower.contains("failed") || lower.contains("could not") {
                    if let Ok(mut logs) = last_errors_clone.lock() {
                        logs.push(line);
                        if logs.len() > 5 { logs.remove(0); }
                    }
                }
            }
        }
    });

    // Use the duration supplied by the caller (from ffprobe) for accurate progress %
    let total_dur_us: f64 = job.input_duration_secs * 1_000_000.0;

    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);
    let mut progress_map: HashMap<String, String> = HashMap::new();

    for line in reader.lines().flatten() {
        let cancelled = active_jobs.lock().ok()
            .and_then(|j| j.get(job_id).map(|b| b.load(std::sync::atomic::Ordering::SeqCst)))
            .unwrap_or(false);
        if cancelled { let _ = child.kill(); return Err("Cancelled".into()); }

        if let Some((k, v)) = line.split_once('=') {
            progress_map.insert(k.trim().to_string(), v.trim().to_string());
        }

        if line.starts_with("progress=") {
            let out_time_us: f64 = progress_map.get("out_time_us").and_then(|v| v.parse().ok()).unwrap_or(0.0);
            let percent = if total_dur_us > 0.0 { (out_time_us / total_dur_us * 100.0).clamp(0.0, 100.0) } else { 0.0 };

            let _ = app.emit("conversion://progress", ProgressEvent {
                job_id: job_id.to_string(),
                percent,
                fps: progress_map.get("fps").and_then(|v| v.parse().ok()),
                speed: progress_map.get("speed").cloned(),
                time_elapsed: progress_map.get("out_time").cloned(),
                size_kb: progress_map.get("total_size").and_then(|v| v.parse::<u64>().ok()).map(|b| b / 1024),
            });
            progress_map.clear();
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        let mut err_msg = format!("FFmpeg exited with code {:?}", status.code());
        if let Ok(logs) = last_errors.lock() {
            if !logs.is_empty() {
                let combined = logs.join(" | ").to_lowercase();
                if combined.contains("amfrt64.dll failed") || combined.contains("amf device context") {
                    err_msg = "AMD AMF Error: No AMD GPU found (or driver issue). Please use a different preset.".to_string();
                } else if combined.contains("nvcuda.dll") || combined.contains("nvenc") {
                    err_msg = "NVIDIA NVENC Error: No NVIDIA GPU found (or driver issue). Please use a different preset.".to_string();
                } else if combined.contains("qsv") {
                    err_msg = "Intel QSV Error: Intel hardware acceleration failed. Please use a different preset.".to_string();
                } else {
                    err_msg = format!("{}: {}", err_msg, logs.last().unwrap());
                }
            }
        }
        Err(err_msg)
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn seconds_to_hms(secs: f64) -> String {
    let total = secs as u64;
    let (h, m, s) = (total / 3600, (total % 3600) / 60, total % 60);
    if h > 0 { format!("{:02}:{:02}:{:02}", h, m, s) } else { format!("{:02}:{:02}", m, s) }
}

// ─── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_ffmpeg_status,
            commands::get_media_info,
            commands::start_conversion,
            commands::cancel_conversion,
            commands::get_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
