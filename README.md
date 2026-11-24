# Clay Campaign Planner & RAG Enrichment Architecture 🚀

An evidence-based outbound Go-To-Market (GTM) strategy architect and multi-stage RAG system for Clay waterfall enrichment planning. Built by **[Akash Kedia](https://www.linkedin.com/in/akash-kedia)**.

The system guides users through analyzing target companies, synthesizing strategic campaigns, generating and approving target Company Personas, and orchestrating a multi-stage RAG retrieval pipeline across a canonical catalogue of **1,224 atomic actions and enrichments** to generate dependency-ordered Clay waterfalls and accurate credit cost estimates.

---

## 🏛️ Architecture & Component Breakdown

```
Clay-enrichment-planner-RAG-System/
├── client/                               # React + Vite + TypeScript Web Application
│   ├── public/
│   │   └── data/
│   │       └── catalogue.json            # 1,224-row indexed RAG catalogue dataset
│   ├── src/
│   │   ├── components/
│   │   │   ├── LeftPane/                 # Input Flow (Website -> Campaign -> Persona -> Waterfall)
│   │   │   │   ├── Step1UrlInput.tsx     # 1. Company URL input & real-time research
│   │   │   │   ├── Step2CampaignSelection.tsx # 2. Campaign approval gate
│   │   │   │   ├── Step3QuestionSelection.tsx # 3. Target Company Persona approval gate
│   │   │   │   ├── Step4FollowUp.tsx     # 4. Clarification & parameters
│   │   │   │   └── Step5EnrichmentPlan.tsx# 5. Dependency-ordered Waterfall plan & costs
│   │   │   ├── RightPane/                # Live System State & Checkpoints
│   │   │   │   ├── StageTracker.tsx      # Multi-call LLM & RAG timeline
│   │   │   │   ├── CompanyInfoCard.tsx   # Company ICP, value prop & signals
│   │   │   │   ├── CampaignOverviewCard.tsx # Proposed vs selected campaign
│   │   │   │   ├── DecisionQuestionCard.tsx # Proposed company personas
│   │   │   │   └── CatalogAndCostCard.tsx   # Total credit cost / row & account volume
│   │   │   └── Header.tsx                # Clay branding, dark mode, profile link
│   │   ├── services/
│   │   │   ├── workflowEngine.ts         # Central state machine orchestrator
│   │   │   ├── catalogueService.ts       # Candidate retrieval & cost calculation
│   │   │   ├── groq.ts                   # Groq Llama 3.3 orchestration
│   │   │   └── supabase.ts               # Supabase client integration
│   │   └── verify_persona_rag_pipeline.ts# Automated pipeline test runner
│   ├── vercel.json                       # Subdirectory Vercel deployment configuration
│   └── package.json
├── data/
│   ├── clay_catalog_source.xlsx          # Source canonical catalogue (1,224 rows, cols A:Y)
│   ├── catalogue_rag.db                  # SQLite vector & metadata store (1,244 chunks)
│   └── catalogue_rag_indexed.json        # Pre-computed dense embeddings & structured chunks
├── supabase/                             # Database Migrations & Edge Functions
│   ├── migrations/                       # PostgreSQL pgvector schemas & RPC functions
│   └── functions/                        # Edge orchestration functions
├── ingest_catalogue.py                   # Atomic row chunking & 384-dim embedding generator
├── enrichment_rag.py                     # 4-Stage Sequential Hybrid RAG Retriever
├── test_rag.py                           # 10/10 RAG verification test suite
├── vercel.json                           # Root Vercel deployment configuration
├── package.json                          # Root monorepo scripts & postinstall hook
└── README.md
```

---

## ⚡ The 4-Stage Sequential Hybrid RAG Retrieval Engine

Given an approved **Company Persona**, the RAG system executes **4 sequential hybrid search queries** combining exact metadata pre-filters, 384-dimensional dense semantic vectors (`BAAI/bge-small-en-v1.5`), and lexical token scoring:

1. **Stage 1 — Company Discovery (List Building)**
   - **Filter:** `applies_to IN ["Company", "Both"] AND capability_type == "search"`
   - **Goal:** Identify target company domains and accounts (lookalikes, directory searches, industry scrapers).
2. **Stage 2 — Company Qualification & Signal Enrichment**
   - **Filter:** `applies_to IN ["Company", "Both"] AND capability_type IN ["evidence_enrichment", "AI_template"]`
   - **Goal:** Verify ICP fit via technographics, funding, headcount growth, and job postings.
3. **Stage 3 — Contact Resolution (Decision Makers)**
   - **Filter:** `applies_to IN ["Person", "Both"] AND capability_family IN ["search / discovery", "contact data", "people / professional identity"]`
   - **Goal:** Identify decision-maker personas (e.g., VPs, Directors) and validate work emails and LinkedIn profiles.
4. **Stage 4 — Normalization & Action**
   - **Filter:** `capability_type IN ["utility", "action", "transformation"]`
   - **Goal:** Execute email deliverability verification, company name normalization, and CRM push actions.

### Topological Dependency Ordering
The engine inspects each action's `Input_Requirements` and `Typical_Output` to dynamically organize the retrieved steps into a valid executable waterfall sequence (Discovery Tier 1 → Domain Firmographics Tier 2 → ICP Signals Tier 3 → Contact Resolution Tier 4 → Identity/Email Tier 5 → Validation/Action Tier 6).

---

## 🚀 One-Click Vercel Deployment

This repository is ready for immediate deployment on **Vercel**:

### Method 1: Deploy Directly from GitHub (Recommended)
1. In your [Vercel Dashboard](https://vercel.com/dashboard), click **"Add New Project"** and select **`Clay-enrichment-planner-RAG-System`**.
2. **Framework Preset:** Select **Vite** (or leave on auto-detect).
3. **Root Directory:** You can leave it as `./` (the root `vercel.json` and `package.json` handle building `client` automatically) or set it to `client`.
4. Click **Deploy**.

### Environment Variables (Optional for custom live Groq / Supabase keys):
- `VITE_SUPABASE_URL`: Your Supabase Project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Publishable Key.
- `VITE_GROQ_API_KEY`: Your Groq API Key (can also be entered dynamically directly inside the application UI).

---

## 💻 Local Development

### 1. Run the Frontend Web Application
```bash
cd client
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Run the RAG Test Suite (Python)
```bash
python3 -m pip install numpy fastembed openpyxl
python3 test_rag.py
```

### 3. Re-ingest or Re-index the Catalogue
```bash
python3 ingest_catalogue.py
```

### 4. Run the Client Pipeline Verification Script
```bash
cd client
npx tsx src/verify_persona_rag_pipeline.ts
```

---

## 👤 Author
**Akash Kedia**  
LinkedIn: [linkedin.com/in/akash-kedia](https://www.linkedin.com/in/akash-kedia)
