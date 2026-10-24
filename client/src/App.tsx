/**
 * Luna — App root
 * Mode-aware shell. Hero surface depends on health mode:
 *   cycling/irregular/pcos → CycleHub
 *   menopause              → Menopause
 *   pregnancy/none(male)   → Dashboard (no reproductive UI)
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider, useApp } from "./contexts/AppContext";
import { LunaThemeProvider } from "./contexts/LunaThemeContext";
import BottomNav from "./components/BottomNav";
import Onboarding from "./pages/Onboarding";
import CycleHub from "./pages/CycleHub";
import Menopause from "./pages/Menopause";
import Dashboard from "./pages/Dashboard";
import LogFood from "./pages/LogFood";
import Fitness from "./pages/Fitness";
import FormCoach from "./pages/FormCoach";
import Progress from "./pages/Progress";
import Records from "./pages/Records";
import { Moon } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="luna-app" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }}
        style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--luna-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Moon size={26} color="white" />
      </motion.div>
    </div>
  );
}

function Shell() {
  const { ready, profile } = useApp();
  const [tab, setTab] = useState("home");

  if (!ready) return <div className="phone-shell"><LoadingScreen /></div>;
  if (!profile) return <div className="phone-shell"><Onboarding /></div>;

  const mode = profile.healthMode;
  const isCycle = mode === "cycling" || mode === "irregular" || mode === "pcos";
  const isMeno = mode === "menopause";
  const hero = isMeno ? <Menopause /> : isCycle ? <CycleHub /> : <Dashboard />;

  const pages: Record<string, React.ReactNode> = {
    home: hero,
    nutrition: <Dashboard />,
    log: <LogFood />,
    fitness: <Fitness />,
    form: <FormCoach />,
    records: <Records />,
    progress: <Progress />,
  };

  return (
    <div className="phone-shell">
      <div className="luna-scroll" style={{ overflowY: "auto", height: "100dvh", paddingBottom: 78 }}>
        {pages[tab] ?? hero}
      </div>
      <BottomNav active={tab} onChange={setTab} mode={mode} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppProvider>
            <LunaThemeProvider>
              <Toaster position="top-center" richColors />
              <div className="luna-app" style={{ minHeight: "100dvh", display: "flex", justifyContent: "center" }}>
                <Shell />
              </div>
            </LunaThemeProvider>
          </AppProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
