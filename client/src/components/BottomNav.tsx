/**
 * NutriSense AI — Bottom Navigation Bar
 * Female users get 6 tabs (includes both Form Coach and Cycle).
 * Other users get 5 tabs (Form Coach instead of Cycle).
 */
import { Home, Camera, Dumbbell, Eye, TrendingUp, Heart } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavProps {
  active: string;
  onChange: (tab: string) => void;
  isFemale?: boolean;
}

export default function BottomNav({ active, onChange, isFemale = false }: BottomNavProps) {
  const tabs = isFemale
    ? [
        { id: "home",     label: "Home",    icon: Home },
        { id: "log",      label: "Log",     icon: Camera },
        { id: "fitness",  label: "Fitness", icon: Dumbbell },
        { id: "form",     label: "Form",    icon: Eye },
        { id: "cycle",    label: "Cycle",   icon: Heart },
        { id: "progress", label: "Progress",icon: TrendingUp },
      ]
    : [
        { id: "home",     label: "Home",     icon: Home },
        { id: "log",      label: "Log Food", icon: Camera },
        { id: "fitness",  label: "Fitness",  icon: Dumbbell },
        { id: "form",     label: "Form",     icon: Eye },
        { id: "progress", label: "Progress", icon: TrendingUp },
      ];

  return (
    <nav
      className="fixed bottom-0 z-50 flex items-center justify-around"
      style={{
        maxWidth: 430,
        width: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        background: "oklch(0.99 0.010 78)",
        borderTop: "1px solid oklch(0.88 0.020 72)",
        boxShadow: "0 -4px 20px color-mix(in oklch, var(--accent) 8%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        paddingTop: 8,
      }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        const activeColor = "var(--accent)";
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex flex-col items-center gap-0.5 rounded-xl"
            style={{
              padding: isFemale ? "4px 8px" : "4px 12px",
              color: isActive ? activeColor : "oklch(0.55 0.020 60)",
              background: "transparent",
              minWidth: isFemale ? 44 : 52,
              position: "relative",
            }}
          >
            {isActive && (
              <motion.span layoutId="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 30 }}
                style={{ position: "absolute", inset: 0, borderRadius: 12, background: "color-mix(in oklch, var(--accent) 13%, transparent)", zIndex: -1 }} />
            )}
            <motion.span animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} style={{ display: "flex" }}>
              <Icon size={isFemale ? 18 : 20} strokeWidth={isActive ? 2.2 : 1.8} />
            </motion.span>
            <span style={{
              fontSize: isFemale ? 9 : 10,
              fontWeight: isActive ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.01em",
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
