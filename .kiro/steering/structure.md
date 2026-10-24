# Project Structure

```
client/src/
  pages/        Screens (MenopauseHome, Dashboard, WomensHealth, FormCoach, Progress…)
  components/    UI pieces (CoachChat, TalkingAvatar, MenopausePanel, MoodOrb…)
    ui/          Reusable shadcn-style primitives (button, card, dialog…)
  hooks/         Data hooks (useHealthInsights, useMenopauseDashboard, useVoice…)
  lib/           Logic, no UI. Each file has colocated *.test.ts
    whoop/       WHOOP v2 types + demo data generator
    menopause*   Staging, symptom scale, night sweats, triggers, BP, alerts
    coachAgent   AI coach prompt + validated actions + BP safety net
    models/      Trained model coefficients (JSON). No raw data.
  contexts/      App state (AppContext) with encrypted persistence
  index.css      Design system tokens
scripts/         Model training / validation (data local, never committed)
server/          Minimal Express server for production
shared/          Code shared between client and server
```

## Design system

All colours come from CSS variables in `client/src/index.css`:
`--app-bg`, `--card-bg`, `--surface-2`, `--line`, `--ink`, `--txt-muted`,
`--accent`, `--on-accent`. Use these variables, never hard-coded colours, so every
screen looks consistent.

## Rules of thumb

- Keep UI in `components/` and `pages/`; keep logic in `lib/` so it stays testable.
- New shared types go in `shared/` or the relevant `lib/` subfolder.
