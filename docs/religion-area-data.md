# District and tehsil religion data

The district and subdistrict layer uses the Census of India **2011 C-01** tables
published by the Office of the Registrar General & Census Commissioner, India.
It describes Census 2011 populations, not present-day estimates.

`app/religion-area-data.json` is the audit dataset. It retains all eight religious
community counts, derived percentages, original Census codes and names, matching
methods, omitted atlas units, source download links, and workbook SHA-256 hashes.
`app/religion-area-runtime.json` contains the same facts in a compact tuple format
for the application. Its `religionNames` array fixes the Indian count order;
`religionNamesBySource` supplies the eight distinct Pakistan source categories.
Tuple index 8 holds the year when it differs from the default Indian year 2011.

The importer reads all 35 Census state/UT workbooks. It selects **Total persons**
rows with town code `000000`, thereby excluding towns, rural/urban subtotals, and
sex-specific columns. All eight community counts must sum to the source population.
It never substitutes a town population for its surrounding tehsil.

Subdistrict joins require an exact Census code and normalized name within the
source state, or an exact name under an independently matched Census district.
District joins require an exact normalized name within the source state. A small
explicit spelling/rename alias table and space/hyphen normalization are retained
in the importer. There is no fuzzy matching, proportional allocation, or state
average fallback. A Census unit matching multiple conflicting map polygons is
withheld rather than duplicated.

The atlas uses later published boundary snapshots. These name/code joins do not
prove that every local boundary remained unchanged after 2011. When Census
subdistricts have a different catalog district parent, the original district total
is withheld. Rajasthan district totals are withheld because its atlas source
documents the 2023 district reorganisation with older subdistrict parent links.
Newer units and unmatched units remain without statistics. Coverage and individual
omission reasons are recorded in the audit dataset.

Pakistan Punjab uses the official **Census 2023 Table 9**
([PBS Excel tables](https://www.pbs.gov.pk/result-excel/)). The original
[Excel workbook](https://www.pbs.gov.pk/wp-content/uploads/2020/07/table_9_punjab_districts.xlsx)
and all 44 pages of the
[PDF table](https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_punjab_districts.pdf)
were retrieved independently through Firecrawl. The original text extracts are
retained in `scripts/data/pbs-2023`, with hashes normalized to UTF-8 LF line endings.
These are extract hashes, not binary workbook hashes.

The source has 36 districts and 145 tehsils. All eight community counts and sex
totals reconcile; all district vectors sum to the published Punjab Table 9 vector.
Every Excel total-person vector matches the independent PDF. Table 9's population
can differ from totals in other Census tables: shares use its own denominator.

Exact unit and district names link the records separately to two atlas editions:
36 districts and 133 tehsils in legacy Punjab, and 36 districts and 135 tehsils in
the WFP country catalog's Punjab subset. Both catalogs contain source-era district
units; these are not a claim of present-day district coverage. The same Census
fact can have an ID in each map edition. It is never repeated within one edition.
The ten unverified August 2025 legacy Lahore polygons, combined city/saddar areas,
and unmatched source units remain without statistics.

Pakistan's published labels—Muslim, Christian, Hindu Jati, Qadiani / Ahmadi,
Scheduled Castes, Sikh, Parsi, and Others—are retained without combining categories
or assigning zero to unreported Indian categories. PBS Table 9 supplies names
rather than administrative codes; `censusCode` is empty and `sourceAreaKey` is an
explicitly derived name path, not an invented official code. Other Pakistan
provinces and neighbouring-country units remain without district/tehsil records.

To reproduce both files, install `xlrd`, then run from the project root:

```sh
python scripts/import-religion-areas.py --input-dir work/c01 --download
python scripts/import-religion-areas-pakistan.py
```

The existing audit file pins workbook hashes. A changed download is rejected and
must be reviewed before its provenance is updated. Files already present in the
input folder are reused, allowing an offline deterministic regeneration. The
Pakistan append importer is independently reproducible from checked-in source
extracts, preserves all Indian records, and removes its previous records before
appending, so running it again is idempotent.
