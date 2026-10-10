#!/usr/bin/env python3
"""Import Census of India 2011 C-01 district and subdistrict religion totals.

Requires xlrd. Example:
  python scripts/import-religion-areas.py --input-dir work/c01 --download

Official state workbooks contain towns as well as subdistricts. Only Total rows
with town code 000000 are imported; town populations are never used as tehsil
populations. Joins are conservative and retain the original Census codes.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.request import Request, urlopen

import xlrd

RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain",
             "Other religions and persuasions", "Religion not stated"]
# Catalog IDs follow the official alphabetical state table sequence. Codes are
# Census 2011 state codes (not current LGD state identifiers).
STATES = {
    "01": ("Jammu and Kashmir", 11376), "02": ("Himachal Pradesh", 11375),
    "03": ("Punjab", 11389), "04": ("Chandigarh", 11367),
    "05": ("Uttarakhand", 11395), "06": ("Haryana", 11374),
    "07": ("NCT of Delhi", 11371), "08": ("Rajasthan", 11390),
    "09": ("Uttar Pradesh", 11394), "10": ("Bihar", 11366),
    "11": ("Sikkim", 11391), "12": ("Arunachal Pradesh", 11364),
    "13": ("Nagaland", 11386), "14": ("Manipur", 11383),
    "15": ("Mizoram", 11385), "16": ("Tripura", 11393),
    "17": ("Meghalaya", 11384), "18": ("Assam", 11365),
    "19": ("West Bengal", 11396), "20": ("Jharkhand", 11377),
    "21": ("Odisha", 11387), "22": ("Chhattisgarh", 11368),
    "23": ("Madhya Pradesh", 11381), "24": ("Gujarat", 11373),
    "25": ("Daman and Diu", 11370), "26": ("Dadra and Nagar Haveli", 11369),
    "27": ("Maharashtra", 11382), "28": ("Andhra Pradesh", 11363),
    "29": ("Karnataka", 11378), "30": ("Goa", 11372),
    "31": ("Lakshadweep", 11380), "32": ("Kerala", 11379),
    "33": ("Tamil Nadu", 11392), "34": ("Puducherry", 11388),
    "35": ("Andaman and Nicobar Islands", 11362),
}
REGION_CODES = {
    "in-jammu-kashmir": ["01"], "in-ladakh": ["01"],
    "in-himachal": ["02"], "in-punjab": ["03"], "chandigarh": ["04"],
    "in-uttarakhand": ["05"], "in-haryana": ["06"], "in-delhi": ["07"],
    "in-rajasthan": ["08"], "in-uttar-pradesh": ["09"], "in-bihar": ["10"],
    "in-sikkim": ["11"], "in-arunachal": ["12"], "in-nagaland": ["13"],
    "in-manipur": ["14"], "in-mizoram": ["15"], "in-tripura": ["16"],
    "in-meghalaya": ["17"], "in-assam": ["18"], "in-west-bengal": ["19"],
    "in-jharkhand": ["20"], "in-odisha": ["21"], "in-chhattisgarh": ["22"],
    "in-madhya-pradesh": ["23"], "in-gujarat": ["24"],
    "in-dnh-dd": ["25", "26"], "in-maharashtra": ["27"],
    "in-andhra": ["28"], "in-telangana": ["28"], "in-karnataka": ["29"],
    "in-goa": ["30"], "in-lakshadweep": ["31"], "in-kerala": ["32"],
    "in-tamil-nadu": ["33"], "in-puducherry": ["34"],
    "in-andaman-nicobar": ["35"],
}
# Exact name aliases are spelling/renaming equivalences only. No fuzzy matches,
# spatial allocation, proportional estimates, or state averages are used.
ALIASES = {
    "s a s nagar": "sahibzada ajit singh nagar", "sas nagar": "sahibzada ajit singh nagar",
    "shahid bhagat singh nagar": "shaheed bhagat singh nagar",
    "sri muktsar sahib": "muktsar", "ferozepur": "firozpur",
    "gurugram": "gurgaon", "nuh": "mewat", "prayagraj": "allahabad",
    "ayodhya": "faizabad", "amethi": "chhatrapati shahuji maharaj nagar",
    "sambhal": "bhim nagar", "hapur": "panchsheel nagar",
    "kasganj": "kanshiram nagar", "sant ravidas nagar bhadohi": "sant ravidas nagar",
    "bhadohi": "sant ravidas nagar", "salem": "salem", "bangalore urban": "bangalore",
    "bengaluru urban": "bangalore", "bengaluru rural": "bangalore rural",
    "belagavi": "belgaum", "ballari": "bellary", "vijayapura": "bijapur",
    "chikkamagaluru": "chikmagalur", "kalaburagi": "gulbarga", "mysuru": "mysore",
    "tumakuru": "tumkur", "shivamogga": "shimoga", "yadgiri": "yadgir",
    "hoshangabad": "hoshangabad", "narmadapuram": "hoshangabad", "adilabad": "adilabad",
    "ahilyanagar": "ahmadnagar", "ahmednagar": "ahmadnagar", "chhatrapati sambhajinagar": "aurangabad",
    "dharashiv": "osmanabad", "hugli": "hugli", "hooghly": "hugli",
    "purulia": "puruliya", "balasore": "baleshwar", "baleshwar": "baleshwar",
    "subarnapur": "subarnapur", "sonapur": "subarnapur", "jagatsinghapur": "jagatsinghpur",
    "kendrapada": "kendrapara", "deogarh": "debagarh", "dhenkanal": "dhenkanal",
    "leh": "leh ladakh", "leh ladakh": "leh ladakh", "kupwara": "kupwara",
    "lahul and spiti": "lahul spiti", "lahaul and spiti": "lahul spiti",
    "south 24 parganas": "south twenty four parganas", "north 24 parganas": "north twenty four parganas",
    "spsr nellore": "sri potti sriramulu nellore", "nellore": "sri potti sriramulu nellore",
    "rangareddy": "rangareddy", "ranga reddy": "rangareddy", "ysr": "y s r",
    "kanniyakumari": "kanniyakumari", "kanyakumari": "kanniyakumari",
    "the nilgiris": "the nilgiris", "nilgiris": "the nilgiris", "thoothukkudi": "thoothukkudi",
    "tuticorin": "thoothukkudi", "villupuram": "viluppuram", "viluppuram": "viluppuram",
    "shahjahanpur": "shahjahanpur", "charaideo": "charaideo",
    "uttar kashi": "uttarkashi", "rudra prayag": "rudraprayag", "pauri garhwal": "garhwal",
    "udam singh nagar": "udham singh nagar", "haridwar": "hardwar",
    "south andamans": "south andaman", "north and middle andaman": "north middle andaman",
    "visakhapatanam": "visakhapatnam", "marigaon": "morigaon", "kamrup metro": "kamrup metropolitan",
    "purbi champaran": "purba champaran", "dantewada": "dakshin bastar dantewada",
    "kanker": "uttar bastar kanker", "kabirdham": "kabirdham kawardha", "korea": "koriya",
    "dadra and nagar haveli": "dadra nagar haveli", "dang": "the dangs",
    "poonch": "punch", "budgam": "badgam", "baramulla": "baramula", "bandipora": "bandipore",
    "shopian": "shupiyan", "east singhbum": "purbi singhbhum", "east singhbhum": "purbi singhbhum",
    "west singhbhum": "pashchimi singhbhum", "koderma": "kodarma", "sahebganj": "sahibganj",
    "bagalkote": "bagalkot", "chamarajanagara": "chamarajanagar", "davangere": "davanagere",
    "east nimar": "khandwa", "narsinghpur": "narsimhapur", "beed": "bid", "buldhana": "buldana",
    "gondia": "gondiya", "raigad": "raigarh", "ri bhoi": "ribhoi", "boudh": "baudh",
    "nabarangpur": "nabarangapur", "sonepur": "subarnapur", "pondicherry": "puducherry",
    "kanchipuram": "kancheepuram", "mahabubnagar": "mahbubnagar", "amroha": "jyotiba phule nagar",
    "hathras": "mahamaya nagar", "maharajganj": "mahrajganj", "sant kabeer nagar": "sant kabir nagar",
    "shravasti": "shrawasti", "24 paraganas north": "north twenty four parganas",
    "24 paraganas south": "south twenty four parganas", "coochbehar": "koch bihar",
    "darjeeling": "darjiling", "dinajpur dakshin": "dakshin dinajpur", "dinajpur uttar": "uttar dinajpur",
    "howrah": "haora", "medinipur east": "purba medinipur", "medinipur west": "paschim medinipur",
}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def normalize(name):
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c)).lower()
    name = re.sub(r"\b(?:district|sub district|subdistrict|tehsil|tahsil|taluk|taluka|mandal)\b", "", name)
    name = re.sub(r"\([^)]*\)", " ", name)
    name = re.sub(r"[^a-z0-9]+", " ", name).strip()
    # Spaces/hyphens vary in the two official source editions (Bara Banki vs
    # Barabanki, for example). They do not convey a different administrative unit.
    return ALIASES.get(name, name).replace(" ", "")

def source_for(code):
    name, catalog_id = STATES[code]
    return {"id": f"census-2011-c01-{code}",
            "title": f"Census of India 2011: C-01, Population by religious community, {name}",
            "url": f"https://censusindia.gov.in/nada/index.php/catalog/{catalog_id}",
            "downloadUrl": f"https://censusindia.gov.in/nada/index.php/catalog/{catalog_id}/download/{catalog_id + 3113}/DDW{code}C-01%20MDDS.XLS",
            "year": 2011, "publisher": "Office of the Registrar General & Census Commissioner, India"}

def download(code, folder):
    path = folder / f"state{code}.xls"
    if not path.exists():
        request = Request(source_for(code)["downloadUrl"], headers={"User-Agent": "OpenCarto/1.0 Census importer"})
        with urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
    return code

def read_rows(folder):
    output, sources = [], []
    for code in sorted(STATES):
        path = folder / f"state{code}.xls"
        require(path.is_file(), f"Missing workbook: {path}")
        source = source_for(code)
        source["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        sources.append(source)
        book = xlrd.open_workbook(path)
        sheet = book.sheet_by_index(0)
        require(sheet.ncols == 34 and sheet.cell_value(2, 10) == "Hindu", f"Unexpected C-01 columns: {path}")
        for index in range(7, sheet.nrows):
            row = sheet.row_values(index)
            if row[1] != code or row[6] != "Total" or row[4] != "000000" or row[2] == "000":
                continue
            level = "district" if row[3] == "00000" else "tehsil"
            name = re.sub(r"^(?:District|Sub-District)\s*-\s*", "", row[5]).strip()
            population = int(row[7])
            counts = [int(row[10 + r * 3]) for r in range(8)]
            require(sum(counts) == population, f"Religion totals do not reconcile: {code}/{row[2]}/{row[3]}")
            output.append({"state": code, "district": row[2], "subdistrict": row[3], "name": name,
                           "level": level, "population": population, "counts": counts})
    return output, sources

def area_source_code(area):
    return str(area.get("subdistrict_lgd") or area.get("sourceCode") or area["id"].rsplit("-", 1)[-1]).zfill(5)

def build(catalog, rows, sources):
    # District names are unique within Census state; tehsils are matched only by
    # code+name or an exact name under an independently matched Census district.
    districts = {(r["state"], normalize(r["name"])): r for r in rows if r["level"] == "district"}
    by_id = {a["id"]: a for a in catalog}
    census_parent = {}
    for a in catalog:
        if a["region"] in REGION_CODES and a["level"] == "district":
            candidates = [districts[(code, normalize(a["name"]))] for code in REGION_CODES[a["region"]]
                          if (code, normalize(a["name"])) in districts]
            if len(candidates) == 1:
                census_parent[a["id"]] = candidates[0]
    tehsils = [r for r in rows if r["level"] == "tehsil"]
    matches, omitted = {}, []
    eligible = [a for a in catalog if a["region"] in REGION_CODES and a["level"] in ("district", "tehsil")]
    for a in eligible:
        if a["level"] == "district":
            if a["id"] in census_parent:
                matches[a["id"]] = (census_parent[a["id"]], "exact district name within Census state")
            continue
        codes = REGION_CODES[a["region"]]
        name = normalize(a["name"])
        candidates = [r for r in tehsils if r["state"] in codes and r["subdistrict"] == area_source_code(a)
                      and normalize(r["name"]) == name]
        method = "exact subdistrict code and name within Census state"
        if len(candidates) != 1:
            parent = census_parent.get(a["parent"])
            candidates = [r for r in tehsils if parent and r["state"] == parent["state"] and
                          r["district"] == parent["district"] and normalize(r["name"]) == name]
            method = "exact subdistrict name under independently matched Census district"
        if len(candidates) == 1:
            matches[a["id"]] = (candidates[0], method)
    # A surviving name does not make an old district total valid after a split.
    # When a matched 2011 child now belongs to a different catalog district, the
    # old district's totals are withheld. The new district has no invented total.
    changed = {}
    for area_id, (row, _) in list(matches.items()):
        a = by_id[area_id]
        if a["level"] != "tehsil":
            continue
        current_parent = census_parent.get(a["parent"])
        if current_parent and (current_parent["state"], current_parent["district"]) == (row["state"], row["district"]):
            continue
        for parent_id, parent_row in census_parent.items():
            if (parent_row["state"], parent_row["district"]) == (row["state"], row["district"]):
                changed[parent_id] = "2011 Census children are linked to a different catalog district; current source parent links or boundaries do not match the Census district. The old district total is withheld."
    # The map explicitly documents Rajasthan's 2023 district reorganisation and
    # older subdistrict parent links. Those links cannot establish unchanged
    # district boundaries, so district totals are withheld for this snapshot.
    for a in eligible:
        if a["level"] == "district" and a["region"] == "in-rajasthan":
            changed[a["id"]] = "Atlas Rajasthan district polygons follow the 2023 reorganisation but subdistrict parent links predate it; no verified 2011-to-2024 district boundary crosswalk is available."
    for area_id in changed:
        matches.pop(area_id, None)
    # Several published map records have a conflicting same-code parent link.
    # Do not repeat one Census population across two modern polygons.
    census_matches = defaultdict(list)
    for area_id, (row, _) in matches.items():
        census_matches[(row["state"], row["district"], row["subdistrict"])].append(area_id)
    ambiguous = {area_id for ids in census_matches.values() if len(ids) > 1 for area_id in ids}
    for area_id in ambiguous:
        matches.pop(area_id)
    records = []
    for a in eligible:
        match = matches.get(a["id"])
        if not match:
            reason = "One Census unit matches multiple conflicting source polygons; no population is duplicated or allocated." if a["id"] in ambiguous else changed.get(a["id"], "No unique verified 2011 Census geography match; newer or differently named boundaries are not estimated.")
            omitted.append({"areaId": a["id"], "reason": reason})
            continue
        row, method = match
        census_code = f"{row['state']}-{row['district']}" + (f"-{row['subdistrict']}" if a["level"] == "tehsil" else "")
        religions = [{"name": name, "population": count,
                      "share": round(count * 100 / row["population"], 2) if row["population"] else 0}
                     for name, count in zip(RELIGIONS, row["counts"])]
        religions.sort(key=lambda r: (-r["population"], RELIGIONS.index(r["name"])))
        records.append({"areaId": a["id"], "regionId": a["region"], "level": a["level"], "year": 2011,
                        "population": row["population"], "religions": religions,
                        "sourceIds": [f"census-2011-c01-{row['state']}"], "censusCode": census_code,
                        "censusName": row["name"], "matchMethod": method,
                        "note": "2011 Census unit; later map boundaries may differ. This is not a current population estimate."})
    by_region = []
    for region in REGION_CODES:
        region_areas = [a for a in eligible if a["region"] == region]
        region_records = [r for r in records if r["regionId"] == region]
        by_region.append({"regionId": region,
                          "districts": sum(r["level"] == "district" for r in region_records),
                          "districtsInCatalog": sum(a["level"] == "district" for a in region_areas),
                          "tehsils": sum(r["level"] == "tehsil" for r in region_records),
                          "tehsilsInCatalog": sum(a["level"] == "tehsil" for a in region_areas)})
    return {"year": 2011, "retrieved": "2026-10-11",
            "coverage": "Census of India 2011 C-01 district and subdistrict (tehsil/taluk/mandal/circle/block) total-persons religion counts. Only conservative unique joins to the atlas are shown. Town rows are excluded. Missing units and detected split-district totals are unshaded; no state average or population allocation is substituted.",
            "geographyNote": "Statistics describe Census 2011 units while the atlas uses later published boundaries. Exact name/code crosswalks are not a claim that all boundaries remained identical. Source Census codes and original unit names are retained for every record.",
            "unsupportedCountries": "No district/tehsil religion table has yet been crosswalked for Pakistan or other neighbouring countries; these areas remain without statistics.",
            "sources": sources, "coverageByRegion": by_region,
            "omittedAreas": sorted(omitted, key=lambda r: r["areaId"]),
            "records": sorted(records, key=lambda r: r["areaId"])}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--catalog", type=Path, default=Path("app/catalog.json"))
    parser.add_argument("--output", type=Path, default=Path("app/religion-area-data.json"))
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--source-manifest", type=Path, default=Path("app/religion-area-data.json"),
                        help="Existing dataset whose workbook SHA-256 digests must match before regeneration")
    parser.add_argument("--runtime-output", type=Path, default=Path("app/religion-area-runtime.json"),
                        help="Compact runtime projection, with religion counts in fixed religionNames order")
    args = parser.parse_args()
    args.input_dir.mkdir(parents=True, exist_ok=True)
    if args.download:
        with ThreadPoolExecutor(max_workers=5) as pool:
            for code in pool.map(lambda code: download(code, args.input_dir), sorted(STATES)):
                print(f"Downloaded state {code}", flush=True)
    rows, sources = read_rows(args.input_dir)
    if args.source_manifest.exists():
        pinned = json.loads(args.source_manifest.read_text(encoding="utf-8"))
        expected = {s["id"]: s["sha256"] for s in pinned["sources"]}
        for source in sources:
            require(expected.get(source["id"]) == source["sha256"],
                    f"Workbook digest changed for {source['id']}; review the source before updating provenance")
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    result = build(catalog, rows, sources)
    ids = [r["areaId"] for r in result["records"]]
    require(len(set(ids)) == len(ids), "Duplicate atlas area record")
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    runtime = {"year": result["year"], "coverage": result["coverage"], "geographyNote": result["geographyNote"],
               "sources": [{k: source[k] for k in ("id", "title", "url")} for source in result["sources"]],
               "religionNames": RELIGIONS,
               "records": [[r["areaId"], r["regionId"], r["level"], r["population"],
                            [next(v["population"] for v in r["religions"] if v["name"] == name) for name in RELIGIONS],
                            r["sourceIds"][0], r["censusName"], r["censusCode"]] for r in result["records"]]}
    for original, projected in zip(result["records"], runtime["records"]):
        require(sum(projected[4]) == original["population"], f"Runtime population mismatch: {original['areaId']}")
        require(len(projected[4]) == len(RELIGIONS), "Missing runtime religion category")
    args.runtime_output.write_text(json.dumps(runtime, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Imported {len(result['records'])} records; {len(result['omittedAreas'])} Indian atlas units have no reliable match.")
    for region in result["coverageByRegion"]:
        print(region)

if __name__ == "__main__":
    main()
