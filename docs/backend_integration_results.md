# Backend integration results

## Start commands

Service, from the backend repository root, in its own terminal:

```bash
PYTHONPATH=src .venv/bin/python -m verum.service --port 8765 --replay-dir local/replay_sample --release data/reference_release_v2/verum_reference_v2
```

Frontend, from this repository (port 5173 is fixed with `strictPort`; the service allows CORS only for that origin):

```bash
npm run dev
```

`VITE_API_URL` overrides the service URL (default `http://localhost:8765`).

## What was connected

| Screen | Endpoint | Shown |
|---|---|---|
| Every screen (mode bar) | events | run mode (replay or live), time-compression factor and note, the service's "synthetic data" statement, stream state |
| Command center | `GET /api/health`, `GET /api/episodes`, `POST /api/runs` | mode, episode, speed, reveal truth, Run; service-down message with the start command |
| Command center facility | `GET /api/facility`, `sensor_reading` | latest value, quality and availability per tag on the 3D and 2D views; id check against the layout snapshot |
| Command center strip, Agents tab, drawer | `window_result` | status, report id and runner issue codes per agent, exactly as received (null status = "No status given") |
| KPIs, needs attention, briefing | `window_result`, `alert`, `done` | counts and sentences built only from received fields |
| Decision panels | `window_result.decision` | decision state and the flags, as received |
| Message log | all events | every event with its raw JSON |
| Investigation | `window_result.persistence`, `alert`, report, `/truth` | persistence rule, alerts, report findings (unconfirmed), source reports, truth overlay |
| Inspection plan | report | inspection options and next steps (advisory), decision panel |
| Report | `GET /api/runs/{id}/report[?window=N]` | requested only after `done`; 409 shows "not finished yet"; window picker when several windows are listed |

`src/api/client.ts` is the only module that talks to the service. It uses `EventSource` with one listener per event
type (`sensor_reading`, `window_result`, `alert`, `done`), ignores events whose `seq` was already seen, lets the
browser resume with `Last-Event-ID`, opens a new connection with `?after=<seq>` if the old one is closed for good
(five tries, then "connection lost"), closes on `done` and on unmount, and reports unreadable events without
stopping the stream.

## What still uses static data

- `src/facility/facility.json`: the layout (positions and connections) of the 3D and 2D views. The service sends
  no coordinates. Ids are checked against `GET /api/facility`; a difference raises the Facility mismatch badge.
  The page says the layout is a static snapshot.
- `src/lib/labels.ts`: readable wording for codes and role keys (display text, not data).
- `screenshots/`: images and PDFs made earlier from the removed mock UI. They are stale and no longer reflect the app.

No mock client, mock data or silent fallback remains. The old `VITE_API_MODE`, `VITE_API_BASE` and the Vite `/api`
proxy are gone.

## What the API could not provide (shown as "not available")

- Scenarios, scenario kinds, controls and expected-vs-observed checks. The run form is the service's own
  (mode, episode, speed, reveal truth), so the scenario switcher, "All controls", step mode and "run all" were removed.
- An agent list: names, descriptions, dependency edges. Names are the readable form of the role key, and the number
  is the position in the `window_result.agents` order. That order is the service's manifest order, so for example
  Inspection Quality & Documentation is shown as 4, not 7. The dependency graph became a plain grid.
- Per-agent timing, consumed evidence, report text and flagged assets; agent-to-agent messages.
- A result bundle: structured hypotheses (support level, confidence), flagged assets with severity, evidence
  verification block, `verified`. Hypotheses come only as report findings of kind `hypothesis`; no asset is
  highlighted in the facility view; the report's "Affected assets" section says not available.
- Inspection option preconditions; cost and duration only when the report gives them.
- A stop route: "Stop watching" closes the stream, the run may continue in the service.

## Checks

Gates: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (38 tests, 5 files) pass.
`tests/client.test.ts` covers event order, per-type listeners, resume with `?after=`, close on `done` and on request,
duplicate events, malformed events and a throwing handler, retry limit, 409 from the report, 400/404 from the truth,
creation errors and an unreachable service. The unit tests use a mocked `EventSource`, not the real service.

End-to-end, run from this session against the real service in the built-in browser:

- Service started with the command above; the service answered `/api/health` and sent
  `Access-Control-Allow-Origin: http://localhost:5173`. The dev server already running on 5173 (this repository) was reused.
- Replay run, default episode, created in the page: `OPTIONS` 204 and `POST /api/runs` 201, then the event stream and
  `GET /api/runs/R-.../report` 200 (visible in the browser's network log). The mode bar showed REPLAY, ×60 and the
  service's note; the briefing and KPIs updated per window; status "Run finished after 12 windows". The Report tab
  showed report `maintenance-AN-E0009-r0` for window 12 with Agent statuses as received. Stop watching mid-run
  showed "Stopped" with the partial results kept.
- Live run on the default validation episode `EP-017E75669BA2` with reveal truth on, speed ×300: the mode bar
  showed LIVE; the run finished after 12 windows; the Investigation tab showed the truth table labelled
  "simulation truth, not visible to the agents".
- Service-side behaviour checked with curl: report during a run 409, truth without reveal 404, speed 0 gives 400.
- Service stopped, page reloaded: the page showed "The run service is not running" with the start command.

Not exercised against the real service: a stream drop with resume (covered only by the unit tests), the empty replay
directory state (the sample directory is not empty), and the 3D view on a machine without WebGL.

## Addendum: housekeeping

- **Dependencies:** `playwright-core` was the only package added for browser work. It was added with the screenshot
  and perf scripts, which were deleted when the mock data was removed, so no script in the repo used it. It is removed
  from `package.json` and the lock file. (The lock file still names `@vitest/browser-playwright`; that is an optional
  peer entry of vitest, not a dependency of this repo.) The end-to-end checks used it from a scratch folder, not from the repo.
- **Demo checklist:** `docs/demo_checklist.md`. The replay-sample rebuild command is from the project brief; its
  flags exist in `tools/agents/run_runner_sample.py`, but the backend docs do not print it.
- **Secrets:** no `.env`, key or credential file is tracked or staged, and none exists in the working tree. `.env`
  was not in `.gitignore`; `.env`, `.env.*` (except `.env.example`) are now ignored. `git status` is clean.
- **Commits:** all 34 commits on `frontend-redesign` (since `main`) are authored by Areen Alsemari
  (`areenalsemari@gmail.com`). None has a trailer (Co-Authored-By or Signed-off-by) or a mention of Claude, Anthropic
  or AI in its message, and a search of the tracked files for those words found nothing.
