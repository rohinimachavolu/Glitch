/**
 * NutriSense AI — Micro Bar
 * Animated horizontal progress bar for micronutrients.
 * Design: Organic Wellness Journal
 */
import { useEffect, useRef } from "react";

interface MicroBarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  color?: string;
}

export default function MicroBar({
  label,
  value,
  target,
  unit,
  color = "oklch(0.72 0.08 148)",
}: MicroBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = Math.min((value / target) * 100, 100);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.width = "0%";
    requestAnimationFrame(() => {
      el.style.transition = "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)";
      el.style.width = `${pct}%`;
    });
  }, [pct]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span style={{ fontSize: 12, fontWeight: 500, color: "oklch(0.35 0.025 50)", fontFamily: "'DM Sans', sans-serif" }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: "oklch(0.55 0.020 60)", fontFamily: "'DM Sans', sans-serif" }}>
          {value}{unit} / {target}{unit}
        </span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: "oklch(0.88 0.020 72)",
          overflow: "hidden",
        }}
      >
        <div
          ref={barRef}
          style={{
            height: "100%",
            borderRadius: 999,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
