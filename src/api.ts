import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface MediaInfo {
  duration: number;
  duration_str: string;
  size: number;
  video_codec?: string;
  audio_codec?: string;
  width?: number;
  height?: number;
  fps?: string;
  video_bitrate?: string;
  audio_bitrate?: string;
  sample_rate?: string;
  channels?: number;
}

export interface ConversionOptions {
  format: string;
  video_codec?: string;
  crf?: number;
  preset?: string;
  video_bitrate?: string;
  resolution?: string;
  fps?: string;
  video_filter?: string;
  // Color adjustments (eq filter)
  brightness?: number;
  contrast?: number;
  saturation?: number;
  gamma?: number;
  hue?: number;
  audio_codec?: string;
  audio_bitrate?: string;
  sample_rate?: number;
  channels?: number;
  start_time?: string;
  end_time?: string;
  extra_args?: string;
  no_video?: boolean;
  no_audio?: boolean;
}

export interface ConversionJob {
  input_path: string;
  output_path: string;
  options: ConversionOptions;
  input_duration_secs: number;
}

export interface DebugEvent {
  level: "cmd" | "stderr";
  job_id: string;
  message: string;
}

export interface ProgressEvent {
  job_id: string;
  percent: number;
  fps?: number;
  speed?: string;
  time_elapsed?: string;
  size_kb?: number;
}

export interface ConversionDoneEvent {
  job_id: string;
  output_path: string;
  success: boolean;
  error?: string;
}

export interface FFmpegStatus {
  available: boolean;
  ffmpeg_path?: string;
  ffprobe_path?: string;
  version?: string;
}

export interface HwEncoderStatus {
  nvenc_h264: boolean;
  nvenc_hevc: boolean;
  amf_h264: boolean;
  amf_hevc: boolean;
  qsv_h264: boolean;
  qsv_hevc: boolean;
  raw: string;
}

export const api = {
  getFFmpegStatus: (): Promise<FFmpegStatus> => invoke("get_ffmpeg_status"),

  getMediaInfo: (path: string): Promise<MediaInfo> =>
    invoke("get_media_info", { path }),

  startConversion: (job: ConversionJob): Promise<string> =>
    invoke("start_conversion", { job }),

  cancelConversion: (jobId: string): Promise<void> =>
    invoke("cancel_conversion", { jobId }),

  getThumbnail: (
    path: string,
    time?: number,
    options?: ConversionOptions,
  ): Promise<string> => invoke("get_thumbnail", { path, time, options }),

  checkHwEncoders: (): Promise<HwEncoderStatus> =>
    invoke("check_hw_encoders"),

  onProgress: (handler: (e: ProgressEvent) => void): Promise<UnlistenFn> =>
    listen<ProgressEvent>("conversion://progress", (event) =>
      handler(event.payload),
    ),

  onDone: (handler: (e: ConversionDoneEvent) => void): Promise<UnlistenFn> =>
    listen<ConversionDoneEvent>("conversion://done", (event) =>
      handler(event.payload),
    ),

  onDebug: (handler: (e: DebugEvent) => void): Promise<UnlistenFn> =>
    listen<DebugEvent>("ffmpeg://debug", (event) => handler(event.payload)),

  onVersion: (
    handler: (e: { version: string | null }) => void,
  ): Promise<UnlistenFn> =>
    listen<{ version: string | null }>("ffmpeg://version", (event) =>
      handler(event.payload),
    ),
};
