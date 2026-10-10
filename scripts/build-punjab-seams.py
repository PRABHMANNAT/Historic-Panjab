"""Build sparse cartographic geometry overrides; original source files stay intact.

Requires numpy and shapely==2.1.2. Ownership of formerly unassigned slivers is
allocated to the nearest existing boundary, sampled at about 28 metres.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
runtime = ROOT / "work/geometry-runtime"
if runtime.exists():
    sys.path.insert(0, str(runtime))
import shapely
from shapely.geometry import shape, mapping, Polygon, MultiPoint, Point
from shapely.ops import unary_union, transform
from shapely.strtree import STRtree

DATA = ROOT / "public/data"
OUT = DATA / "boundary-seams"
OUT.mkdir(exist_ok=True)
EPS = 1e-12
STEP = .00025
X_SCALE = math.cos(math.radians(31))
manifest = {
    "version": 1,
    "method": "Punjab cartographic seam alignment. Indian Punjab's dissolved Esri IAB2024 district outline supplies the common display edge. Only enclosed inter-source gaps touching both Punjab outlines are closed; Pakistan-side overlaps with that outline are clipped. Formerly unassigned slivers are allocated to the nearest existing area boundary, sampled at approximately 28 m. Indian Punjab tehsils are reconciled to the same state outline. Original sources, IDs, labels, census identities and saved colors remain unchanged. Display alignment is not a new administrative boundary survey.",
    "referenceLayer": "in-punjab-region",
    "referenceSource": "Esri India IAB2024 district dissolve",
    "licenses": ["Esri India source terms", "WFP/OCHA CC BY-IGO", "LGD/Bharatlas CC0-1.0", "Lahore case study: OpenStreetMap contributors ODbL-1.0"],
    "samplingMetres": 28,
    "inputs": {},
    "layers": {},
}
collections = {}


def read(key):
    if key not in collections:
        raw = (DATA / (key + ".geojson")).read_bytes()
        collections[key] = json.loads(raw)
        manifest["inputs"][key] = hashlib.sha256(raw).hexdigest()
    return collections[key]


def polygons(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [geometry]
    if geometry.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [p for g in geometry.geoms for p in polygons(g)]
    return []


def polygonal(geometry):
    parts = polygons(geometry)
    return unary_union(parts) if parts else Polygon()


def foreign_target(source, reference):
    combined = unary_union([source, reference])
    reference_edges = reference.boundary.buffer(1e-9)
    source_edges = source.boundary.buffer(1e-9)
    shapely.prepare(reference_edges)
    shapely.prepare(source_edges)
    gaps = []
    for polygon in polygons(combined):
        for ring in polygon.interiors:
            hole = Polygon(ring)
            # Keep genuine source holes and excluded scenario areas. Repair only
            # holes with edges belonging to both sides of this shared frontier.
            if (hole.area > EPS
                    and reference_edges.intersects(hole.boundary)
                    and source_edges.intersects(hole.boundary)
                    and hole.boundary.intersection(reference_edges).length > 1e-6
                    and hole.boundary.intersection(source_edges).length > 1e-6):
                gaps.append(hole)
    gap = unary_union(gaps) if gaps else Polygon()
    return polygonal(source.union(gap).difference(reference)), gaps


def lines(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type in ("LineString", "LinearRing"):
        return [geometry]
    if geometry.geom_type in ("MultiLineString", "GeometryCollection"):
        return [line for g in geometry.geoms for line in lines(g)]
    return []


def allocate_part(gap, features, geometries):
    if gap.is_empty or gap.area < EPS:
        return {}
    # Local equirectangular coordinates prevent longitude degrees from getting
    # the same distance weight as latitude degrees at Punjab's latitude.
    project = lambda x, y, z=None: (x * X_SCALE, y)
    unproject = lambda x, y, z=None: (x / X_SCALE, y)
    projected_gap = transform(project, gap)
    corridor = projected_gap.buffer(STEP * 2)
    samples = {}
    for feature, geometry in zip(features, geometries):
        if not geometry.envelope.intersects(gap.envelope):
            continue
        edge = transform(project, geometry.boundary).intersection(corridor)
        for line in lines(edge):
            count = max(1, math.ceil(line.length / STEP))
            for i in range(count + 1):
                point = line.interpolate(i / count, normalized=True)
                key = (round(point.x, 11), round(point.y, 11))
                samples.setdefault(key, feature["id"])
    if not samples:
        raise ValueError("No source boundary owns the repair gap")
    ids = list(samples.values())
    if len(samples) == 1:
        return {ids[0]: gap}
    cells = shapely.voronoi_polygons(MultiPoint(list(samples)), extend_to=projected_gap.envelope, ordered=True)
    parts = polygons(projected_gap)
    tree = STRtree(parts)
    assigned = {}
    for area_id, cell in zip(ids, cells.geoms):
        for index in tree.query(cell, predicate="intersects"):
            part = polygonal(cell.intersection(parts[index]))
            if not part.is_empty:
                assigned.setdefault(area_id, []).append(part)
    result = {area_id: polygonal(transform(unproject, unary_union(parts))) for area_id, parts in assigned.items()}
    coverage = unary_union(list(result.values()))
    if gap.symmetric_difference(coverage).area > 1e-9:
        raise ValueError("Repair allocation did not cover the entire gap")
    return result


def allocate(gap, features, geometries):
    if gap.is_empty or gap.area < EPS:
        return {}
    pieces = polygons(gap)
    tree = STRtree(geometries)
    assigned = {}
    print(f"  Allocating {len(pieces)} source-edition slivers", flush=True)
    for piece in pieces:
        candidates = tree.query(piece.buffer(STEP * 2), predicate="intersects")
        if not len(candidates):
            candidates = [tree.nearest(piece)]
        if len(candidates) == 1:
            allocations = {features[candidates[0]]["id"]: piece}
        else:
            allocations = allocate_part(piece, [features[i] for i in candidates], [geometries[i] for i in candidates])
        for area_id, geometry in allocations.items():
            assigned.setdefault(area_id, []).append(geometry)
    result = {area_id: polygonal(unary_union(parts)) for area_id, parts in assigned.items()}
    if gap.symmetric_difference(unary_union(list(result.values()))).area > 1e-9:
        raise ValueError("Source-edition slivers were not fully allocated")
    return result


def write_overrides(key, original, corrected, target=None):
    changed = []
    for feature, geometry in zip(original["features"], corrected):
        raw = shape(feature["geometry"])
        if raw.equals_exact(geometry, 0) or raw.symmetric_difference(geometry).area < EPS:
            continue
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError(f"Invalid corrected geometry: {key} {feature['id']}")
        if not geometry.covers(Point(feature["properties"]["center"])):
            raise ValueError(f"Repair moved source label outside its area: {key} {feature['id']}")
        changed.append({"type": "Feature", "id": feature["id"], "properties": {"id": feature["id"], "displayAlignment": "punjab-frontier-v1"}, "bbox": list(geometry.bounds), "geometry": mapping(geometry)})
    if not changed:
        return
    result = {"type": "FeatureCollection", "features": changed}
    raw = (json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
    (OUT / (key + ".geojson")).write_bytes(raw)
    manifest["layers"][key] = {"count": len(changed), "ids": [f["id"] for f in changed], "bounds": {f["id"]: f["bbox"] for f in changed}, "sha256": hashlib.sha256(raw).hexdigest()}
    if target is not None:
        union = unary_union(corrected)
        if union.symmetric_difference(target).area > 1e-9:
            raise ValueError(f"Corrected layer misses its target outline: {key}")
    print(f"{key}: {len(changed)} aligned geometries, {len(raw):,} bytes", flush=True)


def reconcile(key, target, cut=None, selected=None):
    source = read(key)
    features = source["features"] if selected is None else [f for f in source["features"] if selected(f)]
    geometries = [shape(f["geometry"]) for f in features]
    gap = target.difference(unary_union(geometries))
    additions = allocate(gap, features, geometries)
    shapely.prepare(target)
    corrections = {}
    for feature, geometry in zip(features, geometries):
        aligned = geometry if target.covers(geometry) else geometry.intersection(target) if cut is None else geometry.difference(cut)
        if feature["id"] in additions:
            aligned = aligned.union(additions[feature["id"]])
        corrections[feature["id"]] = polygonal(aligned)
    corrected = [corrections.get(f["id"], shape(f["geometry"])) for f in source["features"]]
    if selected is not None and unary_union(list(corrections.values())).symmetric_difference(target).area > 1e-9:
        raise ValueError(f"Corrected selection misses its target outline: {key}")
    write_overrides(key, source, corrected, target if selected is None else None)
    return corrections


india = shape(read("in-punjab-region")["features"][0]["geometry"])
pakistan = shape(read("pk-punjab-region")["features"][0]["geometry"])
pk_target, gaps = foreign_target(pakistan, india)
manifest["frontierGaps"] = {"count": len(gaps), "areaSquareDegrees": sum(g.area for g in gaps), "probes": [list(g.representative_point().coords)[0] for g in sorted(gaps, key=lambda g: -g.area)[:20]]}
manifest["overlapSquareDegrees"] = pakistan.intersection(india).area
print(f"Punjab frontier: {len(gaps)} enclosed gaps; no buffering or expansion of the combined outer outline", flush=True)
write_overrides("pk-punjab-region", read("pk-punjab-region"), [pk_target], pk_target)
districts = reconcile("pk-punjab-district", pk_target)
for key in ("pk-punjab-tehsil", "pk-punjab-uc", "pk-country-tehsil"):
    features = read(key)["features"]
    selected = (lambda f: f["properties"].get("province") == "Punjab") if key == "pk-country-tehsil" else None
    source = unary_union([shape(f["geometry"]) for f in features if selected is None or selected(f)])
    target, _ = foreign_target(source, india)
    reconcile(key, target, selected=selected)

# The Indian tehsil edition uses a different outer edge from the district
# edition. Close its slivers against the same reference used above.
reconcile("in-punjab-tehsil", india)

# The full-country view contains the same WFP district identities under its
# own IDs. Reuse the district correction instead of changing other provinces.
for key in ("pk-country-region", "pk-country-province", "pk-country-district"):
    source = read(key)
    corrected = []
    extra = pk_target.difference(pakistan)
    for feature in source["features"]:
        geometry = shape(feature["geometry"])
        p = feature["properties"]
        if key.endswith("district") and p.get("sourceCode") in districts:
            geometry = districts[p["sourceCode"]]
        elif key.endswith("region") or p.get("sourceCode") == "PK6":
            geometry = polygonal(geometry.difference(india).union(extra))
        corrected.append(geometry)
    write_overrides(key, source, corrected)

for key in ("pk-punjab-division", "pk-country-division"):
    source = read(key)
    corrected = []
    country = key.startswith("pk-country")
    district_source = read("pk-country-district" if country else "pk-punjab-district")
    for feature in source["features"]:
        members = feature["properties"].get("districtIds")
        if members is None:
            # Regional Punjab divisions use the catalog's division membership.
            membership = json.loads((ROOT / "app/pakistan-division-sources.json").read_text(encoding="utf-8"))
            entry = next((e for e in membership.get("divisions", []) if e.get("id") == feature["id"] or e.get("name", "") + " Division" == feature["properties"]["name"]), None)
            members = entry.get("sourceDistrictCodes", []) if entry else []
        shapes = []
        for member in district_source["features"]:
            if member["id"] in members:
                code = member["properties"].get("sourceCode", member["id"])
                shapes.append(districts.get(code, shape(member["geometry"])))
        corrected.append(polygonal(unary_union(shapes)) if shapes else shape(feature["geometry"]))
    write_overrides(key, source, corrected)

# The Lahore case study remains partial. Close only holes at the international
# frontier; Model Town, Raiwind and the original scenario exclusions stay out.
case_source = read("pk-lahore-study-tehsil")
case_outline = unary_union([shape(f["geometry"]) for f in case_source["features"]])
case_target, _ = foreign_target(case_outline, india)
reconcile("pk-lahore-study-tehsil", case_target)
write_overrides("pk-lahore-study-region", read("pk-lahore-study-region"), [case_target], case_target)

manifest["generator"] = {"shapely": shapely.__version__, "geos": shapely.geos_version_string}
(ROOT / "app/punjab-seam-sources.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("Saved sparse display overrides and provenance manifest.", flush=True)
