# Backend integration plan

Read-only survey, written before any code was changed. Source of truth for the service is
`docs/service_api.md` in the backend repo (`~/Documents/Codex/Verum Backend`); that repo is not modified.

## 1. Framework and state

- React 19 + TypeScript (strict) + Vite 8, Vitest + Testing Library, ESLint. three.js via react-three-fiber for the 3D view.
- No router (hash routing in `src/shell/routes.ts`), no state library. State is a pure reducer
  (`src/state/runState.ts`) driven by `src/state/useRunController.ts`; `App.tsx` owns everything else with `useState`.
- The only data boundary is the `ApiClient` interface in `src/api/types.ts`. `src/api/index.ts` (`resolveApi`) picks a
  client: `real.ts` (fetch + EventSource against `/api/...`) or the mock client, falling back to the mock
  when the backend is unreachable (the header then shows a "Demo data" badge).
- Dev server already uses port 5173 with `strictPort` and proxies `/api` to `127.0.0.1:8765`.

## 2. Where the current data comes from

| Data | Source today |
|---|---|
| Agent list (names, order, descriptions, `depends_on`) | `src/api/mock/data.ts` (`AGENTS`); real client expects `GET /api/agents`, which the service does not have |
| Scenarios, controls, expected checks | `src/api/mock/data.ts` (`SCENARIOS`); real client expects `GET /api/scenarios` (not in the service) |
| Run events (`run_started`, `agent_started`, `message`, `agent_finished`, `sensor_reading`, `run_finished`) | `src/api/mock/engine.ts`, `stream.ts`, `index.ts` |
| Result bundle (flags, flagged assets, hypotheses, inspection options, evidence verification, per-agent report text) | `src/api/mock/engine.ts` via `getRun` |
| Maintenance report | `src/api/mock/report.ts` |
| Facility | static snapshot `src/facility/facility.json` (extracted from the reference, not mock), overridden by `GET /api/facility` only in real mode, using a DTO shape the service does not return |
| Playback speed | `MOCK_SPEEDS` in `src/api/mock/index.ts`, shown in `ControlPanel.tsx` |

## 3. Every place that uses mock or hardcoded data

- `src/api/mock/{data,engine,index,report,stream}.ts`: all of the mock backend.
- `src/api/index.ts`: auto fallback to the mock client; re-exports `MOCK_SPEEDS`, `getMockSpeed`, `setMockSpeed`.
- `src/api/real.ts`: speaks the proposed contract (`/api/agents`, `/api/scenarios`, `/api/runs/{id}` bundle, old event names), not the real service.
- `src/api/types.ts`: the proposed contract types (`Scenario`, `ControlSpec`, `RunBundle`, `Hypothesis`, `InspectionOption`, `RunEvent` union, ...).
- `docs/api-contract.md`: documents that proposed contract.
- `src/App.tsx`: loads agents and scenarios, owns scenario selection and control values, passes `client?.mode === 'mock'`.
- `src/state/useRunController.ts`: scenario based runs, "run all scenarios", step mode, `getRun` bundle load.
- `src/state/runState.ts`: reducer for the old event types, `ScenarioResult`.
- `src/components/ControlPanel.tsx`, `ScenarioPicker.tsx`, `ScenarioChecks.tsx`, `ControlsDialog.tsx`, `RunBar.tsx`: scenario and control UI (mock speed selector included).
- `src/components/Header.tsx`: "Demo data" badge for the mock fallback.
- `src/lib/briefing.ts`: briefing, KPIs and attention items built from mock-shaped state (scenario titles, per-agent issues, bundle).
- `src/lib/format.ts`, `src/lib/labels.ts`: `KIND_LABEL` / `KIND_COLOR` for scenario kinds (display helpers only).
- `src/command/*`, `src/components/{AgentBoard,AgentDrawer,AgentOutcomes,MessageLog,ResultBlocks,ResultView,AssetChain,DecisionPanel}.tsx`, `src/tabs/*`, `src/report/*`: consume the old state shape.
- `src/facility/facility.json` + `src/facility/index.ts`: static terminal snapshot (49 assets, 30 sensors, positions and `connects_to`).
- Hardcoded agent metadata: names, descriptions and `depends_on` in `mock/data.ts`; icons keyed by role key in `AgentIcon.tsx`.
- Static copy that asserts things about the data: "Simulated stream (replay of recorded windows)" in `WorkflowStrip.tsx` and the Command center sub-title in `App.tsx`; these must come from the events instead.
- Tests and scripts that use the mock: `tests/{command,api-additions,honesty,honesty-tabs,report,runState,select}.test.*`, `scripts/{smoke,screenshots,perf,report-pdfs}.mjs`.

## 4. What the service provides (checked against `service_api.md`)

`GET /api/health`, `GET /api/facility`, `GET /api/episodes?mode=`, `POST /api/runs` (`mode`, `speed`, `episode_id`, `reveal_truth`),
SSE `GET /api/runs/{id}/events` with named events `sensor_reading`, `window_result`, `alert`, `done` (resume by `Last-Event-ID` or `?after=`),
`GET /api/runs/{id}/status`, `GET /api/runs/{id}/report[?window=N]` (409 until finished), `GET /api/runs/{id}/truth` (404/400 unless allowed).
Every event carries `mode`, `run_id`, `seq`, `time_compression {factor, note}` and a synthetic-data note.

## 5. Screen to endpoint mapping

| Screen / component | Endpoint(s) | What it can show |
|---|---|---|
| Header, service state | `GET /api/health` | service up/down, which modes are available |
| Command center: run bar | `GET /api/episodes`, `POST /api/runs` | pick mode (replay/live), episode, speed, reveal_truth. Replaces the scenario switcher |
| Command center: facility stage | `GET /api/facility`, `sensor_reading` | asset ids, kinds, tags; latest value, mean/min/max, quality, availability per tag |
| Workflow strip, Agents tab, drawer | `window_result.agents` | status and report id and runner issue codes per agent for the current window |
| KPI row, needs-attention, briefing | `window_result`, `alert`, `done` | status counts, persistence state, decision state, alert text |
| Human decision panel (Command center, Inspection) | `window_result.decision` | `decision_state` and the three fixed flags, as received |
| Message log | all events | one row per received event (type, seq, window); there are no agent-to-agent messages in the API |
| Report tab | `GET /api/runs/{id}/report` | Agent 7 report: findings, inspection options, next steps, missing information, limitations, source reports, flags |
| Investigation tab | report `findings` (hypothesis kind), `source_reports` | hypothesis statements as report findings only |
| Inspection tab | report `inspection_options`, `window_result.decision` | options from the report; decision state and flags |
| Truth overlay | `GET /api/runs/{id}/truth` | only when the run was created with `reveal_truth` |

## 6. What the API does not provide (shown as "not available")

- Scenarios, scenario kinds, controls, expected-vs-observed checks, "run all scenarios", step mode over agent events (events are per window, not per agent).
- An agent list endpoint: names, descriptions, dependency edges. Role keys and their order come only from `window_result.agents`.
- Per-agent timing (`agent_started` / `agent_finished`), consumed evidence ids, per-agent report text, per-agent flagged assets, agent-to-agent messages.
- The run result bundle (`GET /api/runs/{id}`): structured hypotheses with support levels and confidence, flagged-assets list with severity, evidence-verification block, `verified`.
- Facility drawing coordinates and `connects_to` (the service says it adds none). The service gives assets (id, kind), edges, tags with units and ranges. 3D and 2D layout positions can only come from the static snapshot.
- `verified`, per-window decision history beyond the events, per-tag units for withheld tags.

Consequence for the UI: screens that were built around those items keep their layout but show "not available" in place of the value; nothing is estimated or defaulted.

## 7. Open points reported, not invented

1. The facility layout (positions, connections) is not in the API. Plan: use the API for ids, kinds and tags, keep the static snapshot only for drawing positions, and show a visible "layout from static snapshot, not from the service" note. Assets that the API lists and the snapshot does not are listed in the mismatch badge, never placed at made-up coordinates.
2. Agent display names and pipeline numbering are not in the API. Plan: derive readable names from role keys with the existing humaniser, and number by the order received. The previous hand-written descriptions and dependency edges are dropped, so the Agents tab shows a plain list instead of a dependency graph.
3. Mock mode: the mock client is removed from the runtime path (no silent fallback). Remaining mock-based tests are rewritten against the new client or removed.

## 8. Order of work

1. This document.
2. `src/api/client.ts`: the only module that talks to the backend; `VITE_API_URL` defaults to `http://localhost:8765`.
3. New state and screens on real data; remove the mock path.
4. Service-down, run-failure, stream-drop, finished and empty-replay states.
5. Unit tests for the client against a mocked EventSource; lint, type-check, build.
6. End-to-end check against the real service and `docs/backend_integration_results.md`.
