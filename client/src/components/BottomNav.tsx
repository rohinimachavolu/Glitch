/**
 * Luna — Bottom navigation
 * Adapts to health mode. Reproductive modes show the hero + records; fitness-only
 * (male / none) shows no reproductive tabs.
 */
import { motion } from "framer-motion";
import { Home, Camera, Dumbbell, Eye, TrendingUp, FileText, Apple } from "lucide-react";
import type { HealthMode } from "@/db/types";

interface Props {
  active: string;
  onChange: (tab: string) => void;
  mode: HealthMode;
}

export default function BottomNav({ active, onChange, mode }: Props) {
  const isCycle = mode === "cycling" || mode === "irregular" || mode === "pcos";
  const isMeno = mode === "menopause";
  const repro = isCycle || isMeno;

  const homeLabel = isMeno ? "Transition" : isCycle ? "Cycle" : "Home";
  const homeIcon = Home;

  const tabs = repro
    ? [
        { id: "home", label: homeLabel, icon: homeIcon },
        { id: "nutrition", label: "Nutrition", icon: Apple },
        { id: "log", label: "Log", icon: Camera },
        { id: "fitness", label: "Move", icon: Dumbbell },
        { id: "records", label: "Records", icon: FileText },
        { id: "progress", label: "Progress", icon: TrendingUp },
      ]
    : [
        { id: "home", label: "Home", icon: homeIcon },
        { id: "log", label: "Log", icon: Camera },
        { id: "fitness", label: "Move", icon: Dumbbell },
        { id: "form", label: "Form", icon: Eye },
        { id: "records", label: "Records", icon: FileText },
        { id: "progress", label: "Progress", icon: TrendingUp },
      ];

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      maxWidth: 430, width: "100%", zIndex: 50, display: "flex", justifyContent: "space-around",
      background: "var(--luna-surface)", borderTop: "1px solid oklch(0.88 0.02 72 / 0.6)",
      boxShadow: "0 -4px 20px var(--luna-glow)", paddingTop: 7,
      paddingBottom: "max(env(safe-area-inset-bottom, 7px), 7px)",
      backdropFilter: "blur(8px)",
    }}>
      {tabs.map(({ id, label, icon: Icon }) => {
        const a = active === id;
        return (
          <motion.button key={id} onClick={() => onChange(id)} whileTap={{ scale: 0.9 }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "4px 6px", borderRadius: 12, minWidth: 46, border: "none", background: "transparent",
              color: a ? "var(--luna-accent)" : "var(--luna-text-muted)",
            }}>
            <motion.div animate={{ scale: a ? 1.1 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <Icon size={19} strokeWidth={a ? 2.4 : 1.8} />
            </motion.div>
            <span style={{ fontSize: 9, fontWeight: a ? 700 : 500 }}>{label}</span>
            {a && <motion.div layoutId="navdot" style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--luna-accent)" }} />}
          </motion.button>
        );
      })}
    </nav>
  );
}
