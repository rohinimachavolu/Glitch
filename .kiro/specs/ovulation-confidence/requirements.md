# Requirements — Ovulation Detection Confidence

## Introduction

Glitch's ovulation engine (`detectOvulation` in `client/src/lib/healthMetrics.ts`)
already computes two signals that tell the user how trustworthy a "confirmed"
ovulation is: the resting-heart-rate shift (`rhrShift`) and a `confidence` level
("high" / "medium"). Neither is shown anywhere in the UI. The `OvulationCard` only
renders the temperature shift and the status label.

This matters because progesterone raises *both* skin temperature and resting heart
rate after ovulation. When both move together, the detection is far more credible
than temperature alone — which is exactly the kind of corroboration a clinician
looks for in the doctor summary. Surfacing it turns a bare "Ovulated" label into an
explainable, trustworthy insight.

Wellness insight, not a diagnosis.

## Requirements

### Requirement 1 — Show confidence on confirmed ovulation

**User story:** As a user tracking my cycle, I want to see how confident Glitch is
that I ovulated, so that I can trust the result instead of treating it as a guess.

#### Acceptance criteria

1. WHEN a cycle's ovulation status is `confirmed` AND confidence is `high`, THE
   system SHALL display a "High confidence" indicator.
2. WHEN a cycle's ovulation status is `confirmed` AND confidence is `medium`, THE
   system SHALL display a "Medium confidence" indicator.
3. WHEN a cycle's ovulation status is not `confirmed`, THE system SHALL NOT display
   any confidence indicator for that cycle.

### Requirement 2 — Explain the resting-heart-rate corroboration

**User story:** As a user, I want to know *why* a detection is high confidence, so
that I understand the physiology rather than trusting a black box.

#### Acceptance criteria

1. WHEN a confirmed ovulation has a defined `rhrShift`, THE system SHALL display the
   resting-heart-rate rise in bpm alongside the temperature shift.
2. WHEN `rhrShift` is undefined, THE system SHALL omit the bpm figure and show only
   the temperature shift (no "undefined" or "NaN" text).
3. THE displayed rhr figure SHALL be rounded to one decimal place and prefixed with
   a sign for positive values (e.g. "+1.8 bpm").

### Requirement 3 — Pure, tested confidence summary

**User story:** As a developer, I want the confidence copy derived by a pure,
tested function, so that the UI stays thin and the logic is verifiable.

#### Acceptance criteria

1. THE system SHALL expose a pure function that maps an `OvulationResult` to a
   display summary (label, bpm text, whether to show the indicator).
2. THE function SHALL have unit tests covering: high confidence with rhr, medium
   confidence without rhr, and a non-confirmed status.
3. WHEN the existing test suite runs, all tests (new and existing) SHALL pass.
