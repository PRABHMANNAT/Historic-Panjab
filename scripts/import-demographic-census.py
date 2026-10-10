#!/usr/bin/env python3
"""Reproduce the atlas demographics from pinned Census of India 2011 tables.

Dependencies: openpyxl and xlrd. Run from the project root, for example:
  python scripts/import-demographic-census.py --input-dir /tmp/census --download

The tracked JSON supplies source URLs, SHA-256 digests, geographical coverage,
notes, and Census state codes. Numeric indicators are recomputed from the actual
workbooks. Changed-boundary regions remain omitted, never inferred.
"""

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

import openpyxl
import xlrd


TABLE_FILES = {
    "census-2011-pca": "pca.xlsx",
    "census-2011-c16": "language.xlsx",
    "census-2011-c01": "religion.xls",
}
RELIGIONS = [
    "Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain",
    "Other religions and persuasions", "Religion not stated",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def regenerate(manifest, input_dir):
    """Read final counts; preserve only the manifest's verified coverage."""
    pca_book = openpyxl.load_workbook(
        input_dir / TABLE_FILES["census-2011-pca"], read_only=True, data_only=True
    )
    pca_rows = list(pca_book.active.values)
    headers = pca_rows[0]
    require(all(key in headers for key in ["State", "Level", "TRU", "TOT_P", "P_06", "P_LIT"]),
            "Unexpected PCA columns")
    pca = [dict(zip(headers, row)) for row in pca_rows[1:] if row[0] and row[6] == "STATE"]
    pca_book.close()
    language_book = openpyxl.load_workbook(
        input_dir / TABLE_FILES["census-2011-c16"], read_only=True, data_only=True
    )
    language_rows = list(language_book.active.values)
    require(language_rows[2][1] == "State" and language_rows[3][7] == "P",
            "Unexpected C-16 columns")
    language_book.close()
    religion_sheet = xlrd.open_workbook(
        input_dir / TABLE_FILES["census-2011-c01"]
    ).sheet_by_index(0)
    require(religion_sheet.cell_value(2, 10) == "Hindu" and
            religion_sheet.cell_value(3, 7) == "Persons", "Unexpected C-01 columns")
    religion_rows = [religion_sheet.row_values(i) for i in range(7, religion_sheet.nrows)]

    output = copy.deepcopy(manifest)
    for record in output["records"]:
        codes = record["censusStateCodes"]
        region_id = record["regionId"]
        totals = [row for row in pca if row["State"] in codes and row["TRU"] == "Total"]
        urban = [row for row in pca if row["State"] in codes and row["TRU"] == "Urban"]
        require(len(totals) == len(codes) and len(urban) == len(codes),
                f"Missing PCA state total for {region_id}")
        population = sum(row["TOT_P"] for row in totals)
        children = sum(row["P_06"] for row in totals)
        literate = sum(row["P_LIT"] for row in totals)
        require(population > children >= 0 and 0 <= literate <= population - children,
                f"Invalid literacy denominator for {region_id}")

        tongues = {}
        for row in language_rows[6:]:
            # Suffix 000 denotes a language-group subtotal; terminal 124000 is
            # unclassified OTHERS with no child rows and belongs in the remainder.
            if (row[1] in codes and row[2] == "000" and row[3] == "00000" and row[5]
                    and (not row[5].endswith("000") or row[5] == "124000") and row[7]):
                name = row[6].strip()
                if re.match(r"^\d+\s+Others$", name, re.I):
                    name = "Other / unclassified mother tongues"
                tongues[name] = tongues.get(name, 0) + int(row[7])
        require(sum(tongues.values()) == population,
                f"Mother-tongue counts do not reconcile to population for {region_id}")
        largest = [item for item in sorted(tongues.items(), key=lambda item: item[1], reverse=True)
                   if item[0] != "Other / unclassified mother tongues"][:6]
        languages = [{"name": name, "share": round(count * 100 / population, 2),
                      "population": count} for name, count in largest]
        remainder = population - sum(count for _, count in largest)
        if remainder:
            languages.append({"name": "Other reported mother tongues",
                              "share": round(remainder * 100 / population, 2),
                              "population": remainder, "isRemainder": True})

        religion = [row for row in religion_rows if row[1] in codes and
                    row[2] == "000" and row[6] == "Total"]
        require(len(religion) == len(codes), f"Missing C-01 state total for {region_id}")
        religions = []
        for index, name in enumerate(RELIGIONS):
            count = int(sum(row[10 + index * 3] for row in religion))
            religions.append({"name": name, "share": round(count * 100 / population, 2),
                              "population": count})
        require(sum(item["population"] for item in religions) == population,
                f"Religious-community counts do not reconcile for {region_id}")
        religions.sort(key=lambda item: item["population"], reverse=True)
        record.update({"population": population,
                       "literacy": round(literate * 100 / (population - children), 2),
                       "urbanShare": round(sum(row["TOT_P"] for row in urban) * 100 / population, 2),
                       "languages": languages, "religions": religions})
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=Path("app/demographic-data.json"))
    parser.add_argument("--output", type=Path, default=Path("app/demographic-data.json"))
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    args.input_dir.mkdir(parents=True, exist_ok=True)
    sources = {source["id"]: source for source in manifest["sources"]}
    for source_id, filename in TABLE_FILES.items():
        source = sources[source_id]
        path = args.input_dir / filename
        if args.download:
            request = Request(source["downloadUrl"], headers={"User-Agent": "HistoricPanjab/1.0 census importer"})
            with urlopen(request, timeout=60) as response:
                path.write_bytes(response.read())
        require(path.is_file(), f"Missing input workbook: {path}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        require(digest == source["sha256"],
                f"Source digest mismatch for {filename}. Review changed inputs before updating provenance.")
    result = regenerate(manifest, args.input_dir)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Reproduced {len(result['records'])} regions from the three pinned official Census tables.")


if __name__ == "__main__":
    main()
