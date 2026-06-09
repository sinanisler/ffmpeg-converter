import React, { useState } from "react";
import { Tooltip } from "./Tooltip";
import {
  VIDEO_CODECS,
  AUDIO_CODECS,
  PRESETS,
  RESOLUTIONS,
  AUDIO_BITRATES,
  SAMPLE_RATES,
} from "../presets";
import { ConversionOptions, HwEncoderStatus } from "../api";

interface AdvancedOptionsProps {
  options: Partial<ConversionOptions>;
  onChange: (
    key: keyof ConversionOptions,
    value: ConversionOptions[keyof ConversionOptions],
  ) => void;
  isAudioOnly: boolean;
  hwEncoders: HwEncoderStatus | null;
}

export function AdvancedOptions({
  options,
  onChange,
  isAudioOnly,
  hwEncoders,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);

  // Check if a video codec value requires a GPU encoder that isn't available
  const isGpuCodecUnavailable = (codecValue: string): boolean => {
    if (!hwEncoders) return false; // not yet probed — show everything
    switch (codecValue) {
      case "h264_nvenc": return !hwEncoders.nvenc_h264;
      case "hevc_nvenc": return !hwEncoders.nvenc_hevc;
      case "h264_amf":   return !hwEncoders.amf_h264;
      case "hevc_amf":   return !hwEncoders.amf_hevc;
      case "h264_qsv":   return !hwEncoders.qsv_h264;
      case "hevc_qsv":   return !hwEncoders.qsv_hevc;
      default:           return false;
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
        style={{
          background: "var(--surface2)",
          color: "var(--muted)",
          cursor: "pointer",
        }}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: "var(--accent)" }}>⚙</span>
          Advanced Options
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {open ? "▲ collapse" : "▼ expand"}
        </span>
      </button>

      {open && (
        <div
          className="px-4 pb-4 pt-3 space-y-4"
          style={{ background: "var(--surface2)" }}
        >
          {!isAudioOnly && (
            <>
              <Section title="Video">
                {/* Video Codec */}
                <Field
                  label="Video Codec"
                  tooltip="The compression algorithm used to encode the video stream."
                >
                  <Select
                    value={options.video_codec ?? ""}
                    onChange={(v) => onChange("video_codec", v)}
                    options={VIDEO_CODECS}
                  />
                </Field>

                {/* GPU codec warning */}
                {options.video_codec && isGpuCodecUnavailable(options.video_codec) && (
                  <div
                    className="text-xs px-3 py-2 rounded-lg flex items-start gap-2"
                    style={{
                      background: "var(--warning-bg, #fef3c7)",
                      color: "var(--warning, #92400e)",
                      border: "1px solid var(--warning-border, #fcd34d)",
                    }}
                  >
                    <span>⚠</span>
                    <span>
                      This GPU encoder was not detected. The FFmpeg binary may lack hardware-encode support, or GPU drivers may be missing.
                      Try a CPU encoder (libx264 / libx265) instead, or check the Debug Console for details.
                    </span>
                  </div>
                )}

                {/* CRF */}
                {options.video_codec !== "copy" && (
                  <Field
                    label={`CRF Quality: ${options.crf ?? 23}`}
                    tooltip="Constant Rate Factor. Lower = better quality & larger file. 0 = lossless, 51 = worst. Recommended: 18–28."
                  >
                    <input
                      type="range"
                      min={0}
                      max={51}
                      value={options.crf ?? 23}
                      onChange={(e) =>
                        onChange("crf", parseInt(e.target.value))
                      }
                      className="w-full accent-indigo-500"
                    />
                    <div
                      className="flex justify-between text-xs mt-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      <span>0 (lossless)</span>
                      <span>51 (worst)</span>
                    </div>
                  </Field>
                )}

                {/* Preset */}
                {options.video_codec !== "copy" && (
                  <Field
                    label="Speed Preset"
                    tooltip="Trade-off between encoding speed and compression efficiency."
                  >
                    <Select
                      value={options.preset ?? "medium"}
                      onChange={(v) => onChange("preset", v)}
                      options={PRESETS}
                    />
                  </Field>
                )}

                {/* Video Bitrate */}
                {options.video_codec !== "copy" && (
                  <Field
                    label="Video Bitrate (override CRF)"
                    tooltip="Force a target bitrate instead of using CRF. Leave empty to use CRF. Example: 2M, 5000k."
                  >
                    <TextInput
                      placeholder="e.g. 2M or 5000k (leave empty for CRF)"
                      value={options.video_bitrate ?? ""}
                      onChange={(v) => onChange("video_bitrate", v)}
                    />
                  </Field>
                )}

                {/* Resolution */}
                <Field
                  label="Resolution"
                  tooltip="Scale the output video. Downscaling reduces file size. 'Original' keeps source resolution."
                >
                  <Select
                    value={options.resolution ?? "original"}
                    onChange={(v) => onChange("resolution", v)}
                    options={RESOLUTIONS}
                  />
                </Field>

                {/* FPS */}
                <Field
                  label="Frame Rate"
                  tooltip="Output frames per second. 'Original' keeps source FPS."
                >
                  <Select
                    value={options.fps ?? "original"}
                    onChange={(v) => onChange("fps", v)}
                    options={[
                      { value: "original", label: "Original" },
                      { value: "60", label: "60 fps" },
                      { value: "30", label: "30 fps" },
                      { value: "25", label: "25 fps" },
                      { value: "24", label: "24 fps" },
                      { value: "15", label: "15 fps" },
                    ]}
                  />
                </Field>

                {/* Strip video */}
                <Field
                  label="Strip Video"
                  tooltip="Remove the video track entirely. Output will be audio-only."
                >
                  <ToggleSwitch
                    checked={options.no_video ?? false}
                    onChange={(v) => onChange("no_video", v)}
                  />
                </Field>
              </Section>
            </>
          )}

          <Section title="Color Adjustments">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Brightness: ${options.brightness ?? 0}`} tooltip="Adjust the brightness of the video.">
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={options.brightness ?? 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange("brightness", parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </Field>
              <Field label={`Contrast: ${options.contrast ?? 1}`} tooltip="Adjust the contrast of the video.">
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={options.contrast ?? 1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange("contrast", parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </Field>
              <Field label={`Saturation: ${options.saturation ?? 1}`} tooltip="Adjust the color saturation.">
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={options.saturation ?? 1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange("saturation", parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </Field>
              <Field label={`Gamma: ${options.gamma ?? 1}`} tooltip="Adjust the gamma correction.">
                <input
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={options.gamma ?? 1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange("gamma", parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </Field>
              <Field label={`Hue: ${options.hue ?? 0}`} tooltip="Adjust the color hue (degrees).">
                <input
                  type="range"
                  min={-360}
                  max={360}
                  step={1}
                  value={options.hue ?? 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange("hue", parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </Field>
              <button
                onClick={() => {
                  onChange("brightness", 0);
                  onChange("contrast", 1);
                  onChange("saturation", 1);
                  onChange("gamma", 1);
                  onChange("hue", 0);
                }}
                className="text-xs mt-auto mb-1 px-2 py-1 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Reset Colors
              </button>
            </div>
          </Section>

          <Section title="Audio">
            {/* Audio Codec */}
            <Field
              label="Audio Codec"
              tooltip="The compression algorithm for the audio stream."
            >
              <Select
                value={options.audio_codec ?? ""}
                onChange={(v) => onChange("audio_codec", v)}
                options={AUDIO_CODECS}
              />
            </Field>

            {/* Audio Bitrate */}
            {options.audio_codec !== "copy" &&
              options.audio_codec !== "flac" &&
              options.audio_codec !== "pcm_s16le" && (
                <Field
                  label="Audio Bitrate"
                  tooltip="Higher bitrate = better audio quality & larger file. 192k is standard, 320k is high quality."
                >
                  <Select
                    value={options.audio_bitrate ?? "192k"}
                    onChange={(v) => onChange("audio_bitrate", v)}
                    options={AUDIO_BITRATES}
                  />
                </Field>
              )}

            {/* Sample Rate */}
            {options.audio_codec !== "copy" && (
              <Field
                label="Sample Rate"
                tooltip="Audio sample frequency. 44100 Hz is CD quality. 48000 Hz is the video standard."
              >
                <Select
                  value={String(options.sample_rate ?? "")}
                  onChange={(v) =>
                    onChange("sample_rate", v ? parseInt(v) : undefined)
                  }
                  options={[
                    { value: "", label: "Original" },
                    ...SAMPLE_RATES.map((r) => ({
                      value: String(r.value),
                      label: r.label,
                    })),
                  ]}
                />
              </Field>
            )}

            {/* Channels */}
            {options.audio_codec !== "copy" && (
              <Field
                label="Audio Channels"
                tooltip="1 = Mono, 2 = Stereo, 6 = 5.1 Surround."
              >
                <Select
                  value={String(options.channels ?? "")}
                  onChange={(v) =>
                    onChange("channels", v ? parseInt(v) : undefined)
                  }
                  options={[
                    { value: "", label: "Original" },
                    { value: "1", label: "1 (Mono)" },
                    { value: "2", label: "2 (Stereo)" },
                    { value: "6", label: "6 (5.1 Surround)" },
                  ]}
                />
              </Field>
            )}

            {/* Strip audio */}
            <Field
              label="Strip Audio"
              tooltip="Remove the audio track entirely. Output will be video-only (silent)."
            >
              <ToggleSwitch
                checked={options.no_audio ?? false}
                onChange={(v) => onChange("no_audio", v)}
              />
            </Field>
          </Section>

          <Section title="Trim">
            <Field
              label="Start Time"
              tooltip="Where to start in the source file. Format: HH:MM:SS or seconds (e.g. 00:01:30 or 90)."
            >
              <TextInput
                placeholder="e.g. 00:01:30"
                value={options.start_time ?? ""}
                onChange={(v) => onChange("start_time", v)}
              />
            </Field>
            <Field
              label="End Time"
              tooltip="Where to stop in the source file. Format: HH:MM:SS or seconds. Leave empty for full length."
            >
              <TextInput
                placeholder="e.g. 00:05:00"
                value={options.end_time ?? ""}
                onChange={(v) => onChange("end_time", v)}
              />
            </Field>
          </Section>

          <Section title="Extra">
            <Field
              label="Extra FFmpeg Arguments"
              tooltip="Raw FFmpeg arguments appended to the command. Advanced users only. Example: -tune film -profile:v high"
            >
              <TextInput
                placeholder="-tune film -profile:v high"
                value={options.extra_args ?? ""}
                onChange={(v) => onChange("extra_args", v)}
              />
            </Field>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--accent)" }}
      >
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
      {tooltip ? (
        <Tooltip content={tooltip}>
          <label
            className="text-xs flex items-center gap-1 cursor-help"
            style={{ color: "var(--muted)" }}
          >
            {label}
            <span style={{ color: "var(--accent)", fontSize: 10 }}>ⓘ</span>
          </label>
        </Tooltip>
      ) : (
        <label
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </label>
      )}
      <div>{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; description?: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        cursor: "pointer",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} title={opt.description}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
      }}
    />
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center rounded-full w-10 h-5 transition-colors flex-shrink-0"
      style={{
        background: checked ? "var(--accent)" : "var(--border)",
        cursor: "pointer",
        border: "none",
        padding: 0,
      }}
    >
      <span
        className="inline-block w-4 h-4 rounded-full transition-transform"
        style={{
          background: "white",
          transform: checked ? "translateX(22px)" : "translateX(2px)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}
