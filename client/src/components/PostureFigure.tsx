/**
 * Glitch — PostureFigure
 * Draws an animated stick-figure showing correct form/posture for an exercise,
 * from normalized keypoints. Answers "what should this look like?"
 */
import { motion } from "framer-motion";

interface Props {
  points: Record<string, [number, number]>;
  label: string;
  size?: number;
}

const BONES: [string, string][] = [
  ["head", "neck"], ["neck", "hip"],
  ["neck", "shoulderL"], ["neck", "shoulderR"],
  ["shoulderL", "handL"], ["shoulderR", "handR"],
  ["hip", "kneeL"], ["hip", "kneeR"],
  ["kneeL", "ankleL"], ["kneeR", "ankleR"],
];

export default function PostureFigure({ points, label, size = 150 }: Props) {
  const px = (k: string) => (points[k] ? points[k][0] * size : size / 2);
  const py = (k: string) => (points[k] ? points[k][1] * size : size / 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ background: "var(--luna-bg)", borderRadius: 16 }}>
        {/* ground line */}
        <line x1={size * 0.1} y1={size * 0.92} x2={size * 0.9} y2={size * 0.92} stroke="var(--luna-text-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
        {BONES.map(([a, b], i) => (
          points[a] && points[b] ? (
            <motion.line key={i} x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)}
              stroke="var(--luna-accent)" strokeWidth={4} strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: i * 0.05, duration: 0.4 }} />
          ) : null
        ))}
        {/* head */}
        <motion.circle cx={px("head")} cy={py("head")} r={size * 0.07} fill="var(--luna-accent2)"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }} />
        {/* joints */}
        {Object.entries(points).map(([k, [x, y]]) => k !== "head" ? (
          <circle key={k} cx={x * size} cy={y * size} r={3} fill="var(--luna-accent)" />
        ) : null)}
      </svg>
      <p style={{ fontSize: 10, color: "var(--luna-text-muted)", textAlign: "center", maxWidth: size + 40, lineHeight: 1.4 }}>{label}</p>
    </div>
  );
}
