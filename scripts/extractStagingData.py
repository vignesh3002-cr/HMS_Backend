"""
Build prisma/data/staging/*.json from EMR_Master_IHC_Genomics_TNM.xlsx.

Run from the backend folder:

    python scripts/extractStagingData.py "C:\\path\\to\\EMR_Master_IHC_Genomics_TNM.xlsx"

The workbook is the source of truth for the staging master tables; this script
only reshapes it into JSON with stable ids (content hashes, so re-seeding keeps
the same rule / category ids). Edit the workbook, re-run this, re-seed.
"""

import hashlib
import json
import os
import re
import sys

import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\ADMIN\Downloads\EMR_Master_IHC_Genomics_TNM.xlsx"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prisma", "data", "staging")
os.makedirs(OUT, exist_ok=True)

wb = openpyxl.load_workbook(SRC, data_only=True)


def rows(name):
    ws = wb[name]
    it = ws.iter_rows(values_only=True)
    headers = list(next(it))
    for row in it:
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        yield dict(zip(headers, row))


def text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def number(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def stable_id(prefix, *parts):
    raw = "|".join("" if p is None else str(p) for p in parts)
    return prefix + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]


# ---------------------------------------------------------------- schemas
schemas, seen = [], set()
for row in rows("Staging_Schemas"):
    code = text(row["Schema ID"])
    if not code or code in seen:
        continue
    seen.add(code)
    schemas.append({
        "schema_id": code,
        "schema_name": text(row["Schema"]),
        "system": text(row["System"]),
        "edition": text(row["Edition / version"]),
        "status": text(row["Status vs your workbook"]),
        "mode": (text(row["Mode"]) or "TNM").upper(),
        "extra_inputs": text(row["Extra inputs needed"]),
        "note": text(row["Note"]),
        "cancer_types_using": text(row["Cancer types using it"]),
        "display_order": int(code[1:]) if code[1:].isdigit() else None,
    })

# ------------------------------------------------------------ cancer type map
cancer_map, seen = [], set()
for row in rows("Staging_Map"):
    label = text(row["Cancer type (EMR dropdown)"])
    schema = text(row["Schema ID"])
    role = text(row["Role"])
    if not (label and schema and role):
        continue
    key = (label, schema, role)
    if key in seen:
        continue
    seen.add(key)
    cancer_map.append({
        "map_id": stable_id("SM", *key),
        "cancer_type_label": label,
        "schema_id": schema,
        "role": role.upper().replace("-", "").replace("_", ""),
        "schema_name": text(row["Schema name"]),
        "system_edition": text(row["System & edition"]),
        "subsite_question": text(row["Sub-site question shown"]),
        "auto_select_rule": text(row["Auto-select / pre-fill rule"]),
        "note": text(row["Note"]),
        "display_order": None,
    })

# ------------------------------------------------------------- categories
categories, seen = [], set()
for row in rows("TNM_Categories"):
    schema = text(row["Schema ID"])
    axis = text(row["Axis"])
    shown = text(row["Code (shown)"])
    rule = text(row["Rule code (used to match)"])
    context = (text(row["Context"]) or "both").lower()
    if not (schema and axis and shown and rule):
        continue
    key = (schema, axis, shown, rule, context)
    if key in seen:
        continue
    seen.add(key)
    categories.append({
        "category_id": stable_id("SC", *key),
        "schema_id": schema,
        "axis": axis.upper(),
        "shown_code": shown,
        "rule_code": rule,
        "context": context,
        "definition": text(row["Definition"]),
        "display_order": number(row["Order"]),
    })

# --------------------------------------------------------------- rules
# Condition cells look like "PSA = <10 / 10-<20; GG = 1". Groups are split on
# ";" (AND) and values on " / " (OR). Values themselves contain "/" — e.g.
# "Site = Gastric/omental", "Mitosis = ≤5/5mm²" — so a bare "/" must never be
# treated as a separator.
def parse_conditions(raw):
    if not raw:
        return []
    parsed = []
    for part in raw.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        key, value = part.split("=", 1)
        parsed.append({
            "key": key.strip(),
            "values": [v.strip() for v in re.split(r"\s+/\s+", value.strip()) if v.strip()],
        })
    return parsed


def split_list(value):
    value = text(value)
    return [v.strip() for v in value.split(",") if v.strip()] if value else []


rules, seen = [], set()
for row in rows("Stage_Rules"):
    schema = text(row["Schema ID"])
    context = (text(row["Context"]) or "both").lower()
    stage = text(row["Stage group"])
    if not (schema and stage):
        continue
    t = split_list(row["T (any of)"])
    n = split_list(row["N (any of)"])
    m = split_list(row["M (any of)"])
    raw = text(row["Other conditions"])
    key = (schema, context, stage, "|".join(t), "|".join(n), "|".join(m), raw)
    if key in seen:
        continue
    seen.add(key)
    rules.append({
        "rule_id": stable_id("SR", *key),
        "schema_id": schema,
        "context": context,
        "stage_group": stage,
        "t_codes": t,
        "n_codes": n,
        "m_codes": m,
        "conditions_raw": raw,
        "conditions": parse_conditions(raw),
        "criteria_text": text(row["Criteria (readable)"]),
        "flag": text(row["Flag"]),
        "display_order": None,
    })

# --------------------------------------------------------- direct stages
direct, seen = [], set()
for row in rows("Direct_Stages"):
    schema = text(row["Schema ID"])
    code = text(row["Stage / category"])
    if not (schema and code):
        continue
    key = (schema, code)
    if key in seen:
        continue
    seen.add(key)
    direct.append({
        "direct_stage_id": stable_id("SD", *key),
        "schema_id": schema,
        "stage_code": code,
        "definition": text(row["Definition"]),
        "display_order": number(row["Order"]),
        "flag": text(row["Flag"]),
    })

# --------------------------------------------------------------- inputs
inputs = [{
    "cancer_type_label": text(row["Cancer type"]),
    "schema_id": text(row["Schema"]),
    "source_module": text(row["Source module"]),
    "field": text(row["Field / marker / gene"]),
    "usage": text(row["How staging uses it"]),
    "found_in_source": text(row["Found in source sheet?"]),
} for row in rows("Staging_Inputs")]

general = [{
    "item": text(row["Item"]),
    "meaning": text(row["Meaning"]),
} for row in rows("Staging_General_Rules")]

# ------------------------------------------------------------- criteria
# The 7 condition keys the workbook uses, with the input the card renders.
criteria_meta = {
    "Age":     ("Age at diagnosis", "NUMBER", [], "years", "REG", 1),
    "PSA":     ("PSA", "BAND", ["<10", "10-<20", "≥20"], "ng/mL", "LAB", 2),
    "GG":      ("Grade Group", "ENUM", ["1", "2", "3", "4", "5"], None, "SCORE", 3),
    "S":       ("S category (IGCCCG)", "ENUM", ["SX", "S0", "S1", "S2", "S3"], None, "LAB", 4),
    "Grade":   ("Histologic grade", "ENUM", ["GX", "G1", "G2", "G3"], None, "DIAG", 5),
    "Site":    ("Primary site (NET)", "ENUM", ["Gastric/omental", "Small-intestine/other"], None, "DIAG", 6),
    "Mitosis": ("Mitotic rate", "ENUM", ["≤5/5mm²", ">5/5mm²"], None, "SCORE", 7),
}

used = sorted({c["key"] for rule in rules for c in rule["conditions"]})
unknown = [key for key in used if key not in criteria_meta]
if unknown:
    raise SystemExit(f"Unknown staging condition keys in workbook: {unknown}")

criteria = []
for key in used:
    label, input_type, options, unit, source, order = criteria_meta[key]
    criteria.append({
        "criterion_key": key,
        "label": label,
        "input_type": input_type,
        "options": options,
        "unit": unit,
        "source_module": source,
        "display_order": order,
    })

for name, data in [
    ("schemas", schemas), ("map", cancer_map), ("categories", categories),
    ("rules", rules), ("directStages", direct), ("inputs", inputs),
    ("generalRules", general), ("criteria", criteria),
]:
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
    print(f"{name:14} {len(data)}")
