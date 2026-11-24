#!/usr/bin/env python3
"""
ingest_catalogue.py - Data Ingestion, Atomic Row-Level Chunking & Metadata Indexing
for Canonical_X_Catalogue dataset (1,224 rows, columns A:Y).

Strictly enforces:
1. Atomic Row-Level Chunking (1 Row = 1 Primary Chunk) in structured Markdown.
   Internal QA columns (Source_Match_Status, Source_Match_Confidence, Source_Notes)
   are explicitly EXCLUDED from embedded text.
2. Secondary Parent Chunks (Category Summaries for all unique Capability_Families).
3. Metadata Schema Payload for hybrid pre-filtering (applies_to, capability_type,
   capability_family, provider, geo_constraint, industry_constraint, company_type_constraint,
   cost_value, cost_type).
4. Generates 384-dimensional dense embeddings via fastembed (BAAI/bge-small-en-v1.5).
5. Persists chunks, metadata, and vectors into SQLite database (catalogue_rag.db)
   and exports catalogue_rag_indexed.json.
"""

import os
import sys
import json
import sqlite3
import argparse
from typing import List, Dict, Any, Optional
import openpyxl
import numpy as np

# Embedding model
try:
    from fastembed import TextEmbedding
    HAS_FASTEMBED = True
except ImportError:
    HAS_FASTEMBED = False


DEFAULT_XLSX_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "clay_catalog_source.xlsx"
)
DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "catalogue_rag.db"
)
DEFAULT_JSON_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "catalogue_rag_indexed.json"
)


def clean_str(val: Any, default: str = "") -> str:
    """Sanitize and clean string values."""
    if val is None:
        return default
    s = str(val).strip()
    if s.lower() in ("none", "null", "nan", "undefined", ""):
        return default
    return s


def parse_float(val: Any) -> Optional[float]:
    """Parse float cost safely."""
    if val is None:
        return None
    try:
        s = str(val).replace("$", "").replace("USD", "").replace("/row", "").strip()
        if s.lower() in ("none", "null", "unknown", ""):
            return None
        return float(s)
    except (ValueError, TypeError):
        return None


def build_primary_chunk_text(row: Dict[str, Any]) -> str:
    """
    Transform row into structured Markdown chunk strictly adhering to specification:
    Excluded QA columns: Source_Match_Status, Source_Match_Confidence, Source_Notes.
    """
    x_id = clean_str(row.get("X_ID"), "Unknown")
    name = clean_str(row.get("Canonical_X_Name"), "Unnamed Capability")
    family = clean_str(row.get("Capability_Family"), "General")
    target = clean_str(row.get("Applies_To"), "Both")
    cap_type = clean_str(row.get("Capability_Type"), "evidence_enrichment")
    provider = clean_str(row.get("Provider"), "Clay")

    summary = clean_str(row.get("Capability_Summary"))
    explanation = clean_str(row.get("Explanation"))
    evidence_caps = clean_str(row.get("Evidence_Capabilities"))
    output = clean_str(row.get("Typical_Output"))
    inputs = clean_str(row.get("Input_Requirements"))
    limitations = clean_str(row.get("Limitations"))

    geo_con = clean_str(row.get("Geographic_Constraints"), "None")
    ind_con = clean_str(row.get("Industry_Constraints"), "None")
    comp_con = clean_str(row.get("Company_Type_Constraints"), "None")

    cost_val = clean_str(row.get("Cost_Value"), "0")
    cost_unit = clean_str(row.get("Cost_Unit"), "credits")
    cost_type = clean_str(row.get("Cost_Type"), "fixed")
    cost_notes = clean_str(row.get("Cost_Notes"), "None")

    doc = f"""Capability ID: {x_id}
Name: {name}
Category: {family}
Target Entity: {target}
Capability Type: {cap_type}
Provider: {provider}

Summary: {summary}
Explanation: {explanation}
Evidence Capabilities: {evidence_caps}
Typical Output: {output}
Input Requirements: {inputs}
Limitations: {limitations}
Constraints: Geographic: {geo_con} | Industry: {ind_con} | Company Type: {comp_con}
Cost: {cost_val} {cost_unit} ({cost_type}) | Notes: {cost_notes}"""
    return doc.strip()


def build_parent_summary_chunk(family_name: str, family_rows: List[Dict[str, Any]]) -> str:
    """Build high-level Category Parent Summary chunk for two-stage routing."""
    count = len(family_rows)
    targets = sorted(list(set(clean_str(r.get("Applies_To")) for r in family_rows if clean_str(r.get("Applies_To")))))
    types = sorted(list(set(clean_str(r.get("Capability_Type")) for r in family_rows if clean_str(r.get("Capability_Type")))))
    providers = sorted(list(set(clean_str(r.get("Provider")) for r in family_rows if clean_str(r.get("Provider")))))[:8]

    # Sample top 5 capabilities in this family
    sample_caps = []
    for r in family_rows[:5]:
        cname = clean_str(r.get("Canonical_X_Name"))
        cprov = clean_str(r.get("Provider"))
        csum = clean_str(r.get("Capability_Summary")) or clean_str(r.get("Explanation"))
        if len(csum) > 90:
            csum = csum[:87] + "..."
        sample_caps.append(f"- {cname} (via {cprov}): {csum}")

    sample_text = "\n".join(sample_caps)

    doc = f"""Category Parent Summary: {family_name}
Chunk Type: Category_Parent_Summary
Total Capabilities in Category: {count}
Target Entities: {', '.join(targets)}
Capability Types: {', '.join(types)}
Primary Providers: {', '.join(providers)}

Overview:
The '{family_name}' capability family provides {count} specific data actions for finding, qualifying, and enriching target profiles.

Representative Capabilities in this Family:
{sample_text}"""
    return doc.strip()


def load_catalogue_rows(xlsx_path: str) -> List[Dict[str, Any]]:
    """Load exactly 1,224 rows from Canonical_X_Catalogue sheet."""
    if not os.path.exists(xlsx_path):
        raise FileNotFoundError(f"Source file not found at: {xlsx_path}")

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    if "Canonical_X_Catalogue" not in wb.sheetnames:
        raise ValueError(f"Sheet 'Canonical_X_Catalogue' not found in {xlsx_path}. Available: {wb.sheetnames}")

    sheet = wb["Canonical_X_Catalogue"]
    raw_rows = list(sheet.iter_rows(values_only=True))
    if not raw_rows:
        raise ValueError("Sheet is completely empty.")

    header = raw_rows[0]
    col_names = [str(h).strip() if h is not None else f"col_{idx}" for idx, h in enumerate(header)]

    records = []
    for row_idx, r in enumerate(raw_rows[1:], start=2):
        if all(c is None for c in r):
            continue
        record = {col_names[i]: r[i] for i in range(len(col_names))}
        record["_source_row_num"] = row_idx
        records.append(record)

    return records


def init_database(db_path: str) -> sqlite3.Connection:
    """Initialize SQLite database schema for hybrid filtering and retrieval."""
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS catalogue_chunks")
    cur.execute("""
        CREATE TABLE catalogue_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            x_id TEXT NOT NULL,
            chunk_type TEXT NOT NULL, /* 'primary' or 'category_parent' */
            canonical_name TEXT NOT NULL,
            applies_to TEXT NOT NULL,
            capability_type TEXT NOT NULL,
            capability_family TEXT NOT NULL,
            provider TEXT NOT NULL,
            geo_constraint TEXT,
            industry_constraint TEXT,
            company_type_constraint TEXT,
            cost_value REAL,
            cost_unit TEXT,
            cost_type TEXT,
            cost_is_estimate TEXT,
            input_requirements TEXT,
            typical_output TEXT,
            chunk_text TEXT NOT NULL,
            embedding_json TEXT NOT NULL
        )
    """)

    # Indices for high-performance metadata filtering
    cur.execute("CREATE INDEX idx_chunks_x_id ON catalogue_chunks(x_id)")
    cur.execute("CREATE INDEX idx_chunks_chunk_type ON catalogue_chunks(chunk_type)")
    cur.execute("CREATE INDEX idx_chunks_applies_to ON catalogue_chunks(applies_to)")
    cur.execute("CREATE INDEX idx_chunks_capability_type ON catalogue_chunks(capability_type)")
    cur.execute("CREATE INDEX idx_chunks_capability_family ON catalogue_chunks(capability_family)")
    cur.execute("CREATE INDEX idx_chunks_provider ON catalogue_chunks(provider)")
    cur.execute("CREATE INDEX idx_chunks_cost_value ON catalogue_chunks(cost_value)")

    conn.commit()
    return conn


def run_ingestion(
    xlsx_path: str = DEFAULT_XLSX_PATH,
    db_path: str = DEFAULT_DB_PATH,
    json_path: str = DEFAULT_JSON_PATH,
    batch_size: int = 64,
) -> Dict[str, Any]:
    """Execute the complete ingestion and chunking pipeline."""
    print("=" * 72)
    print("CANONICAL_X_CATALOGUE: RAG INGESTION & CHUNKING PIPELINE")
    print("=" * 72)
    print(f"Loading source dataset from: {xlsx_path}")

    records = load_catalogue_rows(xlsx_path)
    total_primary = len(records)
    print(f"✓ Successfully loaded {total_primary} records from Canonical_X_Catalogue.")

    # 1. Build Primary Chunks (1 Row = 1 Chunk)
    print("\n--- Step 1: Building Atomic Row-Level Primary Chunks ---")
    primary_chunks: List[Dict[str, Any]] = []
    family_groups: Dict[str, List[Dict[str, Any]]] = {}

    for r in records:
        chunk_text = build_primary_chunk_text(r)
        cost_val = parse_float(r.get("Cost_Value"))
        family = clean_str(r.get("Capability_Family"), "General")

        metadata = {
            "x_id": clean_str(r.get("X_ID")),
            "chunk_type": "primary",
            "canonical_name": clean_str(r.get("Canonical_X_Name")),
            "applies_to": clean_str(r.get("Applies_To"), "Both"),
            "capability_type": clean_str(r.get("Capability_Type")),
            "capability_family": family,
            "provider": clean_str(r.get("Provider")),
            "geo_constraint": clean_str(r.get("Geographic_Constraints")),
            "industry_constraint": clean_str(r.get("Industry_Constraints")),
            "company_type_constraint": clean_str(r.get("Company_Type_Constraints")),
            "cost_value": cost_val,
            "cost_unit": clean_str(r.get("Cost_Unit")),
            "cost_type": clean_str(r.get("Cost_Type")),
            "cost_is_estimate": clean_str(r.get("Cost_Is_Estimate")),
            "input_requirements": clean_str(r.get("Input_Requirements")),
            "typical_output": clean_str(r.get("Typical_Output")),
            "chunk_text": chunk_text,
        }
        primary_chunks.append(metadata)

        if family not in family_groups:
            family_groups[family] = []
        family_groups[family].append(r)

    print(f"✓ Formatted {len(primary_chunks)} atomic row-level primary chunks.")

    # 2. Build Category Parent Summary Chunks
    print("\n--- Step 2: Building Category Parent Summary Chunks ---")
    parent_chunks: List[Dict[str, Any]] = []
    for fam_name, fam_rows in sorted(family_groups.items()):
        p_text = build_parent_summary_chunk(fam_name, fam_rows)
        parent_chunk = {
            "x_id": f"PARENT-CAT-{abs(hash(fam_name)) % 100000:05d}",
            "chunk_type": "category_parent",
            "canonical_name": f"Category: {fam_name}",
            "applies_to": "Both",
            "capability_type": "category_summary",
            "capability_family": fam_name,
            "provider": "Clay Catalog",
            "geo_constraint": "",
            "industry_constraint": "",
            "company_type_constraint": "",
            "cost_value": 0.0,
            "cost_unit": "credits",
            "cost_type": "category_summary",
            "cost_is_estimate": "FALSE",
            "input_requirements": "",
            "typical_output": f"Routing summary for {fam_name}",
            "chunk_text": p_text,
        }
        parent_chunks.append(parent_chunk)

    print(f"✓ Created {len(parent_chunks)} secondary parent category summaries across all families.")

    all_chunks = primary_chunks + parent_chunks
    total_chunks = len(all_chunks)

    # 3. Embedding Generation
    print("\n--- Step 3: Generating 384-Dim Dense Embeddings ---")
    print(f"Model: BAAI/bge-small-en-v1.5 (FastEmbed ONNX) for {total_chunks} chunks...")

    if not HAS_FASTEMBED:
        raise RuntimeError("fastembed package is required. Install via pip install fastembed")

    embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    texts_to_embed = [c["chunk_text"] for c in all_chunks]

    embeddings = list(embed_model.embed(texts_to_embed, batch_size=batch_size))
    print(f"✓ Generated {len(embeddings)} dense embeddings (dimension: {len(embeddings[0])}).")

    for i, emb in enumerate(embeddings):
        all_chunks[i]["embedding"] = [float(x) for x in emb]

    # 4. Storage & Indexing in SQLite
    print("\n--- Step 4: Indexing & Upserting into SQLite Vector Database ---")
    conn = init_database(db_path)
    cur = conn.cursor()

    insert_rows = [
        (
            c["x_id"],
            c["chunk_type"],
            c["canonical_name"],
            c["applies_to"],
            c["capability_type"],
            c["capability_family"],
            c["provider"],
            c["geo_constraint"],
            c["industry_constraint"],
            c["company_type_constraint"],
            c["cost_value"],
            c["cost_unit"],
            c["cost_type"],
            c["cost_is_estimate"],
            c["input_requirements"],
            c["typical_output"],
            c["chunk_text"],
            json.dumps(c["embedding"]),
        )
        for c in all_chunks
    ]

    cur.executemany(
        """
        INSERT INTO catalogue_chunks (
            x_id, chunk_type, canonical_name, applies_to, capability_type,
            capability_family, provider, geo_constraint, industry_constraint,
            company_type_constraint, cost_value, cost_unit, cost_type,
            cost_is_estimate, input_requirements, typical_output,
            chunk_text, embedding_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        insert_rows,
    )
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM catalogue_chunks WHERE chunk_type = 'primary'")
    db_primary = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM catalogue_chunks WHERE chunk_type = 'category_parent'")
    db_parents = cur.fetchone()[0]
    conn.close()

    print(f"✓ SQLite database successfully written to: {db_path}")
    print(f"  - Primary row chunks indexed: {db_primary}")
    print(f"  - Parent category chunks indexed: {db_parents}")

    # 5. Export JSON
    print(f"\n--- Step 5: Exporting JSON index to {json_path} ---")
    os.makedirs(os.path.dirname(os.path.abspath(json_path)), exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, indent=2)
    print(f"✓ JSON index exported ({len(all_chunks)} items, {os.path.getsize(json_path) / 1024 / 1024:.2f} MB).")

    print("\n" + "=" * 72)
    print("INGESTION & INDEXING COMPLETED SUCCESSFULLY!")
    print("=" * 72)

    return {
        "total_primary_chunks": db_primary,
        "total_parent_chunks": db_parents,
        "db_path": db_path,
        "json_path": json_path,
        "embedding_dim": len(embeddings[0]),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest and chunk Canonical_X_Catalogue dataset.")
    parser.add_argument("--source", default=DEFAULT_XLSX_PATH, help="Path to source Excel file.")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="Output SQLite DB path.")
    parser.add_argument("--json-out", default=DEFAULT_JSON_PATH, help="Output JSON path.")
    parser.add_argument("--batch-size", type=int, default=64, help="Embedding batch size.")

    args = parser.parse_args()
    run_ingestion(
        xlsx_path=args.source,
        db_path=args.db,
        json_path=args.json_out,
        batch_size=args.batch_size,
    )

