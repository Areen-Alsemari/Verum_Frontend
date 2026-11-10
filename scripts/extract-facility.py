#!/usr/bin/env python3
"""Regenerate src/facility/facility.json from a Verum backend checkout (read-only).

Usage:
    python3 -I scripts/extract-facility.py --verum "/path/to/Verum Backend" [--out src/facility/facility.json]

The Verum checkout is only read. Ids are copied exactly as they appear in the source;
nothing is renamed, merged or invented. The schematic layout is computed deterministically
from the declared connections (no randomness), so every run produces the same file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from collections import defaultdict
from pathlib import Path

PUBLIC_REFERENCE = "data/reference_release_v2/verum_reference_v2/knowledge/public_reference.json"
SENSOR_CONTRACT = "config/canonical_sensor_contract.json"
TOPOLOGY_CONTRACT = "config/topology_contract.json"
ROUTE_GEOMETRY = "config/route_geometry.json"
TOPOLOGY_FIXTURE = "tests/agents/fixtures/chained/topology_dependency.request.json"

# Display grouping derived from the source route_id of each pipe (asset_facts[*].route_id).
ROUTE_AREAS = [
    ("R-MAIN", "Receipt line"),
    ("R-", "Tank receipt branches"),
    ("S-HEADER", "Suction header"),
    ("S-", "Tank suction branches"),
    ("P-", "Pump skid"),
    ("D-MAIN", "Delivery line"),
]
AREA_ORDER = [
    "Receipt line",
    "Tank receipt branches",
    "Tank storage",
    "Tank suction branches",
    "Suction header",
    "Pump skid",
    "Delivery line",
]


def area_for_route(route_id: str) -> str:
    for prefix, area in ROUTE_AREAS:
        if route_id == prefix or (prefix.endswith("-") and route_id.startswith(prefix)):
            return area
    return "Unassigned"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(root: Path, rel: str):
    return json.loads((root / rel).read_text())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verum", required=True, help="path to the Verum backend checkout (read-only)")
    ap.add_argument("--out", default="src/facility/facility.json")
    args = ap.parse_args()
    root = Path(args.verum)

    ref = load(root, PUBLIC_REFERENCE)
    contract = load(root, SENSOR_CONTRACT)
    topo = load(root, TOPOLOGY_CONTRACT)
    geom = load(root, ROUTE_GEOMETRY)
    fixture = load(root, TOPOLOGY_FIXTURE)

    commit = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True, check=True
    ).stdout.strip()

    assets = ref["assets"]
    asset_ids = [a["asset_id"] for a in assets]
    asset_kind = {a["asset_id"]: a["kind"] for a in assets}
    facts = ref["asset_facts"]
    connections = ref["connections"]
    flags: list[str] = []

    # ---- cross-checks against the other sources -------------------------------------------
    topo_edges = {(e["edge_id"], e["from_node"], e["to_node"]) for e in topo["edges"]}
    ref_edges = {(c["edge_id"], c["from_node"], c["to_node"]) for c in connections}
    if topo_edges != ref_edges:
        flags.append("public_reference connections differ from config/topology_contract.json edges")
    query_ids = fixture["input"]["query_asset_ids"]
    missing_from_query = sorted(set(asset_ids) - set(query_ids))
    if missing_from_query:
        flags.append(
            "topology_dependency fixture query_asset_ids omits "
            + ", ".join(missing_from_query)
            + " (assets that are not graph nodes or edges)"
        )

    # ---- graph nodes: asset node, port of an asset, or junction (not an asset) ------------
    node_ids: list[str] = []
    for c in connections:
        for n in (c["from_node"], c["to_node"]):
            if n not in node_ids:
                node_ids.append(n)

    def owner(node: str) -> str:
        """Graph vertex used for layout: ports collapse to their owning asset."""
        return node.split(":", 1)[0] if ":" in node else node

    nodes_out = []
    for n in node_ids:
        port_of = n.split(":", 1)[0] if ":" in n else None
        nodes_out.append(
            {
                "node_id": n,
                "asset_id": n if n in asset_kind else None,
                "port_of": port_of if port_of in asset_kind else None,
                "role": "asset" if n in asset_kind else ("port" if port_of in asset_kind else "junction"),
                "design_position_m": geom["nodes"].get(n),
            }
        )
    junctions = [n["node_id"] for n in nodes_out if n["role"] == "junction"]
    flags.append(
        "graph nodes that are not in the asset list (drawn as junction markers, not as assets): "
        + ", ".join(junctions)
    )

    # ---- sensors ---------------------------------------------------------------------------
    spec = contract["sensors"]
    sensors_out = []
    mounted: dict[str, dict] = {}
    for ins in ref["instruments"]:
        tag = ins["tag_id"]
        ref_ = (spec.get(tag) or {}).get("measured_variable_ref") or {}
        element = ref_.get("element_id")
        rec = {
            "tag_id": tag,
            "unit": ins["unit"],
            "sampling_kind": ins["sampling_kind"],
            "measured_element": {
                "record_type": ref_.get("record_type"),
                "element_id": element,
                "field": ref_.get("field"),
            },
            "asset_id": None,
            "association": None,
        }
        if tag in asset_kind:
            rec["asset_id"] = tag
            if asset_kind[tag] == "pressure_transmitter":
                rec["association"] = "tag id equals a pressure_transmitter asset id"
                mounted[tag] = {
                    "element_id": element,
                    "element_type": "edge" if element in {c["edge_id"] for c in connections} else "node",
                    "record_type": ref_.get("record_type"),
                }
            else:
                rec["association"] = "tag id equals the asset id (contact or run-state tag of that asset)"
        elif element in asset_kind:
            rec["asset_id"] = element
            rec["association"] = "measured_variable_ref.element_id is this asset"
        else:
            rec["association"] = (
                f"measured element {element} ({ref_.get('record_type')}) is not an asset; no asset assigned"
            )
            flags.append(f"tag {tag} has no asset: it measures {ref_.get('record_type')} {element}")
        sensors_out.append(rec)

    withheld = sorted(t for t, s in spec.items() if s.get("status") != "emit")
    instrument_tags = {i["tag_id"] for i in ref["instruments"]}
    emit_not_listed = sorted(t for t, s in spec.items() if s.get("status") == "emit" and t not in instrument_tags)
    if emit_not_listed:
        flags.append("emit tags missing from public_reference instruments: " + ", ".join(emit_not_listed))
    shared = sorted(t for t in instrument_tags if t in asset_kind)
    flags.append("tag ids that are also asset ids: " + ", ".join(shared))

    # ---- deterministic layered layout (left to right by flow direction) -------------------
    succ: dict[str, list[str]] = defaultdict(list)
    pred: dict[str, list[str]] = defaultdict(list)
    vertices: list[str] = []
    for c in connections:
        a, b = owner(c["from_node"]), owner(c["to_node"])
        for v in (a, b):
            if v not in vertices:
                vertices.append(v)
        succ[a].append(b)
        pred[b].append(a)
    layer: dict[str, int] = {}

    def depth(v: str, seen: tuple = ()) -> int:
        if v in layer:
            return layer[v]
        if v in seen:
            raise SystemExit(f"cycle in declared connections at {v}")
        layer[v] = 0 if not pred[v] else 1 + max(depth(p, seen + (v,)) for p in pred[v])
        return layer[v]

    for v in sorted(vertices):
        depth(v)
    by_layer: dict[int, list[str]] = defaultdict(list)
    for v in sorted(vertices):
        by_layer[layer[v]].append(v)
    order: dict[str, float] = {}
    x_of_layer: dict[int, float] = {}
    x = 0.0
    for L in sorted(by_layer):
        members = by_layer[L]
        # barycentre of predecessors' rows, tie-broken by id: fully deterministic
        members.sort(key=lambda v: (
            sum(order[p] for p in pred[v]) / len(pred[v]) if pred[v] else 0.0, v))
        has_tank = any(asset_kind.get(v) == "tank" for v in members)
        x += 9.0 if has_tank else 5.5
        x_of_layer[L] = x
        x += 9.0 if has_tank else 0.0
        n = len(members)
        gap = 13.0 if has_tank else (9.0 if n > 2 else 6.0)
        for i, v in enumerate(members):
            order[v] = (i - (n - 1) / 2) * gap
    xmid = (min(x_of_layer.values()) + max(x_of_layer.values())) / 2
    pos = {v: [round(x_of_layer[layer[v]] - xmid, 2), 0.0, round(order[v], 2)] for v in vertices}

    # ---- assets ----------------------------------------------------------------------------
    edges_by_id = {c["edge_id"]: c for c in connections}
    incident: dict[str, list[str]] = defaultdict(list)
    for c in connections:
        incident[owner(c["from_node"])].append(c["edge_id"])
        incident[owner(c["to_node"])].append(c["edge_id"])

    def route_of(edge_id: str) -> str | None:
        return (facts.get(edge_id) or {}).get("route_id")

    assets_out = []
    for a in assets:
        aid, kind = a["asset_id"], a["kind"]
        rec: dict = {"asset_id": aid, "kind": kind, "label": aid}
        if aid in edges_by_id:
            c = edges_by_id[aid]
            rec["graph_role"] = "edge"
            rec["from_node"], rec["to_node"] = c["from_node"], c["to_node"]
            rec["connects_to"] = [owner(c["from_node"]), owner(c["to_node"])]
            routes = [route_of(aid)] if route_of(aid) else []
            p1, p2 = pos[owner(c["from_node"])], pos[owner(c["to_node"])]
            rec["position_hint"] = [round((p1[i] + p2[i]) / 2, 2) for i in range(3)]
        elif aid in mounted:
            m = mounted[aid]
            rec["graph_role"] = "mounted_instrument"
            rec["mounted_on"] = m
            el = m["element_id"]
            rec["connects_to"] = [el]
            if m["element_type"] == "edge":
                c = edges_by_id[el]
                routes = [route_of(el)] if route_of(el) else []
                p1, p2 = pos[owner(c["from_node"])], pos[owner(c["to_node"])]
                base = [(p1[i] + p2[i]) / 2 for i in range(3)]
            else:
                routes = sorted({route_of(e) for e in incident[el] if route_of(e)})
                base = pos[el]
            side = 2.2 if base[2] > 0 else -2.2  # place the marker on the outer side of its pipe
            rec["position_hint"] = [round(base[0], 2), 0.0, round(base[2] + side, 2)]
        else:
            rec["graph_role"] = "node"
            ports = [n for n in node_ids if n.startswith(aid + ":")]
            if ports:
                rec["graph_role"] = "port_owner"
                rec["ports"] = ports
            rec["connects_to"] = sorted(set(incident[aid]))
            routes = sorted({route_of(e) for e in incident[aid] if route_of(e)})
            rec["position_hint"] = pos[aid]
            if aid in geom["nodes"]:
                rec["design_position_m"] = geom["nodes"][aid]
        rec["route_ids"] = routes
        if kind == "tank":
            rec["area"] = "Tank storage"
        else:
            areas = sorted({area_for_route(r) for r in routes}, key=AREA_ORDER.index)
            rec["area"] = areas[0] if areas else "Unassigned"
        rec["declared_specs"] = aid in facts
        if aid in facts:
            f = facts[aid]
            if kind == "tank":
                rec["specs"] = f["declared_dimensions_m"]
            else:
                rec["specs"] = {k: f[k] for k in ("length_m", "inner_diameter_m", "route_id") if k in f}
        assets_out.append(rec)

    # junction positions for drawing the graph
    for n in nodes_out:
        n["position_hint"] = pos.get(owner(n["node_id"]))

    kinds: dict[str, int] = defaultdict(int)
    for a in assets:
        kinds[a["kind"]] += 1

    out = {
        "schema": "verum-facility-snapshot/1",
        "source": {
            "verum_commit": commit,
            "data_release": fixture["context"]["data_release"],
            "public_reference_sha256": sha256(root / PUBLIC_REFERENCE),
            "files": [PUBLIC_REFERENCE, SENSOR_CONTRACT, TOPOLOGY_CONTRACT, ROUTE_GEOMETRY, TOPOLOGY_FIXTURE],
            "simulated": True,
        },
        "layout": {
            "kind": "schematic_layered",
            "note": "Schematic, not to scale. Layered left to right by flow direction from the declared connections.",
            "design_coordinates_note": "design_position_m is copied from config/route_geometry.json (status: "
            + geom["status"] + ", unit: " + geom["unit"] + ") and is not used for drawing.",
        },
        "counts": {
            "assets": len(assets),
            "assets_by_kind": dict(sorted(kinds.items())),
            "edges": len(connections),
            "graph_nodes": len(node_ids),
            "sensors": len(sensors_out),
        },
        "assets": assets_out,
        "nodes": nodes_out,
        "sensors": sensors_out,
        "excluded": {
            "withheld_tags": withheld,
            "nonbaseline_excluded_tags": contract.get("nonbaseline_excluded", []),
            "nonbaseline_excluded_assets": topo.get("excluded_nonbaseline_assets", []),
        },
        "inspection_catalog": ref["inspection_catalog"],
        "flags": flags,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps(out["counts"], indent=1))
    for f in flags:
        print("FLAG:", f)


if __name__ == "__main__":
    main()
