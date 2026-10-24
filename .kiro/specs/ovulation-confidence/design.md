# Design — Ovulation Detection Confidence

## Overview

Surface the already-computed `rhrShift` and `confidence` fields of `OvulationResult`
in the "Did I ovulate?" card. Keep all logic in a pure, tested function in `lib/`;
the component only renders what that function returns. This follows the project's
convention: logic in `client/src/lib/` (with colocated `*.test.ts`), UI in
`components/`.

## Architecture

```
OvulationResult (already produced by detectOvulation)
        │
        ▼
ovulationConfidenceSummary(result)   ← NEW pure fn in healthMetrics.ts
        │  { show, label, tone, detail }
        ▼
OvulationCard.tsx                    ← renders a confidence chip per confirmed cycle
```

No new data flows, no new WHOOP calls. We reuse `useHealthInsights().cycle.ovulations`,
which the card already consumes.

## Components and interfaces

### New pure function (in `client/src/lib/healthMetrics.ts`)

```ts
export interface OvulationConfidenceSummary {
  show: boolean;                 // false unless status === "confirmed"
  label: string;                 // "High confidence" | "Medium confidence" | ""
  tone: "high" | "medium" | null;
  /** e.g. "+0.31 °C skin temp · +1.8 bpm resting HR", or temp-only when rhr absent */
  detail: string;
}

export function ovulationConfidenceSummary(ov: OvulationResult): OvulationConfidenceSummary;
```

Rules:
- `status !== "confirmed"` → `{ show: false, label: "", tone: null, detail: "" }`.
- `confidence === "high" | "medium"` → corresponding label and tone.
- `detail` always includes the temp shift (`+${tempShift} °C skin temp`).
- `rhrShift` defined → append `· ${signed(rhrShift)} bpm resting HR`, one decimal,
  sign prefix for non-negative.

### Component change (in `client/src/components/OvulationCard.tsx`)

Inside the per-cycle timeline map, for confirmed cycles, add a small confidence chip
under the existing `Day N · +X°C` line, using the summary's `label` and `tone`.

## Design-system compliance

Colours come from the card's existing palette constants (`GOOD`, `MUTED`) and the
app CSS tokens. High confidence reuses `GOOD` (green); medium reuses `MUTED`. No
hard-coded hex outside the file's existing constants.

## Error handling

- `rhrShift` undefined or non-finite → omit the bpm clause (Requirement 2.2).
- Empty/absent ovulation list → card already returns early; unchanged.

## Testing strategy

Vitest unit tests colocated at `client/src/lib/ovulationConfidence.test.ts`:
- high confidence with rhr → `show` true, label "High confidence", detail contains
  both "°C" and "bpm".
- medium confidence, rhr undefined → label "Medium confidence", detail has "°C" and
  no "bpm".
- status "pending"/"not_detected" → `show` false, empty label.

Run with `corepack pnpm@10.4.1 test`. All existing tests must continue to pass.
