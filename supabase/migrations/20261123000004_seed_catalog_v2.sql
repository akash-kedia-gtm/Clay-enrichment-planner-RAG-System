-- Migration: 20261123000004_seed_catalog_v2.sql
-- Seeds default built-in Clay Enrichment Catalogue records with 384-dimensional vector embeddings

-- 1. Insert built-in default catalogue
INSERT INTO catalogues (id, user_id, name, version, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'Standard Clay Enrichment Catalogue', 1, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert built-in catalogue records with normalized embeddings placeholder for gte-small
INSERT INTO catalogue_records (catalogue_id, user_id, provider_name, provider_category, data_points, cost_credits, description, reliability_score, sample_output)
VALUES
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'BuiltWith Tech Stack API',
    'Tech Stack & Infrastructure',
    ARRAY['technologies_detected', 'frameworks', 'hosting_provider', 'spend_tier', 'first_detected_date'],
    1,
    'Analyzes website HTTP headers, DNS, scripts, and trackers to detect over 80,000 enterprise and SaaS technologies.',
    0.96,
    '{"technologies": ["Segment", "HubSpot", "AWS", "Cloudflare", "React"], "analytics_spend": "$2,500/mo"}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'PredictLeads Hiring & Job Signals',
    'Hiring & Job Intent',
    ARRAY['open_roles', 'department_growth', 'role_titles', 'job_descriptions', 'tech_requirements_in_jobs'],
    2,
    'Tracks daily job board listings from 250,000+ companies. Detects exact technologies required in job listings and team expansion.',
    0.94,
    '{"active_devops_jobs": 4, "mention_kubernetes": true, "latest_posting": "Senior Platform Engineer"}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Crustdata Firmographics & Velocity',
    'Firmographics & Headcount Growth',
    ARRAY['headcount_growth_6m', 'engineering_headcount', 'sales_headcount', 'founder_background', 'investor_names'],
    2,
    'Real-time employee headcount shifts, department percentage changes, and investor tracking pulled from professional networks.',
    0.92,
    '{"headcount_6m_growth": "+34%", "eng_headcount": 48, "total_employees": 160}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Apollo B2B Contact Enrichment',
    'Contact Data & People',
    ARRAY['work_email', 'email_status', 'linkedin_url', 'direct_dial', 'seniority_level', 'job_title'],
    1,
    'Access 275M+ verified B2B contacts. Enriches job title, corporate email, phone, and department with waterfall verification.',
    0.91,
    '{"email": "jane.doe@target.com", "status": "verified", "title": "VP of Infrastructure", "seniority": "Executive"}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Claygent Web Scraper AI',
    'AI Web Scraping & Custom Signals',
    ARRAY['custom_question_answer', 'pricing_model_extracted', 'case_study_customers', 'security_compliance_badges', 'raw_webpage_summary'],
    2,
    'Clay proprietary autonomous web agent. Visits any URL, clicks links, and uses an LLM to answer complex bespoke questions.',
    0.95,
    '{"answers": {"has_soc2": true, "uses_enterprise_sso": true, "case_study_notable_customer": "Figma"}}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Harmonic Founder & Startup Signals',
    'Company Stage & Funding',
    ARRAY['last_funding_round', 'funding_date', 'total_raised_usd', 'lead_investors', 'stealth_status'],
    2,
    'Deep intelligence on high-growth technology startups, venture capital backing, and key growth benchmarks.',
    0.97,
    '{"series": "Series B", "amount": "$28,000,000", "lead": "Bessemer Venture Partners"}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Findymail Waterfall Email Verification',
    'Email Deliverability & Verification',
    ARRAY['deliverability_score', 'mx_records', 'catch_all_check', 'cleaned_email'],
    1,
    'Proprietary multi-hop email bounce prevention algorithm with zero false-positives guarantee.',
    0.99,
    '{"valid": true, "catch_all": false, "risk_score": 0.01}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'GitHub Organization Activity',
    'Developer & Open Source Signals',
    ARRAY['repo_count', 'public_contributors', 'top_languages', 'stars_count', 'recent_commit_velocity'],
    1,
    'Surfaces public developer activity, engineering languages, open source frameworks used, and SDK integrations.',
    0.98,
    '{"languages": ["TypeScript", "Go", "Python"], "recent_commits_30d": 182}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'UserGems Past Champion Tracking',
    'Champion & Alumni Tracking',
    ARRAY['past_company', 'previous_software_used', 'start_date_in_new_role', 'is_alumni_customer'],
    3,
    'Identifies when past buyers or product advocates change companies and join target accounts as decision makers.',
    0.93,
    '{"past_user_of_our_product": true, "previous_company": "Datadog", "days_in_current_role": 42}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Wappalyzer Instant Stack Identifier',
    'Tech Stack & Infrastructure',
    ARRAY['cms', 'crm_name', 'marketing_automation', 'chat_widget'],
    1,
    'Fast lookup of front-facing web technologies, CRM tags, chat widgets (Intercom, Drift), and cookie consent tools.',
    0.95,
    '{"crm": "Salesforce", "chat": "Intercom", "analytics": "Google Analytics 4"}'::jsonb
);

