# API contract (proposed)

Status: **proposed.** The HTTP endpoints are not verified against a running backend: the Verum
checkout (commit `b06eead`) has no HTTP service (`src/verum/service/` does not exist; `src/verum/api/gateway.py`
is a Python inspection gateway, not an HTTP API). The report shape below **does** match the backend's
`contracts/reports/maintenance_report.schema.json` (Agent 7, `build_report`). The typed source of truth
is `src/api/types.ts`.

All additions below are optional. An older backend that omits them still works: the UI falls back to
the static facility snapshot and shows "unknown" for anything not provided. In mock mode the mock
provides them and the UI shows the **Demo data** badge.

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
| `sensor_reading` *(addition)* | `tag_id`, `value` (number, bool or `null` when missing), `unit`, `quality` (`good`\|`suspect`\|`stale`\|`missing`), `t` (seconds since the start of the recorded window) |

Additions to `agent_finished` (optional): `flagged_asset_ids[]` (facility asset ids this agent flagged)
and `summary` (short per-agent line).

`sensor_reading` is a replay of recorded (simulated) windows, never live plant data. A value whose
quality is not `good` is never displayed as a normal value: `missing` shows "unknown", other qualities
show the quality label.

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
Asset ids are the facility ids (e.g. `TK-101`, `P-101A`, `XV-R000`, `E-PA2`, `PT-201`); see GET /api/facility.

Optional additions to `inspection_options[]`, matching Agent 6 (`inspection_planning`) option fields:
`action_id` (catalogue id, e.g. `ACT-INSP-02`), `feasibility` (`eligible_for_human_review`\|`blocked`\|`unknown`),
`precondition_checks[]` (`{check_id, description, outcome: pass|fail|unknown, evidence_ids[]}`),
`cost_usd`, `duration_min` (shown only when given).
Any field may be `null`/absent; the UI then shows the word "unknown" and never substitutes a value.
`confidence` and `recommended` are shown only if the API sets them.

## GET /api/facility  *(addition)*
```json
{ "assets": [{ "asset_id": "XV-R000", "kind": "isolation_valve", "label": "XV-R000",
               "position_hint": [-36.5, 0, 0], "connects_to": ["E002", "E003"] }],
  "sensors": [{ "tag_id": "PT-001", "asset_id": "PT-001", "unit": "barg", "label": "PT-001" }] }
```
Same ids as `src/facility/facility.json` (49 assets, 30 sensors, from the Verum public reference).
`asset_id` on a sensor may be `null` (the three `LSHH-10x` switches have no asset in the source).
`position_hint` is optional; the UI then uses the snapshot's schematic layout. When the backend
provides this endpoint it overrides the snapshot; ids that differ raise a **Facility mismatch** badge.
404 or 501 means "not provided".

## GET /api/runs/{id}/report  *(addition)*
Agent 7's `build_report` output, as defined by `contracts/reports/maintenance_report.schema.json`:
```json
{ "report_version": "1.0.0", "report_id": "maintenance-AN-…",
  "context": { "case_id": "…", "analysis_id": "AN-…", "revision": 0, "as_of_s": 300.0, "as_of_utc": null,
               "data_release": "verum_reference_v2", "reference_snapshot_sha256": "…",
               "scope_id": "verum_supported_reference_v2", "execution_mode": "runtime" },
  "report_type": "maintenance_assessment", "title": "Maintenance assessment",
  "review_status": "human_review_required",
  "assessment_state": "assessment_available | more_evidence_required | review_required | inconclusive",
  "source_reports": [{ "report_id": "…", "agent": "diagnostic_reasoning", "content_sha256": "…" }],
  "findings": [{ "finding_id": "…", "kind": "observation | hypothesis | inspection_check | assessment",
                 "statement": "…", "measurement": null, "source_report_id": "…", "evidence_ids": ["…"] }],
  "inspection_options": [{ "action_id": "ACT-INSP-02", "target_asset": "XV-R000",
                           "feasibility": "eligible_for_human_review | blocked | unknown",
                           "cost_usd": 90.0, "duration_min": 45.0, "source_report_id": "…", "evidence_ids": [] }],
  "next_steps": [{ "description": "…", "source_report_id": "…", "evidence_ids": [] }],
  "missing_information": ["Missing agent report: topology_dependency"],
  "limitations": ["…", "Advisory assessment only; human review is required and equipment condition is not confirmed."],
  "narrative": { "provider": "template", "model": null, "prompt_id": null, "text": "…", "source_report_ids": ["…"] },
  "advisory_only": true, "human_decision_required": true,
  "automatic_action_authorized": false, "equipment_condition_confirmed": false }
```
Frontend-only tolerance: `inspection_options[].precondition_checks` is read if present (it is an Agent 6
field, not part of the report schema). The mock omits `content_sha256` because it has no real report
content to hash; the UI then shows "unknown". 404 or 501 means "not provided".
