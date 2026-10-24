# Tasks — Ovulation Detection Confidence

- [x] 1. Add the pure `ovulationConfidenceSummary` function and its type to
  `client/src/lib/healthMetrics.ts`.
  - Export `OvulationConfidenceSummary` interface and the function.
  - Handle non-confirmed status, high/medium labels, temp-only vs temp+rhr detail.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1_

- [x] 2. Add unit tests at `client/src/lib/ovulationConfidence.test.ts`.
  - Cover high+rhr, medium without rhr, and a non-confirmed status.
  - _Requirements: 3.2, 3.3_

- [x] 3. Render a confidence chip in `client/src/components/OvulationCard.tsx`.
  - For confirmed cycles, show the label under the existing day/temp line.
  - Use existing palette constants; no new hard-coded colours.
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

- [x] 4. Verify: run the test suite and the type-check; fix any failures.
  - `corepack pnpm@10.4.1 test` and `corepack pnpm@10.4.1 check`.
  - All 106 tests pass (3 new); `tsc --noEmit` exits clean.
  - _Requirements: 3.3_
