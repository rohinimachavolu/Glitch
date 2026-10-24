# Glitch — find the bug, fix your health

A voice-first health coach for women in **perimenopause and menopause**. It uses WHOOP data to track
hot flashes, night sweats, broken sleep, HRV and blood pressure, then turns them into simple visuals,
alerts and a doctor-ready summary. Built for Hackachusetts 2026 (Healthcare track H1: *wearable data
into better care*).

> Wellness insights, not a diagnosis. Treatment decisions belong with a clinician.

---

## Quick start (about 5 minutes)

### 1. Prerequisites

| Tool | Version | Check | Install |
|---|---|---|---|
| **Node.js** | 20 or newer (22 recommended) | `node -v` | https://nodejs.org or `nvm install 22` |
| **pnpm** | 10 | `pnpm -v` | `corepack enable` (ships with Node), or use `npx pnpm@10 …` |
| **Git** | any | `git --version` | https://git-scm.com |
| **Chrome / Edge** | recent | | Needed for voice input, camera and speech |
| **Groq API key** | free | | https://console.groq.com/keys |
| *Python 3.10+* | optional | `python3 --version` | Only to retrain the hot-flash model |

### 2. Clone and install

```bash
git clone https://github.com/rohinimachavolu/Glitch.git
cd Glitch
git checkout rohini            # or your own branch (see "Working together")
pnpm install                   # or: npx pnpm@10 install
```

### 3. Add your API key

```bash
cp .env.example .env
```

Open `.env` and paste your Groq key:

```
VITE_GROQ_API_KEY=gsk_your_key_here
```

`.env` is git-ignored. **Never commit it.** Each teammate uses their own key.

### 4. Run it

```bash
pnpm dev                       # or: npx pnpm@10 dev
```

Open **http://localhost:3000** in Chrome.

### 5. Try the demo

1. On the first screen, tap **"Here for menopause support?"**: a 1-minute setup.
2. On Home, tap **Connect WHOOP → demo**. This loads 90 days of realistic sample data (no band needed).
3. Tap the **mic** and say *"I'm having a hot flash"* or *"My blood pressure is 132 over 84"*.
4. Tap the 📄 icon (top right) for the **doctor summary**.

**Start over any time:** open **http://localhost:3000/?reset**. It wipes all local data.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server on http://localhost:3000 (hot reload) |
| `pnpm test` | Run the unit tests (Vitest) |
| `pnpm check` | TypeScript type-check |
| `pnpm build` | Production build into `dist/` |
| `pnpm start` | Serve the production build |
| `pnpm format` | Format code with Prettier |
| `pnpm train:hotflash` | Retrain the hot-flash model (see below) |
| `pnpm validate:ovulation` | Validate ovulation detection on mcPHASES (see below) |

---

## Features

- **Menopause Home**: dark, glanceable dashboard. Rings for hot flashes, sleep and HRV; tiles for night temperature, blood pressure, mood and resting HR; a sleep-stage donut; a 4-week trend chart; alert pills.
- **Glitchy, the voice coach**: talk instead of typing. Logs meals, hot flashes, blood pressure and mood from speech; reads mood on-device from face, voice tone and words; talks back with a lip-synced avatar; hands-free conversation.
- **Night-sweat detection**: nights with warm skin temperature *and* broken sleep, from WHOOP.
- **Perimenopause staging and alerts**: STRAW+10 stages, early (<45) and premature (<40) menopause flags, high-BP (ACC/AHA), sleep, hot-flash and mental-health alerts, optional notifications.
- **Doctor summary**: one-page weekly table to print or save as PDF.
- **Also included**: cycle-adjusted recovery, ovulation confirmation, a camera Form Coach (MediaPipe), food-photo logging, supplement timing rules, an appraisal-based check-in, PHQ-2/GAD-2 screening.

### Privacy
- All personal data is **encrypted on the device** (AES-GCM, non-extractable key). There's no backend database yet.
- Camera and microphone are analysed **in the browser**; only text and a mood label are sent to the AI.
- Ethnicity and hormone details are **optional and consented**, and used only for context, never for scoring.

---

## Project structure

```
client/src/
  pages/           Screens (MenopauseHome, Dashboard, WomensHealth, FormCoach, Progress…)
  components/      UI pieces (CoachChat, TalkingAvatar, MenopausePanel, MoodOrb…)
  hooks/           Data hooks (useHealthInsights, useMenopauseDashboard, useVoice, useFaceEmotion…)
  lib/             Logic, no UI. Each file has unit tests (*.test.ts)
    whoop/         WHOOP v2 types + demo data generator
    healthMetrics  Ovulation, stress, energy, VO2max, cycle-adjusted recovery
    menopause*     Staging, symptom scale, night sweats, triggers, BP, alerts
    coachAgent     AI coach prompt + validated actions + BP safety net
    models/        Trained model coefficients (JSON). No raw data.
  contexts/        App state (AppContext) with encrypted persistence
  index.css        Design system tokens (colours, fonts)
scripts/           Model training / validation (data downloaded locally, never committed)
server/            Minimal Express server for production
```

**Design system:** all colours come from CSS variables in `client/src/index.css`
(`--app-bg`, `--card-bg`, `--surface-2`, `--line`, `--ink`, `--txt-muted`, `--accent`, `--on-accent`).
Use these instead of hard-coded colours so every screen looks the same.

---

## Datasets and model training

Raw datasets are **never committed**. `scripts/data/` is git-ignored. Only trained coefficients and
aggregate settings live in `client/src/lib/models/`.

### Hot-flash risk model (TSHS Hot Flashes dataset)
- Source: https://www.causeweb.org/tshs/hot-flashes/ (CC BY-NC-SA 4.0, educational use).
- Logistic regression; cross-validated AUC 0.735 (profile) / 0.753 (with FSH and estradiol labs). Race and education are deliberately excluded.

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/train_hotflash_model.py   # downloads the data, writes models/hotflashRisk.json
```

### Ovulation validation (mcPHASES, PhysioNet: restricted)
- Requires a PhysioNet account and signing the data use agreement: https://physionet.org/content/mcphases/1.0.0/
- Put the CSVs in `scripts/data/mcphases/` (git-ignored), then:

```bash
pnpm validate:ovulation -- --inspect    # list files and columns
pnpm validate:ovulation                 # evaluate + tune, writes models/ovulationParams.json
```

Only aggregate thresholds are written. Never commit mcPHASES files.

---

## Working together

```bash
git checkout -b your-name          # your own branch
# …make changes…
pnpm test && pnpm check            # make sure nothing broke
git add -A && git commit -m "Describe your change"
git push -u origin your-name
```

Then open a Pull Request into `main` on GitHub. Don't push directly to `main`.

**Before committing:** make sure `.env`, `scripts/data/` and any downloaded datasets are not staged (`git status`).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm: command not found` | Run `corepack enable`, or prefix commands with `npx pnpm@10` |
| `npm ERR! EACCES` on install | Your npm cache has root-owned files. Run `sudo chown -R $(whoami) ~/.npm`, or use pnpm |
| AI replies say "using fallback" / generic text | Check `VITE_GROQ_API_KEY` in `.env`, then restart `pnpm dev` |
| `model … does not exist` from Groq | Groq retired a model. Set `VITE_GROQ_TEXT_MODEL` / `VITE_GROQ_VISION_MODEL` in `.env` to a current model from https://console.groq.com/docs/models |
| Camera or mic doesn't work | Use Chrome/Edge on **localhost** (browsers block camera/mic on plain `http://` LAN addresses). Allow permissions in the address bar |
| Voice input button does nothing | Speech recognition needs Chrome, Edge or Safari (not Firefox) |
| Stuck on old data / weird state | Open http://localhost:3000/?reset |
| Port 3000 busy | Vite will pick the next free port. Check the terminal for the URL |

---

## Tech stack

React 19 · TypeScript · Vite 7 · Tailwind 4 · framer-motion · Recharts · MediaPipe Tasks Vision
(pose + face) · Web Speech API · Groq (LLM) · Vitest · Zod.

## License

MIT. See [LICENSE](LICENSE). Dataset licenses are listed above and apply to the data, not this code.
