// Supabase Edge Function: groq-service
// Request-scoped Groq execution engine.
// Raw keys are used ONLY for the active HTTP request and are NEVER logged, persisted, or returned.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-groq-api-key, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Extract user-supplied Groq key strictly from request header or body
    const headerKey = req.headers.get("x-groq-api-key");
    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    }
    const userApiKey = headerKey || body.apiKey;

    if (!userApiKey || typeof userApiKey !== "string" || !userApiKey.trim()) {
      return new Response(
        JSON.stringify({
          error: "Connect your Groq key to continue.",
          code: "CREDENTIALS_MISSING",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanKey = userApiKey.trim();

    // 2. Action: LIST_MODELS or Validate Key
    const action = body.action || (req.method === "GET" ? "LIST_MODELS" : "COMPLETION");

    if (action === "LIST_MODELS") {
      const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });

      if (!modelsRes.ok) {
        if (modelsRes.status === 401) {
          return new Response(
            JSON.stringify({ error: "Invalid Groq API key.", code: "INVALID_CREDENTIALS" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (modelsRes.status === 429) {
          return new Response(
            JSON.stringify({ error: "Groq rate limit exceeded. Please try again shortly.", code: "RATE_LIMITED" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await modelsRes.text();
        return new Response(
          JSON.stringify({ error: `Groq error (${modelsRes.status}): ${errText}`, code: "GROQ_ERROR" }),
          { status: modelsRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const modelsData = await modelsRes.json();
      const decommissioned = new Set(["mixtral-8x7b-32768", "llama3-70b-8192", "llama3-8b-8192", "llama-3.1-70b-versatile"]);
      const allowedPrefixes = ["llama-3", "qwen", "deepseek", "gemma"];
      const filtered = (modelsData.data || [])
        .filter((m: any) => allowedPrefixes.some((p) => m.id.toLowerCase().includes(p)) && !decommissioned.has(m.id))
        .map((m: any) => ({
          id: m.id,
          created: m.created,
          owned_by: m.owned_by,
        }))
        .sort((a: any, b: any) => (a.id.includes("llama-3.3-70b") ? -1 : 1));

      return new Response(
        JSON.stringify({
          success: true,
          models: filtered.length > 0 ? filtered : modelsData.data,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Action: COMPLETION (Structured JSON Task)
    const { task, model = "llama-3.3-70b-versatile", context = {} } = body;

    let systemPrompt = "";
    let userPrompt = "";

    if (task === "RESEARCH_COMPANY" || task === "ANALYZE_COMPANY_ONLY") {
      systemPrompt = `You are a Principal B2B Market Researcher and Company Intelligence Analyst.
Analyze the target company website and domain.
1. Identify company name, domain, industry, comprehensive summary of products/services, value proposition, ICP summary, detected tech stack, and primary buyer personas.
Output MUST strictly follow this JSON schema:
{
  "company": {
    "name": "string",
    "domain": "string",
    "industry": "string",
    "summary": "string",
    "icpSummary": "string",
    "valueProposition": "string",
    "techStack": ["string"],
    "targetBuyerPersonas": ["string"],
    "sourceLinks": [
      { "title": "string", "url": "string", "badge": "string" }
    ]
  }
}`;
      userPrompt = `Target company URL: ${context.companyUrl}. Research and extract company intelligence and ICP.`;
    } else if (task === "PROPOSE_CAMPAIGNS") {
      systemPrompt = `You are an expert Outbound Go-To-Market Strategist and Campaign Architect.
Formulate exactly 3 concrete, distinct outbound acquisition campaign suggestions designed specifically for this company.

CRITICAL INSTRUCTIONS:
- Ground every campaign in what this company ACTUALLY sells and who their real buyers are.
- Do NOT use arbitrary, random, or generic GTM filler templates (do NOT say "Companies using AWS" or "50+ employees" unless directly relevant to this company's product).
- The 3 campaigns must represent 3 distinct strategic angles:
  1. Pain Point & Incumbent Displacement
  2. Trigger Event & Scaling Momentum
  3. High-Fit Vertical / Sweet-Spot Niche
Output MUST strictly follow this JSON schema:
{
  "campaigns": [
    {
      "code": "camp_1",
      "title": "string",
      "objective": "string",
      "targetAudience": "string",
      "targetCompanyProfile": "string",
      "estimatedTam": "string",
      "difficulty": "Low" | "Medium" | "High",
      "strategicAngle": "string",
      "rationale": "string",
      "gtmAssumptions": ["string"],
      "supportingCompanySources": [
        { "url": "string", "fact": "string", "excerpt": "string" }
      ]
    }
  ]
}`;
      userPrompt = `Company: ${context.company?.name || context.companyName}
Domain: ${context.company?.domain || context.companyUrl}
Summary: ${context.company?.summary || context.summary}
Value Proposition: ${context.company?.valueProposition || context.valueProposition}
ICP: ${context.company?.icpSummary || context.icpSummary}
Formulate exactly 3 grounded, company-tailored outbound campaigns.`;
    } else if (task === "ANALYZE_COMPANY") {
      systemPrompt = `You are a B2B Go-To-Market and Clay Enrichment Architect.
Analyze the target company domain. Extract the ICP profile, detected tech stack, value proposition, and generate 3 distinct outbound campaign strategies.
Output MUST strictly follow this JSON schema:
{
  "company": {
    "name": "string",
    "domain": "string",
    "industry": "string",
    "summary": "string",
    "icpSummary": "string",
    "valueProposition": "string",
    "techStack": ["string"],
    "sourceLinks": [
      { "title": "string", "url": "string", "badge": "string" }
    ]
  },
  "campaigns": [
    {
      "code": "camp_1",
      "title": "string",
      "objective": "string",
      "targetAudience": "string",
      "estimatedTam": "string",
      "difficulty": "Low" | "Medium" | "High",
      "strategicAngle": "string",
      "rationale": "string"
    }
  ]
}`;
      userPrompt = `Target company URL: ${context.companyUrl}. Formulate company profile and 3 tailored outbound campaigns.`;
    } else if (task === "GENERATE_QUESTIONS") {
      systemPrompt = `You are a strategic Go-To-Market Architect.
For the chosen outbound campaign, generate 3 rigorous gating decision questions that determine whether a prospective account qualifies for outreach.
Output MUST strictly follow this JSON schema:
{
  "questions": [
    {
      "code": "q_1",
      "question": "string",
      "rationale": "string",
      "strategicImpact": "string",
      "gatingCriteria": "string",
      "recommendedConfidence": "High" | "Medium"
    }
  ]
}`;
      userPrompt = `Company: ${context.companyName}
Selected Campaign: ${context.campaignTitle}
Objective: ${context.campaignObjective}
Audience: ${context.campaignAudience}
Formulate 3 gating decision questions.`;
    } else if (task === "SYNTHESIZE_PLAN") {
      systemPrompt = `You are a Master Clay Enrichment Architect.
Synthesize the hypothesis matrix (Positive, Negative, Inconclusive pathways with required evidence) and build a production-grade Clay Waterfall Blueprint.
Output MUST strictly follow this JSON schema:
{
  "hypothesisMatrix": {
    "coreHypothesis": "string",
    "possibleAnswers": [
      {
        "answerLabel": "string",
        "indicatorStatus": "Positive" | "Negative" | "Inconclusive",
        "actionPathway": "string",
        "evidenceNeeded": ["string"]
      }
    ]
  },
  "enrichmentPlan": {
    "title": "string",
    "strategySummary": "string",
    "totalCreditsPerRow": 6,
    "estimatedCostPerThousand": "$60.00 USD (6,000 Clay Credits)",
    "waterfallSteps": [
      {
        "stepNumber": 1,
        "columnName": "string",
        "provider": "string",
        "costCredits": 1,
        "purpose": "string",
        "failoverStrategy": "string"
      }
    ]
  },
  "catalogSelections": [
    {
      "provider": "string",
      "category": "string",
      "costCredits": 1,
      "dataSupplied": "string"
    }
  ],
  "unresolvedGaps": [
    {
      "gapName": "string",
      "impact": "string",
      "mitigationAdvice": "string"
    }
  ]
}`;
      userPrompt = `Company: ${context.companyName}
Campaign: ${context.campaignTitle}
Gating Question: ${context.questionText}
Follow-up Directives: ${context.followUpNotes || "None"}
Synthesize the complete Clay enrichment plan and hypothesis matrix.`;
    } else {
      return new Response(JSON.stringify({ error: `Unknown task: ${task}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Groq API with structured JSON response format
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!groqRes.ok) {
      if (groqRes.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid Groq API key credentials.", code: "INVALID_CREDENTIALS" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (groqRes.status === 404 || groqRes.status === 400) {
        return new Response(
          JSON.stringify({
            error: `Model "${model}" unavailable or invalid for your Groq tier.`,
            code: "MODEL_UNAVAILABLE",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (groqRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Groq account quota exceeded. Check your Groq balance.", code: "QUOTA_EXCEEDED" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (groqRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Groq rate limit reached. Please wait a moment.", code: "RATE_LIMITED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq call failed (${groqRes.status}): ${errText}`, code: "GROQ_ERROR" }),
        { status: groqRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const completion = await groqRes.json();
    const rawContent = completion.choices?.[0]?.message?.content;
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ error: "Failed to parse structured JSON from Groq response", code: "SCHEMA_VALIDATION_FAILED" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        modelUsed: model,
        data: parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal Groq service error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

