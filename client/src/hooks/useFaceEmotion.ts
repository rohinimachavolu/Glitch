/**
 * On-device facial expression read with MediaPipe Face Landmarker (blendshapes).
 * Frames are analysed in the browser and discarded; nothing is uploaded.
 */
import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { faceToMood, type MoodRead } from "@/lib/emotion";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
function getFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_URL).then((fs) =>
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      })
    );
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

export type FaceStatus = "off" | "loading" | "live" | "no_face" | "error";

export function useFaceEmotion(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<FaceStatus>("off");
  const [read, setRead] = useState<MoodRead | null>(null);
  const smooth = useRef<MoodRead | null>(null);

  useEffect(() => {
    if (!enabled) { setStatus("off"); setRead(null); smooth.current = null; return; }
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let lastRun = 0;
    let lastUi = 0;
    setStatus("loading");

    (async () => {
      try {
        const [lm, s] = await Promise.all([
          getFaceLandmarker(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } }, audio: false }),
        ]);
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play();
        setStatus("live");

        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          if (now - lastRun < 100 || video.readyState < 2) return; // ~10 fps is plenty for expressions
          lastRun = now;
          const res = lm.detectForVideo(video, now);
          const cats = res.faceBlendshapes?.[0]?.categories;
          if (!cats) { if (now - lastUi > 500) { setStatus("no_face"); lastUi = now; } return; }
          const b: Record<string, number> = {};
          for (const c of cats) b[c.categoryName] = c.score;
          const m = faceToMood(b);
          const prev = smooth.current;
          // Exponential smoothing so a blink or half-second grin doesn't swing the read
          smooth.current = prev ? { valence: prev.valence * 0.85 + m.valence * 0.15, arousal: prev.arousal * 0.85 + m.arousal * 0.15 } : m;
          if (now - lastUi > 250) { setRead(smooth.current); setStatus("live"); lastUi = now; }
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled]);

  return { videoRef, status, read };
}
