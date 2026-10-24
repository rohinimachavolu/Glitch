/**
 * NutriSense AI — Real Device Step Counter
 * Uses the DeviceMotion API (accelerometer) with a peak-detection pedometer algorithm.
 * Falls back to a manual entry mode when the sensor is unavailable.
 *
 * Algorithm:
 *  1. Read accelerometer magnitude: |a| = sqrt(ax²+ay²+az²)
 *  2. Apply a simple moving average to smooth noise
 *  3. Detect peaks above a threshold with a minimum interval between steps (~350ms)
 *  4. Each valid peak = 1 step
 */
import { useState, useEffect, useRef, useCallback } from "react";

const SMOOTHING_WINDOW = 5;
const STEP_THRESHOLD   = 1.2;   // g-force delta above smoothed baseline
const MIN_STEP_INTERVAL_MS = 350; // ~170 steps/min max (sprinting)

export interface StepCounterState {
  steps: number;
  isActive: boolean;
  isSupported: boolean;
  permissionState: "unknown" | "granted" | "denied" | "unavailable";
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  setManual: (n: number) => void;
}

export function useStepCounter(initialSteps = 0): StepCounterState {
  const [steps, setSteps] = useState(initialSteps);
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<StepCounterState["permissionState"]>("unknown");

  const bufferRef      = useRef<number[]>([]);
  const lastStepTimeRef = useRef<number>(0);
  const lastMagRef     = useRef<number>(0);
  const risingRef      = useRef<boolean>(false);

  // Check support on mount
  useEffect(() => {
    const supported = typeof window !== "undefined" && "DeviceMotionEvent" in window;
    setIsSupported(supported);
    if (!supported) setPermissionState("unavailable");
  }, []);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

    const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);

    // Smooth
    bufferRef.current.push(mag);
    if (bufferRef.current.length > SMOOTHING_WINDOW) bufferRef.current.shift();
    const smoothed = bufferRef.current.reduce((a, b) => a + b, 0) / bufferRef.current.length;

    const delta = mag - smoothed;

    // Peak detection: rising edge then falling edge above threshold
    if (delta > STEP_THRESHOLD && !risingRef.current) {
      risingRef.current = true;
    } else if (delta < 0 && risingRef.current) {
      risingRef.current = false;
      const now = Date.now();
      if (now - lastStepTimeRef.current >= MIN_STEP_INTERVAL_MS) {
        lastStepTimeRef.current = now;
        setSteps((s) => s + 1);
      }
    }

    lastMagRef.current = mag;
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) return;

    // iOS 13+ requires permission
    if (
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function"
    ) {
      try {
        const result = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (result !== "granted") {
          setPermissionState("denied");
          return;
        }
        setPermissionState("granted");
      } catch {
        setPermissionState("denied");
        return;
      }
    } else {
      setPermissionState("granted");
    }

    window.addEventListener("devicemotion", handleMotion);
    setIsActive(true);
  }, [isSupported, handleMotion]);

  const stop = useCallback(() => {
    window.removeEventListener("devicemotion", handleMotion);
    setIsActive(false);
  }, [handleMotion]);

  const reset = useCallback(() => {
    setSteps(0);
    bufferRef.current = [];
    lastStepTimeRef.current = 0;
    risingRef.current = false;
  }, []);

  const setManual = useCallback((n: number) => {
    setSteps(n);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [handleMotion]);

  return { steps, isActive, isSupported, permissionState, start, stop, reset, setManual };
}
