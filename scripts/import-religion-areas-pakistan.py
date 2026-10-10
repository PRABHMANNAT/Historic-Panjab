#!/usr/bin/env python3
"""Append verified Pakistan Punjab Census 2023 Table 9 religion facts.

Run after import-religion-areas.py:
  python scripts/import-religion-areas-pakistan.py

The checked-in source extracts were fetched from official PBS Excel/PDF files.
Every Excel total + eight-community vector is independently checked against the
44-page PDF extract, and all counts/sex and district totals must reconcile.
No third-party estimate or state/province-average substitution is used.
"""
import argparse
from collections import Counter, defaultdict
import copy
import hashlib
import json
from pathlib import Path
import re

SOURCE_ID = "pbs-2023-table9-punjab"
SOURCE_URL = "https://www.pbs.gov.pk/result-excel/"
EXCEL_URL = "https://www.pbs.gov.pk/wp-content/uploads/2020/07/table_9_punjab_districts.xlsx"
PDF_URL = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_punjab_districts.pdf"
SOURCE_HASHES = {
    "punjab-table9-excel.md": "383f7724bb54f7a09f71da694605f01ba1375022fec2e1e80d2e337b57992852",
    "punjab-table9-pdf.md": "5d4ca4a3082bd7d47bf0f4608efc33883ee1c19b9a8ec5fc891a5140f0120006",
}
RELIGIONS = ["Muslim", "Christian", "Hindu Jati", "Qadiani / Ahmadi",
             "Scheduled Castes", "Sikh", "Parsi", "Others"]
ALIASES = {
    "leiah": "layyah", "kalurkot": "kallurkot", "pasroor": "pasrur",
    "silanwali": "sillanwali", "shujabad": "shujaabad", "summundri": "sammundri",
    "kotchatta": "kotchhutta", "atharahazari": "18hazari",
    "kotradhakishen": "kotradhakishan",
    "naushera": "nowshera", "liaqatpur": "liaquatpur",
}
PAKISTAN_COVERAGE = ("Pakistan: Punjab Census 2023 Table 9 total-person religion counts, "
                     "matched independently to the two published Punjab map catalogs. "
                     "The official table uses 36 district units. Its eight community categories "
                     "are retained separately from the Indian Census categories.")

def require(condition, message):
    if not condition:
        raise ValueError(message)

def normalize(name):
    normalized = re.sub(r"[^a-z0-9]", "", name.lower())
    return ALIASES.get(normalized, normalized)

def cells_for(line):
    if not line.startswith("|"):
        return None
    cells = [cell.strip() for cell in line.strip("|").split("|")]
    while len(cells) > 10 and not cells[-1]:
        cells.pop()
    return cells if len(cells) == 10 else None

def numbers(cells):
    return [0 if cell == "-" else int(cell.replace(",", "")) for cell in cells]

def parse_excel_extract(text):
    name, district, level, locality = None, None, None, None
    totals, sex_rows = {}, defaultdict(dict)
    for line in text.splitlines():
        cells = cells_for(line)
        if not cells:
            continue
        head = cells[0]
        if head.endswith(" DISTRICT"):
            district = head[:-9].strip()
            name, level, locality = district, "district", None
        elif head.endswith(" TEHSIL"):
            name, level, locality = head[:-7].strip(), "tehsil", None
        elif head == "PUNJAB":
            name, level, locality = "PUNJAB", "province", None
        elif head and not any(cells[1:]) and head not in ["ALL LOCALITIES", "RURAL", "URBAN"]:
            # De-excluded Rajanpur is a separate source statistical area, not an
            # invented tehsil. Retain it for source reconciliation only.
            name, level, locality = head, "special", None
        elif head in ["ALL LOCALITIES", "RURAL", "URBAN"]:
            locality = head
        elif head in ["ALL SEXES", "MALE", "FEMALE", "TRANSGENDER"] and locality == "ALL LOCALITIES" and name:
            values = numbers(cells[1:])
            require(values[0] == sum(values[1:]), f"Religion totals do not reconcile for {name}/{head}")
            key = (level, district if level in ["tehsil", "special"] else "", name)
            require(head not in sex_rows[key], f"Repeated source sex row: {key}/{head}")
            sex_rows[key][head] = values
            if head == "ALL SEXES":
                totals[key] = values
    require(Counter(k[0] for k in totals) == {"province": 1, "district": 36, "tehsil": 145, "special": 1},
            "Unexpected Punjab source coverage")
    for key, values in totals.items():
        sexes = sex_rows[key]
        require(set(sexes) == {"ALL SEXES", "MALE", "FEMALE", "TRANSGENDER"}, f"Missing sex row: {key}")
        require([sum(sexes[sex][i] for sex in ["MALE", "FEMALE", "TRANSGENDER"]) for i in range(9)] == values,
                f"Sex totals do not reconcile: {key}")
    province = totals[("province", "", "PUNJAB")]
    require([sum(v[i] for k, v in totals.items() if k[0] == "district") for i in range(9)] == province,
            "District totals do not reconcile to Punjab province")
    return [{"level": key[0], "district": key[1], "name": key[2], "population": values[0], "counts": values[1:]}
            for key, values in totals.items()]

def load_sources(folder):
    extracts = {}
    for filename, digest in SOURCE_HASHES.items():
        path = folder / filename
        require(path.is_file(), f"Missing checked-in official source extract: {path}")
        text = path.read_text(encoding="utf-8")
        canonical = "\n".join(text.splitlines()) + "\n"
        require(hashlib.sha256(canonical.encode("utf-8")).hexdigest() == digest, f"Changed source extract: {path}")
        extracts[filename] = text
    records = parse_excel_extract(extracts["punjab-table9-excel.md"])
    # Page-break headings in a PDF can move outside markdown table cells. Compare
    # complete numeric vectors, preserving the Excel's explicit district context.
    pdf_vectors = []
    for line in extracts["punjab-table9-pdf.md"].splitlines():
        cells = cells_for(line)
        if cells and cells[0] == "ALL SEXES":
            pdf_vectors.append(numbers(cells[1:]))
    require(len(pdf_vectors) == 549, "Unexpected PDF numeric-row coverage")
    for row in records:
        require([row["population"], *row["counts"]] in pdf_vectors,
                f"Official Excel/PDF values disagree: {row['name']}")
    return records

def join(catalog, source_rows):
    eligible = [a for a in catalog if a["level"] in ["district", "tehsil"] and
                (a["region"] == "pk-punjab" or (a["region"] == "pk-country" and a.get("province") == "Punjab"))]
    source_districts = {normalize(r["name"]): r for r in source_rows if r["level"] == "district"}
    source_tehsils = [r for r in source_rows if r["level"] == "tehsil"]
    unique_tehsil_names = defaultdict(list)
    for row in source_tehsils:
        unique_tehsil_names[normalize(row["name"])].append(row)
    changed = set()
    for a in eligible:
        if a["level"] != "tehsil" or a["id"].startswith("lahore-t-"):
            continue
        matches = unique_tehsil_names.get(normalize(a["name"]), [])
        if len(matches) == 1 and normalize(matches[0]["district"]) != normalize(a.get("district", "")):
            changed.add((a["region"], normalize(matches[0]["district"])))
            changed.add((a["region"], normalize(a.get("district", ""))))
    records, omitted = [], []
    source_keys_in_region = set()
    for a in eligible:
        if a["id"].startswith("lahore-t-"):
            omitted.append({"areaId": a["id"], "sourceId": SOURCE_ID,
                            "reason": "The legacy Lahore tehsil polygons are explicitly unverified August 2025 source units. Similar names do not establish a match to the five Census 2023 tehsils."})
            continue
        if a["level"] == "district":
            row = source_districts.get(normalize(a["name"]))
            if (a["region"], normalize(a["name"])) in changed:
                row = None
        else:
            candidates = [r for r in source_tehsils if normalize(r["name"]) == normalize(a["name"]) and
                          normalize(r["district"]) == normalize(a.get("district", ""))]
            row = candidates[0] if len(candidates) == 1 else None
        if row is None:
            omitted.append({"areaId": a["id"], "sourceId": SOURCE_ID,
                            "reason": "No unique exact name and Census district match. Newer subdivisions, combined city/saddar polygons, tribal areas, or changed source parent links are not estimated."})
            continue
        key = f"pbs-2023-punjab:{row['level']}:{normalize(row['district'])}:{normalize(row['name'])}"
        require((a["region"], key) not in source_keys_in_region, f"One Census unit repeats within one map edition: {key}")
        source_keys_in_region.add((a["region"], key))
        religions = [{"name": name, "population": count, "share": round(count * 100 / row["population"], 2)}
                     for name, count in zip(RELIGIONS, row["counts"])]
        religions.sort(key=lambda v: (-v["population"], RELIGIONS.index(v["name"])))
        records.append({"areaId": a["id"], "regionId": a["region"], "level": a["level"], "year": 2023,
                        "population": row["population"], "religions": religions, "sourceIds": [SOURCE_ID],
                        "censusCode": "", "censusName": row["name"], "sourceAreaKey": key,
                        "sourceDistrictName": row["district"],
                        "matchMethod": "Exact normalized unit name and district in the published Punjab Table 9; explicit spelling aliases only. No official unit code is supplied in this table.",
                        "note": "Pakistan Census 2023 Table 9 unit; map source boundaries may differ. Source categories are retained; shares use the religion-table population. This is not a current population estimate."})
    return records, omitted, eligible

def append(base_audit, base_runtime, catalog, rows):
    audit, runtime = copy.deepcopy(base_audit), copy.deepcopy(base_runtime)
    india_before = [r for r in audit["records"] if SOURCE_ID not in r["sourceIds"]]
    india_runtime_before = [r for r in runtime["records"] if r[5] != SOURCE_ID]
    records, omitted, eligible = join(catalog, rows)
    source = {"id": SOURCE_ID, "title": "Pakistan Census 2023, Table 9: Population by sex, religion and rural/urban, Punjab district and tehsil tables",
              "url": SOURCE_URL, "downloadUrl": EXCEL_URL, "pdfUrl": PDF_URL, "year": 2023,
              "publisher": "Pakistan Bureau of Statistics", "retrieved": "2026-10-11",
              "sourceCategories": RELIGIONS,
              "sha256": SOURCE_HASHES["punjab-table9-excel.md"], "hashKind": "SHA-256 of the official Excel text extract normalized to UTF-8 LF line endings, not the binary workbook",
              "extractFiles": [{"path": f"scripts/data/pbs-2023/{filename}", "sha256": digest} for filename, digest in SOURCE_HASHES.items()],
              "extraction": "Firecrawl fetched the official XLSX and all 44 PDF pages with HTTP 200. Every total-person eight-category Excel vector matches the independently parsed official PDF. Checked-in text extracts reproduce the transformation offline.",
              "categoryNote": "The Pakistan Census categories differ from India. Hindu Jati, Scheduled Castes, Qadiani / Ahmadi, Parsi and Others remain separately reported; unreported Indian category names are not assigned zero counts.",
              "populationNote": "Percentages use the total-person population in Table 9, which may differ from the population published in other census tables. District sums reconcile to the Table 9 Punjab total of 127333305.",
              "geographyNote": "The published Table 9 uses 36 Punjab district units. The atlas contains these source-era units in both its legacy Punjab and WFP country catalogs. Exact name/district joins do not assert identical boundaries or present-day district coverage. Lahore's unverified 2025 polygons and unmatched city/saddar splits are withheld."}
    audit["sources"] = [s for s in audit["sources"] if s["id"] != SOURCE_ID] + [source]
    audit["records"] = india_before + sorted(records, key=lambda r: r["areaId"])
    audit["omittedAreas"] = [r for r in audit["omittedAreas"] if r.get("sourceId") != SOURCE_ID] + sorted(omitted, key=lambda r: r["areaId"])
    audit["years"] = [2011, 2023]
    audit["coverage"] = audit["coverage"].split("\nPakistan: ")[0] + "\n" + PAKISTAN_COVERAGE
    audit["geographyNote"] = audit["geographyNote"].split("\nPakistan: ")[0] + "\nPakistan: " + source["geographyNote"]
    audit["unsupportedCountries"] = "Pakistan Punjab is covered at district/tehsil level where a verified name/district join exists. Other Pakistan provinces and neighbouring countries remain without imported district/tehsil religion records."
    audit["coverageByRegion"] = [r for r in audit["coverageByRegion"] if r["regionId"] not in ["pk-punjab", "pk-country"]]
    for region in ["pk-punjab", "pk-country"]:
        matched = [r for r in records if r["regionId"] == region]
        region_areas = [a for a in eligible if a["region"] == region]
        audit["coverageByRegion"].append({"regionId": region, "geographicSubset": "Punjab province only", "year": 2023,
                                          "districts": sum(r["level"] == "district" for r in matched),
                                          "districtsInCatalog": sum(a["level"] == "district" for a in region_areas),
                                          "tehsils": sum(r["level"] == "tehsil" for r in matched),
                                          "tehsilsInCatalog": sum(a["level"] == "tehsil" for a in region_areas)})
    runtime["coverage"] = audit["coverage"]
    runtime["geographyNote"] = audit["geographyNote"]
    runtime["sources"] = [s for s in runtime["sources"] if s["id"] != SOURCE_ID] + [{k: source[k] for k in ["id", "title", "url"]}]
    runtime["years"] = audit["years"]
    runtime["religionNamesBySource"] = {**runtime.get("religionNamesBySource", {}), SOURCE_ID: RELIGIONS}
    runtime["records"] = india_runtime_before + [[r["areaId"], r["regionId"], r["level"], r["population"],
                            [next(v["population"] for v in r["religions"] if v["name"] == name) for name in RELIGIONS],
                            SOURCE_ID, r["censusName"], r["censusCode"], 2023] for r in sorted(records, key=lambda r: r["areaId"])]
    require([r for r in audit["records"] if SOURCE_ID not in r["sourceIds"]] == india_before, "Indian audit records changed")
    require([r for r in runtime["records"] if r[5] != SOURCE_ID] == india_runtime_before, "Indian runtime tuples changed")
    require(len(set(r["areaId"] for r in audit["records"])) == len(audit["records"]), "Duplicate atlas record")
    require(set(r["areaId"] for r in audit["records"]).isdisjoint(r["areaId"] for r in audit["omittedAreas"]), "Record also omitted")
    return audit, runtime

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("scripts/data/pbs-2023"))
    parser.add_argument("--catalog", type=Path, default=Path("app/catalog.json"))
    parser.add_argument("--audit", type=Path, default=Path("app/religion-area-data.json"))
    parser.add_argument("--runtime", type=Path, default=Path("app/religion-area-runtime.json"))
    parser.add_argument("--output-audit", type=Path)
    parser.add_argument("--output-runtime", type=Path)
    args = parser.parse_args()
    rows = load_sources(args.input_dir)
    audit, runtime = append(json.loads(args.audit.read_text(encoding="utf-8")),
                            json.loads(args.runtime.read_text(encoding="utf-8")),
                            json.loads(args.catalog.read_text(encoding="utf-8")), rows)
    (args.output_audit or args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_runtime or args.runtime).write_text(json.dumps(runtime, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    for region in audit["coverageByRegion"][-2:]:
        print(region)
    print(f"Verified source: 36 districts, 145 tehsils; appended {sum(SOURCE_ID in r['sourceIds'] for r in audit['records'])} atlas records across two editions.")

if __name__ == "__main__":
    main()
