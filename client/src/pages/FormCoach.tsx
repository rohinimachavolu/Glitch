/**
 * NutriSense AI — Form Coach Tab
 * Design: Organic Wellness Journal
 * Real-time pose tracking with MediaPipe Pose Landmarker, running fully in the browser
 * (no video leaves the device). Joint angles drive rep counting and form cues — see lib/formAnalysis.ts.
 */
import { useState, useEffect, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { Eye, ChevronDown, Loader2, Volume2, VolumeX } from "lucide-react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  FORM_EXERCISES, FormExerciseDef, FormFrame, createAnalyzer, matchFormExercise, FormAnalyzer,
} from "@/lib/formAnalysis";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const GOOD   = "oklch(0.72 0.08 148)";
const ADJUST = "oklch(0.78 0.10 75)";
const BAD    = "oklch(0.62 0.16 30)";
const MUTED  = "#8B909A";

// Shared across mounts so switching tabs doesn't re-download the model
let landmarkerPromise: Promise<PoseLandmarker> | null = null;
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_URL).then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      })
    );
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

interface SessionSummary {
  exercise: string;
  reps: number;
  cleanReps: number;
  holdSeconds?: number;
  topFault: string | null;
}

type Status = "idle" | "loading" | "live" | "error";

export default function FormCoach() {
  const { exercisePlan } = useApp();

  // Exercises in today's AI plan that the camera can actually check
  const planMatches = new Set(
    exercisePlan.map((e) => matchFormExercise(e.name)).filter((id): id is NonNullable<typeof id> => !!id)
  );

  const [selected, setSelected] = useState<FormExerciseDef>(FORM_EXERCISES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");
  const [frame, setFrame] = useState<FormFrame | null>(null);
  const [reps, setReps] = useState(0);
  const [cleanReps, setCleanReps] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const analyzerRef = useRef<FormAnalyzer | null>(null);
  const faultCounts = useRef<Record<string, number>>({});
  const repsRef = useRef({ reps: 0, clean: 0 });
  const lastSpoken = useRef({ text: "", at: 0 });
  const lastUiUpdate = useRef(0);
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  function speak(text: string, force = false) {
    if (!voiceRef.current || typeof speechSynthesis === "undefined") return;
    const now = performance.now();
    if (!force && (now - lastSpoken.current.at < 2500 || text === lastSpoken.current.text && now - lastSpoken.current.at < 6000)) return;
    lastSpoken.current = { text, at: now };
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    speechSynthesis.speak(u);
  }

  async function startSession() {
    setSummary(null);
    setStatus("loading");
    setReps(0); setCleanReps(0); setFrame(null);
    repsRef.current = { reps: 0, clean: 0 };
    faultCounts.current = {};
    analyzerRef.current = createAnalyzer(selected.id);

    try {
      const [landmarker, stream] = await Promise.all([
        getLandmarker(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
      ]);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("live");
      speak(`Starting ${selected.name}. ${selected.setup}`, true);
      loop(landmarker);
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access and try again."
        : "Couldn't start the camera or load the pose model. Check your connection and try again.";
      setErrorText(msg);
      setStatus("error");
      stopStream();
    }
  }

  function loop(landmarker: PoseLandmarker) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let lastVideoTime = -1;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const w = video.videoWidth, h = video.videoHeight;
      if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const lm = result.landmarks[0];
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);

      if (!lm) {
        maybeUpdateUi(now, { inFrame: false, angle: null, angleLabel: "", stage: "up", faults: [], faultJoints: [], repCompleted: false, repClean: false, cue: "No one detected — step into view" });
        return;
      }

      const f = analyzerRef.current!.update(lm, w, h, now);
      drawSkeleton(ctx, lm, w, h, f);

      for (const fault of f.faults) faultCounts.current[fault] = (faultCounts.current[fault] ?? 0) + 1;
      if (f.repCompleted) {
        repsRef.current.reps++;
        if (f.repClean) repsRef.current.clean++;
        setReps(repsRef.current.reps);
        setCleanReps(repsRef.current.clean);
        speak(f.repClean ? `${repsRef.current.reps}` : `${repsRef.current.reps}. Watch your form`, true);
      } else if (f.faults.length) {
        speak(f.faults[0]);
      }
      maybeUpdateUi(now, f);
    };
    tick();
  }

  // Re-rendering React at 30fps is wasteful; 8fps is plenty for text readouts
  function maybeUpdateUi(now: number, f: FormFrame) {
    if (now - lastUiUpdate.current < 120 && !f.repCompleted) return;
    lastUiUpdate.current = now;
    setFrame(f);
  }

  function drawSkeleton(ctx: CanvasRenderingContext2D, lm: { x: number; y: number; visibility?: number }[], w: number, h: number, f: FormFrame) {
    const color = f.faults.length ? BAD : f.inFrame ? GOOD : ADJUST;
    const bad = new Set(f.faultJoints);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
      if (start < 11 || end < 11) continue; // skip face mesh points
      const a = lm[start], b = lm[end];
      if ((a.visibility ?? 0) < 0.4 || (b.visibility ?? 0) < 0.4) continue;
      ctx.strokeStyle = bad.has(start) && bad.has(end) ? BAD : color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    lm.forEach((p, i) => {
      if (i < 11 || (p.visibility ?? 0) < 0.4) return;
      ctx.fillStyle = bad.has(i) ? BAD: "white";
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, bad.has(i) ? 9 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function stopStream() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }

  function stopSession() {
    stopStream();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (status === "live") {
      const top = Object.entries(faultCounts.current).sort((a, b) => b[1] - a[1])[0];
      setSummary({
        exercise: selected.name,
        reps: repsRef.current.reps,
        cleanReps: repsRef.current.clean,
        holdSeconds: selected.id === "plank" ? frame?.holdSeconds ?? 0 : undefined,
        // Ignore faults seen in only a handful of frames — that's detection jitter
        topFault: top && top[1] > 15 ? top[0] : null,
      });
    }
    setStatus("idle");
    setFrame(null);
  }

  useEffect(() => () => stopStream(), []);

  const live = status === "live";
  const cueColor = !frame ? MUTED : !frame.inFrame ? ADJUST : frame.faults.length ? BAD : GOOD;
  const isPlank = selected.id === "plank";

  return (
    <div className="flex flex-col gap-0 pb-2">
      {/* Header */}
      <div style={{ padding: "20px 20px 12px" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Eye size={20} style={{ color: "var(--accent)" }} />
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>
              Form Coach
            </h1>
          </div>
          <button
            onClick={() => setVoiceOn((v) => !v)}
            aria-label={voiceOn ? "Mute voice coach" : "Unmute voice coach"}
            style={{ padding: 8, borderRadius: 12, border: "1.5px solid var(--line)", background: "var(--card-bg)", color: voiceOn ? "var(--accent)" : MUTED, display: "flex" }}
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
        <p style={{ fontSize: 13, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>
          Live pose tracking · joint angles · real rep counting. Video never leaves your phone.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4">
        {/* Exercise picker */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: 16, border: "1.5px solid var(--line)",
              background: "var(--card-bg)", boxShadow: "0 2px 10px oklch(0.25 0.025 50 / 0.05)",
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 22 }}>{selected.emoji}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}>
                {selected.name}
              </span>
              {planMatches.has(selected.id) && <PlanBadge />}
            </div>
            <ChevronDown size={18} style={{ color: MUTED, transform: showPicker ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {showPicker && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--card-bg)",
                borderRadius: 16, border: "1.5px solid var(--line)", boxShadow: "0 8px 24px oklch(0.25 0.025 50 / 0.12)",
                zIndex: 20, overflow: "hidden",
              }}
            >
              {FORM_EXERCISES.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => { stopSession(); setSelected(ex); setShowPicker(false); setSummary(null); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    background: selected.id === ex.id ? "color-mix(in oklch, var(--accent) 8%, transparent)" : "transparent",
                    border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{ex.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}>{ex.name}</span>
                  {planMatches.has(ex.id) && <PlanBadge />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Camera view */}
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: "var(--ink)", aspectRatio: "3/4" }}>
          {/* Mirrored like a selfie; canvas mirrored identically so the skeleton lines up */}
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: live ? "block" : "none" }} />
          <canvas ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", pointerEvents: "none", display: live ? "block" : "none" }} />

          {!live && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, background: "var(--ink)", textAlign: "center" }}>
              {status === "loading" ? (
                <>
                  <Loader2 size={32} style={{ color: "oklch(0.75 0.015 60)", animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "oklch(0.75 0.015 60)", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading pose model…</p>
                </>
              ) : status === "error" ? (
                <p style={{ color: "oklch(0.80 0.08 40)", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>{errorText}</p>
              ) : (
                <>
                  <div style={{ fontSize: 56, opacity: 0.35 }}>{selected.emoji}</div>
                  <p style={{ color: "oklch(0.80 0.015 60)", fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Setup</p>
                  <p style={{ color: "var(--txt-muted)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", maxWidth: 240 }}>{selected.setup}</p>
                </>
              )}
            </div>
          )}

          {live && (
            <div style={{ position: "absolute", top: 14, right: 14, background: "oklch(0.25 0.025 50 / 0.75)", borderRadius: 14, padding: "8px 14px", backdropFilter: "blur(8px)", textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "oklch(0.75 0.015 60)", fontFamily: "'DM Sans', sans-serif" }}>{isPlank ? "HELD" : "REPS"}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>
                {isPlank ? `${Math.floor(frame?.holdSeconds ?? 0)}s` : reps}
              </p>
              {!isPlank && reps > 0 && (
                <p style={{ fontSize: 10, color: GOOD, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{cleanReps} clean</p>
              )}
            </div>
          )}

          {live && frame?.angle != null && (
            <div style={{ position: "absolute", top: 14, left: 14, background: "oklch(0.25 0.025 50 / 0.75)", borderRadius: 14, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
              <p style={{ fontSize: 11, color: "oklch(0.75 0.015 60)", fontFamily: "'DM Sans', sans-serif" }}>{frame.angleLabel.toUpperCase()}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{Math.round(frame.angle)}°</p>
            </div>
          )}

          {live && frame && (
            <div style={{
              position: "absolute", bottom: 14, left: 14, right: 14, background: "oklch(0.20 0.025 50 / 0.72)",
              backdropFilter: "blur(12px)", borderRadius: 14, padding: "10px 14px", border: `1.5px solid ${cueColor}`,
              transition: "border-color 0.2s",
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "white", fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ color: cueColor }}>{frame.faults.length ? "⚠️" : frame.inFrame ? "✅" : "📷"}</span> {frame.cue}
              </p>
            </div>
          )}
        </div>

        {/* Start / Stop */}
        <button
          onClick={live || status === "loading" ? stopSession : startSession}
          style={{
            padding: "16px", borderRadius: 18, background: live ? "oklch(0.55 0.08 25)" : "var(--accent)",
            color: "white", fontWeight: 700, fontSize: 16, fontFamily: "'DM Sans', sans-serif", border: "none",
            boxShadow: `0 6px 20px ${live ? "oklch(0.55 0.08 25 / 0.35)" : "color-mix(in oklch, var(--accent) 35%, transparent)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {live || status === "loading" ? "⏹ Stop Session" : "▶ Start Form Check"}
        </button>

        {/* Session summary */}
        {summary && <SummaryCard s={summary} />}

        {/* Cues */}
        <div style={{ background: "var(--card-bg)", borderRadius: 18, padding: "16px", boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>
            What the camera checks — {selected.name}
          </p>
          <div className="flex flex-col gap-2">
            {selected.cues.map((cue, i) => (
              <div key={i} style={{ padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 14, color: "var(--accent)" }}>•</span>
                <span style={{ fontSize: 13, color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}>{cue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PlanBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "oklch(0.72 0.08 148 / 0.15)", color: "oklch(0.84 0.1 148)", fontFamily: "'DM Sans', sans-serif" }}>
      In your plan
    </span>
  );
}

function SummaryCard({ s }: { s: SessionSummary }) {
  const isHold = s.holdSeconds !== undefined;
  const pct = s.reps ? Math.round((s.cleanReps / s.reps) * 100) : 0;
  const scoreColor = pct >= 80 ? GOOD : pct >= 50 ? ADJUST : BAD;
  return (
    <div style={{ background: "var(--card-bg)", borderRadius: 18, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" }}>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
        Session summary · {s.exercise}
      </p>
      <div className="grid" style={{ gridTemplateColumns: isHold ? "1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {isHold ? (
          <Stat label="Good-form hold" value={`${Math.floor(s.holdSeconds!)}s`} color={GOOD} />
        ) : (
          <>
            <Stat label="Reps" value={`${s.reps}`} color="var(--ink)" />
            <Stat label="Clean reps" value={`${s.cleanReps}`} color={GOOD} />
            <Stat label="Form score" value={s.reps ? `${pct}%` : "—"} color={s.reps ? scoreColor : MUTED} />
          </>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink)", fontFamily: "'DM Sans', sans-serif" }}>
        {s.topFault ? <>Focus next time: <b>{s.topFault}</b></> : "No recurring form issues detected — nice work."}
      </p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
      <p style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 10, color: MUTED, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{label}</p>
    </div>
  );
}
