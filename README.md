# Verum demo frontend

Single-page demo UI for the Verum multi-agent industrial diagnostic pipeline, run against a
**simulated** gasoline terminal. Advisory only: a human decides, and no automatic action is authorised.
The UI works fully offline (fonts, images and 3D geometry are local; nothing is fetched from a CDN)
and needs no backend in mock mode.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run test         # Vitest (unit, component and honesty tests)
npm run lint         # ESLint
npm run typecheck    # tsc, strict
```

## Tabs

Hash routing (`#/command`, `#/agents`, `#/log`, `#/investigation`, `#/inspection`, `#/report`),
no router dependency. The pill tab bar is a WAI-ARIA tablist (arrow keys, Home, End).

The Command center has the scenario switcher (title, kind and description), Run, Stop, Next event while stepping,
and **All controls**, which opens the
scenarios-and-controls card as a modal over the current tab: scenario list, controls generated from scenario
data, Run / Run step by step / Next event / Run all scenarios / Stop / Reset to defaults, playback speed, and
observed vs expected. Run actions close the card so the run can be watched; Escape or the backdrop closes it and
focus returns to the button. The old `#/scenarios` link opens the card.

| Tab | Content |
|---|---|
| Command center | Scenario switcher and run buttons; 3D facility with sensor markers; operations briefing (written from run data only, shown once a run has started); KPI row (agents complete, open issues, flagged assets, decision state); needs-attention list; agent workflow strip fed by the simulated sensor stream; human-decision panel (state only); focus view of flagged assets |
| Agents | Eight agent cards with dependency arrows, status, timing, issues, consumed reports; detail drawer |
| Message log | Runner and agent requests, responses, attachments and issues; filters, pause scroll, expandable payloads, copy as JSON |
| Investigation | Agent outcomes (failures red with issue code), unconfirmed hypotheses, evidence verification, report and evidence ids, focus view |
| Inspection plan | Agent 6 options (advisory) with preconditions (met / unmet / unknown), cost and duration only when given; Agent 8 verification; "Awaiting human decision" with the three flags and role cards |
| Report | Maintenance report card, **Save as PDF** (print layout, `window.print()`), **Download report data (JSON)** |

There is no approve, execute or dispatch control anywhere.

## Facility

`src/facility/facility.json` is a static snapshot of the simulated terminal from the Verum public reference
(49 assets: 28 pipes, 11 isolation valves, 5 pressure transmitters, 3 tanks, 2 pumps; 30 sensor tags).
Sources, Verum commit and ambiguities: `src/facility/README.md`. Regenerate (reads the Verum checkout only):

```bash
npm run facility -- "/path/to/Verum Backend"
```

`GET /api/facility` overrides the snapshot when a backend provides it; ids that differ show a
**Facility mismatch** badge. The fault-location control is generated from the facility assets.

### 3D and 2D views

- three.js through `@react-three/fiber` and `@react-three/drei` (`OrbitControls` only), lazy-loaded (`React.lazy`).
- Procedural low-poly geometry from primitives: tank (shell, floating roof, trim rings, ladder), pump (skid, casing,
  motor), isolation valve (body, stem, handwheel), pressure transmitter, pipe tubes along the graph edges with
  flow-direction ticks, junction markers for graph nodes that are not assets, and a labelled generic block for any
  other kind. Positions come from the schematic layout in `facility.json` (**schematic, not to scale**).
- Hemisphere, directional and two amber point lights; no environment maps, remote fonts, models or textures.
- Labels are DOM overlays projected each frame (shown on hover, selection, for flagged assets, and for tanks
  and pumps at medium zoom), with simple overlap avoidance. drei `Html` was not used: mounting and unmounting it
  under React 19 logged "synchronously unmount a root" errors.
- Sensor markers: hover or click for tag id, value, unit, quality and asset. Missing values show "unknown";
  stale or suspect values show the quality label, never a normal value or 0.
- Only flagged assets get a ring and a "flagged by N agents" label. On a new flag the camera eases to it.
- Search by asset or tag id (focuses the camera), legend, list of all assets and sensors by kind.
- "2D view" draws the same graph as an accessible SVG (keyboard focusable); used automatically without WebGL.
  "Low detail" lowers the pixel ratio, turns off shadows, ticks and the grid. `prefers-reduced-motion`: instant
  camera moves, no idle rotation, no pulsing rings.

## Report and PDF

The report model is a pure function (`src/report/model.ts`, tested in `tests/report.test.tsx`). Sections:
header (report id, analysis id, scenario, time window, "Simulated data, advisory only"), summary, affected assets
with a 3D snapshot (captured off-screen from the focus view with labels composited, `preserveDrawingBuffer`;
a 2D close-up when WebGL is not available), observations, hypotheses (unconfirmed), inspection options
(advisory), what is unknown or missing, human decision (flags as given and a blank paper sign-off block),
traceability appendix, limitations. The print stylesheet (`src/styles/report.css`) sets A4 margins, light paper,
page-break rules, a darkened logo and a CSS page footer with the report id and page numbers.

```bash
npm run pdfs         # prints the report of each mock scenario to screenshots/report-NN-<scenario>.pdf
```

## API modes

All API access goes through `src/api/`. Mode is chosen with `VITE_API_MODE`:

| value | behaviour |
|---|---|
| unset / `auto` | probe the backend; if unreachable use mock data and show a **Demo data** badge |
| `mock` | scripted mock data, no network |
| `real` | real backend only; failures are shown as errors |

```bash
VITE_API_MODE=mock npm run dev
VITE_API_MODE=real VITE_API_BASE=http://127.0.0.1:8765 npm run dev
```

`VITE_API_BASE` defaults to `http://127.0.0.1:8765`; the Vite dev server proxies `/api` to it.

## API contract

Typed source: `src/api/types.ts`. Readable copy with example payloads: `docs/api-contract.md`.
`GET /api/agents`, `GET /api/scenarios`, `POST /api/runs`, `GET /api/runs/{id}/events` (SSE), `GET /api/runs/{id}`,
plus the optional additions `GET /api/facility`, the `sensor_reading` SSE event, `flagged_asset_ids`/`summary` on
`agent_finished`, and `GET /api/runs/{id}/report` (shape of the backend's `maintenance_report.schema.json`).
The HTTP endpoints are not verified against a running backend; the Verum checkout has no HTTP service.

## Honesty rules in the UI

- No number is shown unless it is in the API data. Missing values are the hatched word "unknown", never 0, 0%,
  "healthy" or blank. Confidence is shown only when given.
- A permanent footer states: Advisory only. A human decides. No automatic action is authorised.
- No control or text implies that the system executes, approves or dispatches work.
- `human_decision_required`, `automatic_action_authorized`, `equipment_condition_confirmed` are shown as given.
- An agent error or runner rejection is red with its issue code on the board, in the workflow strip, in the log,
  on the Investigation tab and in the report's "unknown or missing" section; a failed agent never shows as complete.
- Simulated content is labelled: "Simulated stream (replay of recorded windows)", "Simulated data, advisory only",
  "Schematic, not to scale".

Tests: `tests/honesty.test.tsx`, `tests/honesty-tabs.test.tsx`, `tests/report.test.tsx`, `tests/command.test.tsx`.

## Readable wording

Codes and field names from the API (`more_evidence_required`, `human_decision_required`, `AGENT_INVALID_RESPONSE`,
`eligible_for_human_review`, role keys) are shown as plain labels through `src/lib/labels.ts`. Flags read
Yes / No with the exact value in the tooltip; issue codes keep the raw code in the tooltip, in the agent drawer
and in the report. A test checks that no snake_case name appears in the UI text.

All dropdowns use one Verum-styled select (`src/components/Select.tsx`, WAI-ARIA combobox with a listbox:
arrow keys, Home, End, Enter, Escape, type to jump). The top bar becomes opaque once the page scrolls.

## Glass theme

Dark translucent panels (`backdrop-filter: blur(18px)`, rgba surfaces, 1 px light border, inner highlight, soft
shadow) over the night-refinery hero under a dark gradient. Only top-level panels blur; nested panels are tinted
without a second blur. Solid surfaces are used when `backdrop-filter` is unsupported or
`prefers-reduced-transparency: reduce` is set. Text tokens on the glass surfaces measure at least 6:1 (muted)
and 13:1 (cream) against the worst-case backdrop; the `--faint` token (about 3.6:1) is used only for non-text marks.

## Accessibility

Skip link, landmarks (`header`, `nav`, `main`, footer note), tablist with roving tabindex, native range inputs
and `role="switch"` toggles with labels, search combobox with listbox, focus rings, 2D diagram and the asset
list as keyboard-operable alternatives to the 3D canvas, `prefers-reduced-motion` respected.

## Performance

`npm run perf` measures the Command center (3D, 1920x1080, mock run) in headless Chrome. Measured on this
machine: 60 fps (p95 16.7 ms) with ANGLE Metal on an Apple M1 Pro integrated GPU, normal and low detail;
7 fps (normal) and 10 fps (low detail) with SwiftShader software rendering. Production chunks:
`index` 376 kB (108 kB gzip), `Facility3D` (lazy) 950 kB (252 kB gzip), CSS 48 kB (10 kB gzip).

## Screenshots

```bash
npm run screenshots
```

Starts a mock-mode dev server, runs each scenario and captures every tab and the All controls card at 1920x1080 in headless Google Chrome
(override the path with `CHROME_PATH`) into `screenshots/`.

## Brand assets

`npm run assets` runs `scripts/process_brand_assets.py` (Python + Pillow) and writes UI versions to `public/brand/`.
The logo is light-on-transparent; in print it is darkened with a CSS filter so it stays visible on paper.

## Dependencies

Runtime: `react`, `react-dom`, `@fontsource/michroma`, `@fontsource/inter`, `three` (3D rendering),
`@react-three/fiber` (React renderer for three.js), `@react-three/drei` (`OrbitControls`).
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `@types/three`,
`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`,
`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`,
`playwright-core` (screenshots, PDFs and perf only; uses the installed Chrome, no browser download).
