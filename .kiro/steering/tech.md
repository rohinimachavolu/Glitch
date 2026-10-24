# Tech & Commands

## Stack

React 19 · TypeScript · Vite 7 · Tailwind 4 · framer-motion · Recharts ·
MediaPipe Tasks Vision (pose + face) · Web Speech API · Groq (LLM) · Vitest · Zod ·
wouter (routing) · Express (production server).

## Package manager

pnpm 10. On this machine pnpm is not on PATH, so run it through corepack:

```bash
corepack pnpm@10.4.1 <command>
```

(or run `sudo corepack enable` once to get a plain `pnpm` command.)

## Commands

| Command | What it does |
|---|---|
| `corepack pnpm@10.4.1 dev` | Dev server on http://localhost:3000 (falls back to next free port) |
| `corepack pnpm@10.4.1 test` | Unit tests (Vitest) |
| `corepack pnpm@10.4.1 check` | TypeScript type-check |
| `corepack pnpm@10.4.1 build` | Production build into `dist/` |
| `corepack pnpm@10.4.1 format` | Prettier |

## Environment

`VITE_GROQ_API_KEY` must be set in `.env` (git-ignored). Without it the AI coach
falls back to generic text. Override models with `VITE_GROQ_TEXT_MODEL` /
`VITE_GROQ_VISION_MODEL` if Groq retires one.

## Conventions

- Use Chrome/Edge on localhost for camera/mic/speech features.
- Logic lives in `client/src/lib/` with colocated `*.test.ts` unit tests. Add tests
  there when you change logic.
- Never commit `.env`, `scripts/data/`, or downloaded datasets.
