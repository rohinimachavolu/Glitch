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
import MenopauseHome from "./pages/MenopauseHome";
import CoachChat, { CoachFab } from "./components/CoachChat";
import { ThemeSync, Confetti } from "./components/Fun";

function AppShell() {
  const { profile, hydrated } = useApp();
  const [activeTab, setActiveTab] = useState("home");
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState<string | null>(null);
  const [coachListen, setCoachListen] = useState(false);
  const [fullDashboard, setFullDashboard] = useState(false);
  const askCoach = (prompt: string) => { setCoachPrompt(prompt); setCoachOpen(true); };
  // Voice-first: the big mic opens Glitchy already listening
  const talk = (prompt?: string) => { if (prompt) askCoach(prompt); else { setCoachListen(true); setCoachOpen(true); } };

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
  const wh = profile.womensHealth;
  const menopauseMode = isFemale && !fullDashboard && (wh?.noCycleReason === "menopause" || wh?.noCycleReason === "perimenopause" || profile.age >= 45);

  const pages: Record<string, React.ReactNode> = {
    home:     menopauseMode
      ? <MenopauseHome onTalk={talk} onOpenFull={() => setFullDashboard(true)} />
      : <Dashboard onAskCoach={askCoach} />,
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
      <ThemeSync />
      <Confetti />
      <BottomNav active={activeTab} onChange={setActiveTab} isFemale={isFemale} />
      {!coachOpen && activeTab !== "form" && <CoachFab onOpen={() => setCoachOpen(true)} />}
      <CoachChat open={coachOpen} onClose={() => { setCoachOpen(false); setCoachListen(false); }} initialPrompt={coachPrompt} onPromptUsed={() => setCoachPrompt(null)} autoListen={coachListen} />
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
            <div style={{ minHeight: "100dvh", background: "var(--app-outer)", transition: "background 0.8s", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              <AppShell />
            </div>
          </AppProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
