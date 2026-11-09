# API contract (proposed)

Status: **proposed, not verified against a backend.** No Verum service code was available when
the frontend was written. The typed source of truth is `src/api/types.ts`; this file is the
short human-readable copy so the backend side can be checked against it.

Base URL: `VITE_API_BASE` (default `http://127.0.0.1:8765`). In dev the Vite server proxies `/api`.

Role keys (pipeline order): `predictive_health`, `anomaly_detection`, `topology_dependency`,
`historical_asset_intelligence`, `diagnostic_reasoning`, `inspection_planning`,
`inspection_quality_documentation`, `evidence_verification_decision`.

## GET /api/agents
```json
[{ "role_key": "diagnostic_reasoning", "name": "Diagnostic Reasoning",
   "description": "Weighs the evidence and lists competing hypotheses.", "order": 5,
   "depends_on": ["predictive_health", "anomaly_detection", "topology_dependency", "historical_asset_intelligence"] }]
```
`depends_on` is an addition to the brief and optional. Without it the UI draws a straight chain by `order`.

## GET /api/scenarios
```json
[{ "id": "developing_fault", "title": "Developing fault", "description": "…",
   "kind": "normal | fault | conflict | failure",
   "expected": { "summary": "…", "checks": ["…"] },
   "controls": [
     { "id": "pressure_drop_rate", "label": "Pressure drop rate", "type": "slider",
       "min": 0, "max": 40, "step": 1, "default": 12, "unit": "kPa/h", "help": "…" },
     { "id": "history_available", "label": "…", "type": "toggle", "default": true },
     { "id": "fault_location", "label": "…", "type": "select", "default": "valve",
       "options": [{ "value": "valve", "label": "Valve" }] }
   ] }]
```
`options` for `select` controls is an addition to the brief (a select needs its choices).

## POST /api/runs
Request `{ "scenario_id": "developing_fault", "controls": { "pressure_drop_rate": 12 } }`
Response `{ "run_id": "…" }`

## GET /api/runs/{id}/events  (Server-Sent Events)
Each event is JSON in `data:` (event name = `type`, or a bare `data:` line; both accepted).
Every event has `ts`: milliseconds since the run started (addition to the brief; used for elapsed time).

| type | extra fields |
|---|---|
| `run_started` | `run_id`, `scenario_id` |
| `agent_started` | `role_key` |
| `message` | `from`, `to` (role_key or `"runner"`), `kind` (`request`\|`response`\|`attachment`\|`issue`), `summary`, `payload` |
| `agent_finished` | `role_key`, `status` (`complete`\|`degraded`\|`insufficient_evidence`\|`error`\|`rejected_by_runner`), `issues[]` (`{code, message?, severity?}`), `consumed_evidence_ids[]`, `report_summary` (string or `null`) |
| `run_finished` | `final_decision_state`, `verified` (bool), `expected_vs_observed[]` (`{check, expected, observed, passed}`) |

A failing agent (`AGENT_ERROR`, `AGENT_INVALID_RESPONSE`) still gets an `agent_finished` event with
`report_summary: null` and the issue code; the run continues with the other agents.

## GET /api/runs/{id}  (result bundle)
```json
{ "run_id": "…", "scenario_id": "…", "controls": {},
  "final_decision_state": "more_evidence_required",
  "verified": false,
  "flags": { "human_decision_required": true, "automatic_action_authorized": false, "equipment_condition_confirmed": false },
  "flagged_assets": [{ "asset": "valve", "flagged_by": ["anomaly_detection"], "severity": "info | warning | critical", "note": "…" }],
  "hypotheses": [{ "id": "h-valve", "title": "…", "description": "…", "support_level": "leading", "confidence": null,
                   "supporting_evidence_ids": ["rpt-2"], "conflicting_evidence_ids": [] }],
  "inspection_options": [{ "id": "opt-1", "title": "…", "rationale": "…", "targets": ["valve"], "distinguishes": ["h-valve"], "recommended": false }],
  "evidence_verification": { "state": "partially_verified", "checked_evidence_ids": ["rpt-5"], "unresolved": ["…"], "notes": null },
  "report_summary": "…",
  "agent_reports": { "predictive_health": "…", "topology_dependency": null },
  "expected_vs_observed": [] }
```
Asset ids: `storage_tank`, `pump`, `valve`, `pipeline`, `sensor`, `terminal`.
Any field may be `null`/absent; the UI then shows the word "unknown" and never substitutes a value.
`confidence` and `recommended` are shown only if the API sets them.
