/**
 * NutriSense AI — App Root
 * Female users: Home | Log | Fitness | Form Coach | Cycle | Progress
 * Other users:  Home | Log Food | Fitness | Form Coach | Progress
 */
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider, useApp } from "./contexts/AppContext";
import BottomNav from "./components/BottomNav";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import LogFood from "./pages/LogFood";
import Fitness from "./pages/Fitness";
import FormCoach from "./pages/FormCoach";
import WomensHealth from "./pages/WomensHealth";
import Progress from "./pages/Progress";
import CoachChat, { CoachFab } from "./components/CoachChat";

function AppShell() {
  const { profile, hydrated } = useApp();
  const [activeTab, setActiveTab] = useState("home");
  const [coachOpen, setCoachOpen] = useState(false);

  // Wait for encrypted saved data to be restored before deciding whether to onboard
  if (!hydrated) {
    return <div className="phone-shell" style={{ minHeight: "100dvh" }} />;
  }

  if (!profile) {
    return (
      <div className="phone-shell">
        <Onboarding onDone={() => setActiveTab("home")} />
      </div>
    );
  }

  // Cycle tab covers life stages too (pregnancy, menopause…), so show it for all female profiles
  const isFemale = profile.biologicalSex === "female" && !!profile.womensHealth;

  const pages: Record<string, React.ReactNode> = {
    home:     <Dashboard />,
    log:      <LogFood />,
    fitness:  <Fitness />,
    form:     <FormCoach />,
    cycle:    <WomensHealth />,
    progress: <Progress />,
  };

  return (
    <div className="phone-shell" style={{ boxShadow: "0 0 0 1px oklch(0.88 0.020 72), 0 24px 80px oklch(0.25 0.025 50 / 0.18)" }}>
      <div style={{ overflowY: "auto", height: "100dvh", paddingBottom: 80, scrollbarWidth: "none" }}>
        {pages[activeTab] ?? <Dashboard />}
      </div>
      <BottomNav active={activeTab} onChange={setActiveTab} isFemale={isFemale} />
      {!coachOpen && activeTab !== "form" && <CoachFab onOpen={() => setCoachOpen(true)} />}
      <CoachChat open={coachOpen} onClose={() => setCoachOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppProvider>
            <Toaster position="top-center" richColors />
            <div style={{ minHeight: "100dvh", background: "oklch(0.93 0.018 75)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              <AppShell />
            </div>
          </AppProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
