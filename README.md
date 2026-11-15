# Verum frontend

Single-page UI for the Verum multi-agent industrial diagnostic pipeline, connected to the Verum run service
(backend repository, `docs/service_api.md`). The data is **synthetic** (a simulated gasoline terminal). Advisory
only: a human decides, and no automatic action is authorised.

## Quick start

Requirements: Node.js 20 or newer with npm, and the Verum run service (backend repository) running on port 8765.

```bash
git clone https://github.com/Areen-Alsemari/Verum_Frontend.git
cd Verum_Frontend
npm install
npm run dev
```

Open http://localhost:5173. The page needs the run service to be up (see below); without it the UI shows a
"service not running" message with the start command.

## Run

Start the service from the backend repository root, in a separate terminal:

```bash
PYTHONPATH=src .venv/bin/python -m verum.service --port 8765 --replay-dir local/replay_sample --release data/reference_release_v2/verum_reference_v2
```

Then the frontend (port 5173 is required: the service allows CORS only for `http://localhost:5173`, so the dev
server fails instead of choosing another port):

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run test         # Vitest
npm run lint         # ESLint
npm run typecheck    # tsc, strict
```

`VITE_API_URL` sets the service URL (default `http://localhost:8765`). All access to the service is in
`src/api/client.ts`.

## Screens

Hash routing (`#/command`, `#/agents`, `#/investigation`, `#/inspection`, `#/report`, `#/about`). The screens show what
an engineer or operator needs: what is happening, which equipment is affected and what to check. Technical content
(mode, time compression, runner notes, issue codes, report ids) is in the **Developer view**, which is
off by default: use the small link in the footer, or open the page with `?dev=1`.

| Screen | Content |
|---|---|
| Command center | The **control panel**, the 3D facility, the briefing, four metrics (windows analysed, alerts raised, equipment flagged, agents responded), the needs-attention list, the eight agent cards and the human decision |
| Agents | The eight agents as cards with their characters, a state (working, done, done with limited data, needs more data) and, when the report holds something attributable to the agent, one sentence on what it contributed |
| Investigation | What was found (candidate causes, unconfirmed), alerts and trend in plain sentences, and the simulated truth when it was asked for |
| Inspection plan | What to check, as a checklist, and the decision state |
| Report | A one-page report: what was found, a picture of the facility with the suspected equipment, what changed, what to check, a sign-off box. Download PDF (print dialog) and Download data (the full data, including the technical notes) |
| About | What the demo is, and the technical notes of the report (collapsed) |
| Message log | Every event received, filter by type, raw event, copy as JSON |

### Control panel

The control panel controls only real runs of stored episodes; it never injects or changes a fault. Groups:

- **Scenario**: the four scenarios (`src/lib/scenarios.ts`) and a stored-episode picker (the test split is never listed).
- **Run settings**: mode (replay or live; live is disabled with a reason when the service reports it is off), playback speed, reveal the simulated truth.
- **Playback**: Run, Pause, Resume, Restart, Previous window, Next window, a window scrubber, and Back to live. A run plays all its windows by itself at the chosen speed and the view follows the newest window; pausing, stepping or scrubbing holds an earlier window ("Viewing window N of M") until Back to live.
- **Reset to defaults**.

### Agent characters

`Eight Industrial Agent Icons Grid.png` holds the eight characters. `npm run agents` cuts them into
`src/assets/agents/agent-1.png` to `agent-8.png` (left to right, top to bottom is agent 1 to 8). A card without an image shows the line icon.

There is no approve, execute or dispatch control anywhere.

## Facility

`src/facility/facility.json` is a static snapshot of the simulated terminal from the Verum public reference
(49 assets: 28 pipes, 11 isolation valves, 5 pressure transmitters, 3 tanks, 2 pumps; 30 sensor tags).
Sources, Verum commit and ambiguities: `src/facility/README.md`. Regenerate (reads the Verum checkout only):

```bash
npm run facility -- "/path/to/Verum Backend"
```

The service sends no drawing coordinates, so the layout always comes from this snapshot. `GET /api/facility` is
used to check ids: assets or tags that differ show a **Facility mismatch** badge.

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
- Sensor markers: hover or click for tag id, value, unit, quality and asset. Missing values show "not available";
  stale or suspect values show the quality label, never a normal value or 0.
- The service flags no assets. The only highlight is the candidate asset: Agent 5's top hypothesis in the report, shown as "candidate, unconfirmed" with its uncalibrated score. A hypothesis with no asset highlights nothing. The simulation truth is never used for it and is shown in a separate panel.
- Search by asset or tag id (focuses the camera), legend, list of all assets and sensors by kind.
- "2D view" draws the same graph as an accessible SVG (keyboard focusable), centred, with wheel or +/− zoom,
  drag to pan and Reset; used automatically without WebGL.
  "Low detail" lowers the pixel ratio, turns off shadows, ticks and the grid. `prefers-reduced-motion`: instant
  camera moves, no idle rotation, no pulsing rings.

## Report and PDF

`src/report/model.ts` is a pure function from the service's report to the report sections. The report is requested
only after the run's `done` event (a 409 is shown as "not finished yet", not as an error). The default is the last
window; a window picker appears when the service lists more. The print stylesheet (`src/styles/report.css`) sets A4
margins, light paper, page-break rules and a page footer with the report id and page numbers.

## Service states

Service not running (message with the start command), run creation failure (the service's own error text), stream
dropped (the browser resumes with `Last-Event-ID`; if the connection is closed for good a new one opens with
`?after=<seq>`, five tries, then "connection lost"), run finished, and an empty replay directory.
"Stop watching" closes the stream; the service has no stop route, so the run may keep going there.

## Honesty rules in the UI

- No number is shown unless the service sent it. Anything missing is the hatched words "not available", never
  0, "healthy" or "normal".
- Agent statuses are shown as received (complete, degraded, insufficient_evidence, error). A null status is "No status given".
- Agent 8's decision state and the flags are shown as received.
- The simulation truth is shown only for a run started with reveal truth, labelled "simulation truth, not visible to
  the agents", on the Investigation tab only. A 400 or 404 from the truth route is shown as a plain message.
- Codes and field names are shown as plain labels (`src/lib/labels.ts`); the raw code stays in the tooltip.

## Accessibility

Skip link, landmarks, advisory notes with `role="note"`, tablist with roving tabindex, one Verum-styled select
(WAI-ARIA combobox with a listbox), 2D diagram and the asset list as keyboard-operable alternatives to the 3D canvas,
`prefers-reduced-motion` respected.

## Brand assets

`npm run assets` runs `scripts/process_brand_assets.py` (Python + Pillow) and writes UI versions to `public/brand/`.

