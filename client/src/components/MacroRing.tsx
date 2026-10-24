/**
 * NutriSense AI — Macro Ring
 * Animated SVG circular progress ring with gradient stroke.
 * Design: Organic Wellness Journal
 */
import { useEffect, useRef } from "react";

interface MacroRingProps {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color: string;
  size?: number;
  strokeWidth?: number;
}

export default function MacroRing({
  label,
  value,
  target,
  unit = "g",
  color,
  size = 80,
  strokeWidth = 7,
}: MacroRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const pct = Math.min(value / target, 1);
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.strokeDasharray = `${circ}`;
    el.style.strokeDashoffset = `${circ}`;
    requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.23, 1, 0.32, 1)";
      el.style.strokeDashoffset = `${offset}`;
    });
  }, [circ, offset]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="oklch(0.88 0.020 72)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            ref={circleRef}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "oklch(0.25 0.025 50)", lineHeight: 1 }}>
            {value}
          </span>
          <span style={{ fontSize: 9, color: "oklch(0.55 0.020 60)", marginTop: 1 }}>
            /{target}{unit}
          </span>
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "oklch(0.45 0.025 50)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {label}
      </span>
    </div>
  );
}
