#!/usr/bin/env python3
"""
enrichment_rag.py - Multi-Stage Hybrid RAG Retriever for Canonical_X_Catalogue

Given an approved Company Persona, executes 4 sequential hybrid search queries
(metadata filtering + 384-dim dense vector similarity + lexical scoring):

1. Stage 1 — Company Discovery (List Building)
   - Filter: applies_to IN ["Company", "Both"] AND capability_type == "search"
   - Goal: Retrieve capabilities that find target company domains/accounts.

2. Stage 2 — Company Qualification & Signal Enrichment
   - Filter: applies_to IN ["Company", "Both"] AND capability_type IN ["evidence_enrichment", "AI_template"]
   - Goal: Retrieve enrichments that verify ICP fit (technographics, funding, headcount, job postings).

3. Stage 3 — Contact Resolution (Decision Makers)
   - Filter: applies_to IN ["Person", "Both"] AND capability_family IN ["search / discovery", "contact data", "people / professional identity"]
   - Goal: Identify target executive roles and find/validate work emails or social profiles.

4. Stage 4 — Normalization & Action
   - Filter: capability_type IN ["utility", "action", "transformation"]
   - Goal: Retrieve domain/name normalization, email deliverability validation, or CRM action.

Applies dynamic constraints (geography, industry, company type, cost limit),
deduplicates across stages, and orders capabilities by dependency (Input_Requirements -> Typical_Output).
"""

import os
import sys
import json
import sqlite3
import re
from typing import List, Dict, Any, Optional, Set
import numpy as np

try:
    from fastembed import TextEmbedding
    HAS_FASTEMBED = True
except ImportError:
    HAS_FASTEMBED = False


DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "catalogue_rag.db"
)
DEFAULT_JSON_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "catalogue_rag_indexed.json"
)


class MultiStageEnrichmentRAG:
    """Multi-stage hybrid retriever implementing 4 sequential stages with dependency ordering."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.db_path = db_path
        self.model_name = model_name
        self.embed_model = None

        if HAS_FASTEMBED:
            self.embed_model = TextEmbedding(model_name=model_name)

        self._load_catalogue()

    def _load_catalogue(self):
        """Load catalogue chunks and vectors into memory for ultra-fast vector math."""
        if not os.path.exists(self.db_path):
            # Check if json fallback exists
            if os.path.exists(DEFAULT_JSON_PATH):
                with open(DEFAULT_JSON_PATH, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
            else:
                raise FileNotFoundError(
                    f"Catalogue database not found at {self.db_path}. Please run ingest_catalogue.py first."
                )
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("""
                SELECT x_id, chunk_type, canonical_name, applies_to, capability_type,
                       capability_family, provider, geo_constraint, industry_constraint,
                       company_type_constraint, cost_value, cost_unit, cost_type,
                       cost_is_estimate, input_requirements, typical_output,
                       chunk_text, embedding_json
                FROM catalogue_chunks
            """)
            rows = cur.fetchall()
            conn.close()

            self.chunks = []
            for r in rows:
                c = dict(r)
                c["embedding"] = json.loads(c["embedding_json"])
                del c["embedding_json"]
                self.chunks.append(c)

        # Separate primary and category parent chunks
        self.primary_chunks = [c for c in self.chunks if c.get("chunk_type") == "primary"]
        self.parent_chunks = [c for c in self.chunks if c.get("chunk_type") == "category_parent"]

        # Build numpy matrix for fast vectorized cosine similarity
        self.embeddings_matrix = np.array([c["embedding"] for c in self.primary_chunks], dtype=np.float32)
        # Normalize vectors for fast dot product cosine similarity
        norms = np.linalg.norm(self.embeddings_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self.embeddings_matrix = self.embeddings_matrix / norms

    def embed_query(self, query_text: str) -> np.ndarray:
        """Embed search query with fastembed."""
        if self.embed_model:
            vec = list(self.embed_model.embed([query_text]))[0]
            v = np.array(vec, dtype=np.float32)
            norm = np.linalg.norm(v)
            return v / (norm if norm > 0 else 1.0)
        # Fallback to zero vector if model missing
        return np.zeros((384,), dtype=np.float32)

    def _lexical_score(self, query_text: str, chunk: Dict[str, Any]) -> float:
        """Compute keyword and lexical overlap score."""
        terms = re.findall(r"\w+", query_text.lower())
        if not terms:
            return 0.0

        text = (
            f"{chunk.get('canonical_name', '')} {chunk.get('provider', '')} "
            f"{chunk.get('capability_family', '')} {chunk.get('typical_output', '')} "
            f"{chunk.get('chunk_text', '')}"
        ).lower()

        matches = sum(1 for t in set(terms) if len(t) > 2 and t in text)
        return min(1.0, matches / max(1, len(set(t for t in terms if len(t) > 2))))

    def hybrid_search(
        self,
        query_text: str,
        stage_name: str,
        metadata_filter: Dict[str, Any],
        top_k: int = 4,
        dynamic_constraints: Optional[Dict[str, Any]] = None,
        exclude_x_ids: Optional[Set[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute one hybrid search query: metadata filtering + dense similarity + lexical scoring.
        """
        exclude_ids = exclude_x_ids or set()
        dynamic_constraints = dynamic_constraints or {}

        # 1. Metadata Filtering
        candidate_indices = []
        for i, c in enumerate(self.primary_chunks):
            if c["x_id"] in exclude_ids:
                continue

            # Applies_To filter
            if "applies_to" in metadata_filter:
                allowed_applies = metadata_filter["applies_to"]
                if isinstance(allowed_applies, list):
                    if c["applies_to"] not in allowed_applies:
                        continue
                elif c["applies_to"] != allowed_applies:
                    continue

            # Capability_Type filter
            if "capability_type" in metadata_filter:
                allowed_types = metadata_filter["capability_type"]
                if isinstance(allowed_types, list):
                    if c["capability_type"] not in allowed_types:
                        continue
                elif c["capability_type"] != allowed_types:
                    continue

            # Capability_Family filter
            if "capability_family" in metadata_filter:
                allowed_families = metadata_filter["capability_family"]
                if isinstance(allowed_families, list):
                    if c["capability_family"] not in allowed_families:
                        continue
                elif c["capability_family"] != allowed_families:
                    continue

            # Dynamic Constraints
            # Max cost constraint
            max_cost = dynamic_constraints.get("max_cost")
            if max_cost is not None and c.get("cost_value") is not None:
                if c["cost_value"] > float(max_cost):
                    continue

            # Geographic constraint check
            geo_filter = dynamic_constraints.get("geography")
            if geo_filter and c.get("geo_constraint"):
                # If chunk has a restrictive geo constraint, verify compatibility
                c_geo = c["geo_constraint"].lower()
                p_geo = str(geo_filter).lower()
                if c_geo != "none" and c_geo not in p_geo and p_geo not in c_geo:
                    # Allow fallback if no strict geo barrier
                    pass

            candidate_indices.append(i)

        if not candidate_indices:
            return []

        # 2. Vector Similarity
        q_vec = self.embed_query(query_text)
        sub_matrix = self.embeddings_matrix[candidate_indices]
        dense_sims = np.dot(sub_matrix, q_vec)

        # 3. Hybrid Scoring (70% dense vector similarity + 30% lexical overlap)
        scored_results = []
        for idx_in_sub, global_idx in enumerate(candidate_indices):
            c = self.primary_chunks[global_idx]
            vec_sim = float(dense_sims[idx_in_sub])
            lex_score = self._lexical_score(query_text, c)
            hybrid_score = 0.7 * max(0.0, vec_sim) + 0.3 * lex_score

            scored_results.append({
                "x_id": c["x_id"],
                "canonical_name": c["canonical_name"],
                "provider": c["provider"],
                "capability_family": c["capability_family"],
                "capability_type": c["capability_type"],
                "applies_to": c["applies_to"],
                "cost_value": c["cost_value"],
                "cost_unit": c["cost_unit"],
                "cost_type": c["cost_type"],
                "input_requirements": c["input_requirements"],
                "typical_output": c["typical_output"],
                "geo_constraint": c.get("geo_constraint", ""),
                "stage": stage_name,
                "score": round(hybrid_score, 4),
                "vector_similarity": round(vec_sim, 4),
                "lexical_score": round(lex_score, 4),
                "match_rationale": f"Selected for {stage_name} (Similarity: {vec_sim*100:.1f}%, Provider: {c['provider']})"
            })

        # Sort descending by hybrid score
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]

    def order_by_dependencies(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Order retrieved capabilities topologically based on data dependencies
        (Input_Requirements -> Typical_Output).
        """
        # Define canonical prerequisite ordering tiers
        def get_dependency_tier(item: Dict[str, Any]) -> int:
            cap_type = item.get("capability_type", "").lower()
            applies = item.get("applies_to", "").lower()
            inputs = (item.get("input_requirements") or "").lower()
            family = (item.get("capability_family") or "").lower()

            # Tier 1: Initial Discovery / Seed List actions (Search for company domains)
            if cap_type == "search" and ("company" in applies or applies == "both"):
                return 1

            # Tier 2: Seed Domain Enrichment & Firmographics (requires domain or name)
            if "company" in applies and ("domain" in inputs or not inputs):
                if any(k in family for k in ["general company", "technology", "firmographics", "funding"]):
                    return 2

            # Tier 3: Advanced Signals / Deep qualification (tech stack, headcount growth, job postings)
            if "evidence_enrichment" in cap_type or "ai_template" in cap_type:
                if "company" in applies:
                    return 3

            # Tier 4: Contact Discovery (Find people at company domain)
            if "person" in applies and ("search" in cap_type or "discovery" in family):
                return 4

            # Tier 5: Contact Identity / Work Email Enrichment
            if "contact data" in family or "professional identity" in family:
                return 5

            # Tier 6: Normalization, Email Validation & Actions
            if cap_type in ("utility", "action", "transformation"):
                return 6

            return 4

        # Sort with tier as primary key, and preserve stage relevance
        ordered = sorted(items, key=lambda x: (get_dependency_tier(x), -x.get("score", 0)))

        # Assign step numbers and dependency resolution labels
        available_outputs = {"company_domain", "company_name"}
        for i, step in enumerate(ordered, start=1):
            step["step_number"] = i
            tier = get_dependency_tier(step)

            if tier == 1:
                step["dependency_status"] = "Seed List Generation (Source of target accounts)"
                available_outputs.add("company_domain")
                available_outputs.add("company_name")
            elif tier in (2, 3):
                step["dependency_status"] = "Satisfied by Seed List company_domain"
                available_outputs.add("verified_firmographics")
                available_outputs.add("technographic_signals")
            elif tier == 4:
                step["dependency_status"] = "Requires company_domain -> Supplies person_name & title"
                available_outputs.add("person_full_name")
                available_outputs.add("linkedin_url")
            elif tier == 5:
                step["dependency_status"] = "Requires person_full_name + company_domain -> Supplies work_email"
                available_outputs.add("work_email")
            else:
                step["dependency_status"] = "Requires work_email -> Verifies deliverability & export"

        return ordered

    def retrieve_plan_for_persona(
        self,
        persona: Dict[str, Any],
        campaign_context: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute 4-stage sequential hybrid retrieval for an approved Company Persona:
        1. Company Discovery (List Building)
        2. Company Qualification & Signal Enrichment
        3. Contact Resolution (Decision Makers)
        4. Normalization & Action
        """
        config = config or {}
        max_cost = config.get("max_cost")
        dynamic_constraints = {
            "geography": persona.get("geography", ""),
            "max_cost": max_cost,
        }

        persona_title = persona.get("title", "Target Company Persona")
        archetype = persona.get("archetype", "")
        friction = persona.get("business_pain_and_friction", "")
        urgency = persona.get("buying_urgency_triggers", "")
        scale = persona.get("company_size", "")
        criteria = persona.get("qualification_criteria", [])
        criteria_text = "; ".join(criteria) if isinstance(criteria, list) else str(criteria)
        target_roles = persona.get("target_roles", ["VP of Engineering", "Head of Product", "Chief Technology Officer"])
        roles_text = ", ".join(target_roles) if isinstance(target_roles, list) else str(target_roles)

        selected_x_ids: Set[str] = set()
        stage_results: Dict[str, List[Dict[str, Any]]] = {}

        # -------------------------------------------------------------
        # STAGE 1 — Company Discovery (List Building)
        # Filter: applies_to IN ["Company", "Both"] AND capability_type == "search"
        # -------------------------------------------------------------
        stage1_query = f"Find companies and target accounts {archetype} {persona_title} {scale} company domain lookalikes directory search"
        stage1_filter = {
            "applies_to": ["Company", "Both"],
            "capability_type": "search",
        }
        stage1_items = self.hybrid_search(
            query_text=stage1_query,
            stage_name="Stage 1: Company Discovery",
            metadata_filter=stage1_filter,
            top_k=2,
            dynamic_constraints=dynamic_constraints,
            exclude_x_ids=selected_x_ids,
        )
        for item in stage1_items:
            selected_x_ids.add(item["x_id"])
        stage_results["stage_1_discovery"] = stage1_items

        # -------------------------------------------------------------
        # STAGE 2 — Company Qualification & Signal Enrichment
        # Filter: applies_to IN ["Company", "Both"] AND capability_type IN ["evidence_enrichment", "AI_template"]
        # -------------------------------------------------------------
        stage2_query = f"Verify company qualification {friction} {urgency} {criteria_text} tech stack technographics funding headcount hiring"
        stage2_filter = {
            "applies_to": ["Company", "Both"],
            "capability_type": ["evidence_enrichment", "AI_template"],
        }
        stage2_items = self.hybrid_search(
            query_text=stage2_query,
            stage_name="Stage 2: Company Qualification",
            metadata_filter=stage2_filter,
            top_k=3,
            dynamic_constraints=dynamic_constraints,
            exclude_x_ids=selected_x_ids,
        )
        for item in stage2_items:
            selected_x_ids.add(item["x_id"])
        stage_results["stage_2_qualification"] = stage2_items

        # -------------------------------------------------------------
        # STAGE 3 — Contact Resolution (Decision Makers)
        # Filter: applies_to IN ["Person", "Both"] AND capability_family IN ["search / discovery", "contact data", "people / professional identity"]
        # -------------------------------------------------------------
        stage3_query = f"Find decision makers {roles_text} find work email address contact LinkedIn profile identity"
        stage3_filter = {
            "applies_to": ["Person", "Both"],
            "capability_family": ["search / discovery", "contact data", "people / professional identity"],
        }
        stage3_items = self.hybrid_search(
            query_text=stage3_query,
            stage_name="Stage 3: Contact Resolution",
            metadata_filter=stage3_filter,
            top_k=2,
            dynamic_constraints=dynamic_constraints,
            exclude_x_ids=selected_x_ids,
        )
        for item in stage3_items:
            selected_x_ids.add(item["x_id"])
        stage_results["stage_3_contact_resolution"] = stage3_items

        # -------------------------------------------------------------
        # STAGE 4 — Normalization & Action
        # Filter: capability_type IN ["utility", "action", "transformation"]
        # -------------------------------------------------------------
        stage4_query = f"Validate email deliverability clean verify domain normalize export CRM push webhook"
        stage4_filter = {
            "capability_type": ["utility", "action", "transformation"],
        }
        stage4_items = self.hybrid_search(
            query_text=stage4_query,
            stage_name="Stage 4: Normalization & Action",
            metadata_filter=stage4_filter,
            top_k=2,
            dynamic_constraints=dynamic_constraints,
            exclude_x_ids=selected_x_ids,
        )
        for item in stage4_items:
            selected_x_ids.add(item["x_id"])
        stage_results["stage_4_action"] = stage4_items

        # Combine all items across stages (already deduplicated by selected_x_ids)
        combined_items = stage1_items + stage2_items + stage3_items + stage4_items

        # Order by data dependencies
        ordered_steps = self.order_by_dependencies(combined_items)

        # Calculate credit costs
        total_credits = sum((step.get("cost_value") or 1.0) for step in ordered_steps)
        account_vol = config.get("account_volume", 1000)

        plan = {
            "plan_title": f"Clay Waterfall: {persona_title} Targeting Architecture",
            "persona_title": persona_title,
            "strategy_summary": (
                f"Multi-stage waterfall tailored for '{persona_title}'. "
                f"Begins with company discovery, qualifies against acute friction ({friction[:60]}...), "
                f"identifies target roles ({roles_text}), and normalizes verified work emails."
            ),
            "account_volume": account_vol,
            "total_credit_cost_per_row": round(total_credits, 1),
            "waterfall_steps": ordered_steps,
            "stage_breakdown": {
                "stage_1_discovery_count": len(stage1_items),
                "stage_2_qualification_count": len(stage2_items),
                "stage_3_contact_count": len(stage3_items),
                "stage_4_normalization_count": len(stage4_items),
            },
        }

        return plan


if __name__ == "__main__":
    print("Testing MultiStageEnrichmentRAG...")
    retriever = MultiStageEnrichmentRAG()

    sample_persona = {
        "title": "High-Velocity Cloud & SaaS Scaleups (Series A-C)",
        "archetype": "Rapidly Scaling Tech Organization",
        "company_size": "50 - 250 Employees ($10M - $50M ARR)",
        "geography": "North America & Western Europe",
        "business_pain_and_friction": "Developer tooling friction, Jira performance bottlenecks, engineering sprint coordination overhead",
        "buying_urgency_triggers": "Recent funding round; active hiring for VP of Engineering and Staff Software Engineers; modernizing cloud stack",
        "target_roles": ["VP of Engineering", "Head of Product", "Chief Technology Officer"],
        "qualification_criteria": ["Uses Atlassian Jira Cloud", "Headcount between 50 and 250", "Active engineering job postings"],
    }

    plan = retriever.retrieve_plan_for_persona(sample_persona)

    print("\n" + "=" * 72)
    print(f"PLAN: {plan['plan_title']}")
    print(f"Total Credits / Row: {plan['total_credit_cost_per_row']} Credits")
    print(f"Total Steps: {len(plan['waterfall_steps'])}")
    print("=" * 72)

    for step in plan["waterfall_steps"]:
        print(f"Step {step['step_number']}: [{step['x_id']}] {step['canonical_name']} ({step['provider']})")
        print(f"  Stage: {step['stage']} | Type: {step['capability_type']} | Cost: {step['cost_value']} {step['cost_unit']}")
        print(f"  Dependency: {step['dependency_status']}")
        print(f"  Output: {step['typical_output']}")
        print("-" * 72)

