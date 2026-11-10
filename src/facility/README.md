# Facility snapshot

`facility.json` is a static, read-only snapshot of the **simulated** gasoline terminal used by the
Verum backend. It is derived from synthetic reference data, not from a real plant.

## Source

- Verum backend commit: `b06eead216c652a4f851a688107f1bffb718c54f` (branch `predictive_health` at the time of extraction)
- Data release: `verum_reference_v2`
- Files read (paths relative to the Verum checkout):
  - `data/reference_release_v2/verum_reference_v2/knowledge/public_reference.json`
    (sha256 `06a342df…3e20403`, the same value as `reference_snapshot_sha256` in the agent fixtures).
    Assets with kinds, declared connections, instruments (tags and units), declared asset specs, inspection catalogue.
    `data/` is untracked in the Verum repository, so the commit alone does not pin this file; the sha256 does.
  - `config/canonical_sensor_contract.json`: which element each tag measures (tag to asset association), withheld and non-baseline tags.
  - `config/topology_contract.json`: cross-check of the 28 edges and the excluded non-baseline assets.
  - `config/route_geometry.json`: provisional design coordinates, copied as `design_position_m` (not used for drawing).
  - `tests/agents/fixtures/chained/topology_dependency.request.json`: cross-check of the queried asset ids.

## Regenerate

```bash
python3 -I scripts/extract-facility.py --verum "/path/to/Verum Backend"
```

The script only reads the Verum checkout. Output is deterministic (no random seeds; layout order is
by graph layer, then predecessor barycentre, then id).

## What is in it

- 49 assets: 28 `pipe`, 11 `isolation_valve`, 5 `pressure_transmitter`, 3 `tank`, 2 `pump`.
  Ids and kinds are copied as they are. The source has no labels, so `label` equals `asset_id`.
- Pipes are the 28 graph edges (edge id = asset id). Valves and pumps are graph nodes. Tanks own
  ports (`TK-101:receipt_nozzle`, `TK-101:outlet_nozzle`). Pressure transmitters are not in the
  graph; `mounted_on` is the element the sensor contract says they measure.
- 10 graph nodes are not assets (`junction`): boundaries, meters, headers, the pump suction tee and
  the check valves `CV-PA`, `CV-PB`. They are drawn as small junction markers.
- 30 sensors (tags). 27 have an `asset_id`; the three `LSHH-10x` high-high switches measure their
  own protection state and have no asset in the source (`asset_id: null`).
- `area` is a display grouping derived from each pipe's `route_id` (R-MAIN, R-10x, S-10x, S-HEADER,
  P-A/P-B, D-MAIN); tanks are grouped as "Tank storage".
- `position_hint` is a schematic layout computed from the graph: layered left to right by flow
  direction. **Schematic, not to scale.**
