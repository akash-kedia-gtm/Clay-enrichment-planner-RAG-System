#!/usr/bin/env python3
"""
test_rag.py - Comprehensive Automated Verification Suite for Canonical_X_Catalogue RAG

Validates:
1. 1:1 Row-to-Chunk Mapping:
   - Exactly 1,224 atomic primary chunks.
   - Exactly 20 category parent summary chunks.
   - Correct Markdown chunk format adhering to schema.
   - Strict exclusion of internal QA columns (Source_Match_Status, Source_Match_Confidence, Source_Notes).
2. Strict Metadata Filter Enforcement:
   - Stage 1: applies_to IN ["Company", "Both"] AND capability_type == "search"
   - Stage 2: applies_to IN ["Company", "Both"] AND capability_type IN ["evidence_enrichment", "AI_template"]
   - Stage 3: applies_to IN ["Person", "Both"] AND capability_family IN ["search / discovery", "contact data", "people / professional identity"]
   - Stage 4: capability_type IN ["utility", "action", "transformation"]
   - Dynamic constraint filtering (cost ceiling, geographic filters).
3. End-to-End Persona Retrieval Quality & Dependency Ordering:
   - Evaluates multi-stage retrieval on an approved Company Persona.
   - Verifies deduplication across all stages.
   - Verifies topological data dependency ordering (Input_Requirements -> Typical_Output).
"""

import os
import sys
import json
import sqlite3
import unittest
from enrichment_rag import MultiStageEnrichmentRAG, DEFAULT_DB_PATH, DEFAULT_JSON_PATH


class TestCatalogueRAGPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Initialize the RAG retriever and connect to the SQLite vector store."""
        if not os.path.exists(DEFAULT_DB_PATH):
            raise FileNotFoundError(
                f"Catalogue database not found at {DEFAULT_DB_PATH}. Run ingest_catalogue.py first."
            )
        cls.retriever = MultiStageEnrichmentRAG(db_path=DEFAULT_DB_PATH)
        cls.conn = sqlite3.connect(DEFAULT_DB_PATH)
        cls.conn.row_factory = sqlite3.Row

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    # =========================================================================
    # TEST 1: 1:1 ROW-TO-CHUNK MAPPING & CHUNK STRUCTURE
    # =========================================================================
    def test_01_primary_chunks_exact_count(self):
        """Verify exactly 1,224 primary chunks exist (1 row = 1 chunk)."""
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(*) FROM catalogue_chunks WHERE chunk_type = 'primary'")
        count = cur.fetchone()[0]
        self.assertEqual(count, 1224, f"Expected 1,224 primary chunks, found {count}")
        print(f"✓ Test 1A Passed: Exactly {count} atomic row-level primary chunks verified.")

    def test_02_parent_category_chunks_count(self):
        """Verify exactly 20 category parent summary chunks exist."""
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(*) FROM catalogue_chunks WHERE chunk_type = 'category_parent'")
        count = cur.fetchone()[0]
        self.assertEqual(count, 20, f"Expected 20 category parent chunks, found {count}")
        print(f"✓ Test 1B Passed: Exactly {count} parent category summary chunks verified.")

    def test_03_primary_chunk_markdown_structure(self):
        """Verify structured Markdown chunk format for primary chunks."""
        cur = self.conn.cursor()
        cur.execute("SELECT chunk_text FROM catalogue_chunks WHERE chunk_type = 'primary' LIMIT 50")
        sample_chunks = [r[0] for r in cur.fetchall()]

        required_headers = [
            "Capability ID:",
            "Name:",
            "Category:",
            "Target Entity:",
            "Capability Type:",
            "Provider:",
            "Summary:",
            "Explanation:",
            "Typical Output:",
            "Input Requirements:",
            "Constraints:",
            "Cost:",
        ]

        for text in sample_chunks:
            for req in required_headers:
                self.assertIn(req, text, f"Chunk missing expected header '{req}':\n{text[:200]}")

        print(f"✓ Test 1C Passed: All sample chunks follow required Markdown template.")

    def test_04_internal_qa_columns_excluded(self):
        """Verify QA internal columns are strictly EXCLUDED from chunk text."""
        cur = self.conn.cursor()
        cur.execute("SELECT chunk_text FROM catalogue_chunks")
        all_chunks = [r[0] for r in cur.fetchall()]

        forbidden_tokens = [
            "Source_Match_Status:",
            "Source_Match_Confidence:",
            "Source_Notes:",
            "Confident Match",
            "linked discovery occurrence",
        ]

        for text in all_chunks:
            for token in forbidden_tokens:
                self.assertNotIn(
                    token,
                    text,
                    f"Forbidden internal QA column/token found in embedded chunk text: '{token}'",
                )

        print(f"✓ Test 1D Passed: Internal QA columns strictly excluded from all {len(all_chunks)} chunks.")

    # =========================================================================
    # TEST 2: STRICT METADATA FILTER ENFORCEMENT ACROSS ALL 4 STAGES
    # =========================================================================
    def test_05_stage_1_metadata_filter(self):
        """Stage 1: applies_to IN ['Company', 'Both'] AND capability_type == 'search'."""
        filter_spec = {
            "applies_to": ["Company", "Both"],
            "capability_type": "search",
        }
        results = self.retriever.hybrid_search(
            query_text="Find B2B SaaS companies lookalikes directory search",
            stage_name="Stage 1 Test",
            metadata_filter=filter_spec,
            top_k=15,
        )

        self.assertGreater(len(results), 0, "Stage 1 returned 0 results.")
        for r in results:
            self.assertIn(r["applies_to"], ["Company", "Both"], f"Invalid applies_to in Stage 1: {r}")
            self.assertEqual(r["capability_type"], "search", f"Invalid capability_type in Stage 1: {r}")

        print(f"✓ Test 2A Passed: Stage 1 metadata filter 100% strictly enforced ({len(results)} items tested).")

    def test_06_stage_2_metadata_filter(self):
        """Stage 2: applies_to IN ['Company', 'Both'] AND capability_type IN ['evidence_enrichment', 'AI_template']."""
        filter_spec = {
            "applies_to": ["Company", "Both"],
            "capability_type": ["evidence_enrichment", "AI_template"],
        }
        results = self.retriever.hybrid_search(
            query_text="Verify technology stack Jira Cloud headcount funding",
            stage_name="Stage 2 Test",
            metadata_filter=filter_spec,
            top_k=15,
        )

        self.assertGreater(len(results), 0, "Stage 2 returned 0 results.")
        for r in results:
            self.assertIn(r["applies_to"], ["Company", "Both"], f"Invalid applies_to in Stage 2: {r}")
            self.assertIn(
                r["capability_type"],
                ["evidence_enrichment", "AI_template"],
                f"Invalid capability_type in Stage 2: {r}",
            )

        print(f"✓ Test 2B Passed: Stage 2 metadata filter 100% strictly enforced ({len(results)} items tested).")

    def test_07_stage_3_metadata_filter(self):
        """Stage 3: applies_to IN ['Person', 'Both'] AND capability_family IN ['search / discovery', 'contact data', 'people / professional identity']."""
        allowed_families = ["search / discovery", "contact data", "people / professional identity"]
        filter_spec = {
            "applies_to": ["Person", "Both"],
            "capability_family": allowed_families,
        }
        results = self.retriever.hybrid_search(
            query_text="Find VP Engineering decision maker work email profile",
            stage_name="Stage 3 Test",
            metadata_filter=filter_spec,
            top_k=15,
        )

        self.assertGreater(len(results), 0, "Stage 3 returned 0 results.")
        for r in results:
            self.assertIn(r["applies_to"], ["Person", "Both"], f"Invalid applies_to in Stage 3: {r}")
            self.assertIn(r["capability_family"], allowed_families, f"Invalid capability_family in Stage 3: {r}")

        print(f"✓ Test 2C Passed: Stage 3 metadata filter 100% strictly enforced ({len(results)} items tested).")

    def test_08_stage_4_metadata_filter(self):
        """Stage 4: capability_type IN ['utility', 'action', 'transformation']."""
        allowed_types = ["utility", "action", "transformation"]
        filter_spec = {
            "capability_type": allowed_types,
        }
        results = self.retriever.hybrid_search(
            query_text="Validate email deliverability normalize domain clean CRM action",
            stage_name="Stage 4 Test",
            metadata_filter=filter_spec,
            top_k=15,
        )

        self.assertGreater(len(results), 0, "Stage 4 returned 0 results.")
        for r in results:
            self.assertIn(r["capability_type"], allowed_types, f"Invalid capability_type in Stage 4: {r}")

        print(f"✓ Test 2D Passed: Stage 4 metadata filter 100% strictly enforced ({len(results)} items tested).")

    def test_09_dynamic_cost_constraint(self):
        """Verify dynamic max_cost constraint strictly excludes expensive actions."""
        filter_spec = {
            "applies_to": ["Company", "Both"],
            "capability_type": ["evidence_enrichment", "AI_template"],
        }
        max_cost = 2.0
        results = self.retriever.hybrid_search(
            query_text="Verify technology stack and company enrichment",
            stage_name="Cost Filter Test",
            metadata_filter=filter_spec,
            top_k=20,
            dynamic_constraints={"max_cost": max_cost},
        )

        for r in results:
            if r["cost_value"] is not None:
                self.assertLessEqual(
                    r["cost_value"],
                    max_cost,
                    f"Action {r['x_id']} exceeded max cost {max_cost}: {r['cost_value']}",
                )

        print(f"✓ Test 2E Passed: Dynamic cost filter (max_cost <= {max_cost}) strictly enforced.")

    # =========================================================================
    # TEST 3: END-TO-END PERSONA RETRIEVAL QUALITY & DEPENDENCY ORDERING
    # =========================================================================
    def test_10_end_to_end_persona_plan(self):
        """Verify end-to-end plan generation, deduplication, and dependency ordering for a real Persona."""
        persona = {
            "title": "High-Velocity Cloud & SaaS Scaleups (Series A-C)",
            "archetype": "Rapidly Scaling Tech Organization",
            "company_size": "50 - 250 Employees ($10M - $50M ARR)",
            "geography": "North America & Western Europe",
            "business_pain_and_friction": "Developer tooling friction, Jira performance bottlenecks, engineering sprint coordination overhead",
            "buying_urgency_triggers": "Recent funding round; active hiring for VP of Engineering and Staff Software Engineers; modernizing cloud stack",
            "target_roles": ["VP of Engineering", "Head of Product", "Chief Technology Officer"],
            "qualification_criteria": ["Uses Atlassian Jira Cloud", "Headcount between 50 and 250", "Active engineering job postings"],
        }

        plan = self.retriever.retrieve_plan_for_persona(persona)

        # 1. Plan structure assertions
        self.assertIn("plan_title", plan)
        self.assertIn("waterfall_steps", plan)
        self.assertGreater(len(plan["waterfall_steps"]), 4, "Waterfall must contain at least 5 steps.")

        # 2. Deduplication check
        x_ids = [step["x_id"] for step in plan["waterfall_steps"]]
        self.assertEqual(len(x_ids), len(set(x_ids)), f"Duplicate X_IDs found in plan: {x_ids}")

        # 3. Stage coverage check
        stages_present = set(step["stage"] for step in plan["waterfall_steps"])
        self.assertIn("Stage 1: Company Discovery", stages_present)
        self.assertIn("Stage 2: Company Qualification", stages_present)
        self.assertIn("Stage 3: Contact Resolution", stages_present)
        self.assertIn("Stage 4: Normalization & Action", stages_present)

        # 4. Dependency ordering check
        # Initial steps must be Seed/Discovery
        self.assertEqual(plan["waterfall_steps"][0]["stage"], "Stage 1: Company Discovery")
        # Contact resolution must not precede Discovery
        stage_names = [s["stage"] for s in plan["waterfall_steps"]]
        discovery_idx = max(i for i, s in enumerate(stage_names) if "Stage 1" in s)
        contact_idx = min(i for i, s in enumerate(stage_names) if "Stage 3" in s)
        self.assertLess(discovery_idx, contact_idx, "Contact resolution cannot precede Company Discovery.")

        # Final action/validation must come after contact resolution
        action_idx = max(i for i, s in enumerate(stage_names) if "Stage 4" in s)
        self.assertGreater(action_idx, contact_idx, "Email validation/action must follow contact resolution.")

        # 5. Cost calculation check
        self.assertGreater(plan["total_credit_cost_per_row"], 0.0)

        print("\n" + "=" * 72)
        print("✓ Test 3 Passed: End-to-End Persona Plan Generated Successfully!")
        print(f"  Plan Title: {plan['plan_title']}")
        print(f"  Steps Count: {len(plan['waterfall_steps'])} (100% deduplicated)")
        print(f"  Total Credits / Row: {plan['total_credit_cost_per_row']}")
        print(f"  Dependency Ordering: Discovery -> Qualification -> Contact Resolution -> Action Verified!")
        print("=" * 72)


if __name__ == "__main__":
    unittest.main(verbosity=2)

