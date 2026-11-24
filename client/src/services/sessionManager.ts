// Client Session & Memory-Only Key Manager
// Enforces Supabase anonymous authentication and keeps user Groq API keys strictly in-memory.

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SessionState, GroqModel } from '../types/workflow';

const getEnv = (key: string, fallback: string) => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (_) {}
  return fallback;
};

export const SUPABASE_URL =
  getEnv('VITE_SUPABASE_URL', 'https://yadpkqnidlsewxwmponv.supabase.co');
export const SUPABASE_ANON_KEY =
  getEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_2oZqmshxO9qRtX9XeNU8og_F1FYD_4F');

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const DECOMMISSIONED_MODELS = new Set([
  'mixtral-8x7b-32768',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'llama-3.1-70b-versatile',
]);

export type LlmProvider = 'groq' | 'openai' | 'openrouter' | 'anthropic';

export function detectProvider(key: string): LlmProvider {
  const clean = key.trim();
  if (clean.startsWith('gsk_')) return 'groq';
  if (clean.startsWith('sk-or-')) return 'openrouter';
  if (clean.startsWith('sk-ant-')) return 'anthropic';
  if (clean.startsWith('sk-proj-') || clean.startsWith('sk-')) return 'openai';
  return 'groq';
}

export interface ProviderDefinition {
  name: string;
  baseUrl: string;
  chatEndpoint: string;
  modelsEndpoint?: string;
  defaultModel: string;
  fallbackModels: string[];
  authHeader: (key: string) => Record<string, string>;
}

export const PROVIDER_CONFIGS: Record<LlmProvider, ProviderDefinition> = {
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    defaultModel: 'llama-3.1-8b-instant',
    fallbackModels: [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'llama-3.2-11b-vision-preview',
      'llama-3.2-3b-preview',
      'llama-3.2-1b-preview',
      'qwen-2.5-32b',
    ],
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    chatEndpoint: 'https://api.openai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    defaultModel: 'gpt-4o-mini',
    fallbackModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    defaultModel: 'openai/gpt-4o-mini',
    fallbackModels: [
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.1-8b-instruct:free',
      'meta-llama/llama-3.3-70b-instruct',
      'anthropic/claude-3-haiku',
    ],
    authHeader: (key) => ({
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://clayplanner.app',
      'X-Title': 'Clay Campaign Planner',
    }),
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    chatEndpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-20241022',
    fallbackModels: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
    authHeader: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
  },
};

export const UNIVERSAL_GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-3b-preview',
  'llama-3.2-1b-preview',
  'qwen-2.5-32b',
  'deepseek-r1-distill-llama-70b',
];

const DEFAULT_MODELS: GroqModel[] = [
  { id: 'llama-3.1-8b-instant', owned_by: 'Meta' },
  { id: 'llama-3.3-70b-versatile', owned_by: 'Meta' },
  { id: 'llama-3.2-11b-vision-preview', owned_by: 'Meta' },
  { id: 'llama-3.2-3b-preview', owned_by: 'Meta' },
  { id: 'llama-3.2-1b-preview', owned_by: 'Meta' },
];

const PREF_MODEL_KEY = 'clay_planner_selected_model_pref';

const getStoredModelPref = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(PREF_MODEL_KEY);
      // Automatically purge decommissioned models
      if (stored && DECOMMISSIONED_MODELS.has(stored)) {
        localStorage.removeItem(PREF_MODEL_KEY);
        return 'llama-3.1-8b-instant';
      }
      return stored || 'llama-3.1-8b-instant';
    }
  } catch (_) {}
  return 'llama-3.1-8b-instant';
};

class SessionManager {
  private state: SessionState = {
    userId: null,
    isAnonymous: true,
    groqKeyInMemory: null, // Strictly in-memory for active session!
    isGroqConnected: false,
    selectedModel: getStoredModelPref() || 'llama-3.1-8b-instant',
    availableModels: DEFAULT_MODELS,
    isTestingKey: false,
    connectionError: null,
  };

  private listeners: Array<(state: SessionState) => void> = [];

  constructor() {
    this.initAuth();
  }

  private async initAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.state.userId = session.user.id;
        this.state.isAnonymous = session.user.is_anonymous ?? true;
        this.notify();
      } else {
        // Sign in anonymously for session tracking & RLS run ownership
        const { data: authData, error } = await supabase.auth.signInAnonymously();
        if (!error && authData?.user) {
          this.state.userId = authData.user.id;
          this.state.isAnonymous = true;
          this.notify();
        }
      }
    } catch (e) {
      console.warn('Anonymous auth init error:', e);
    }
  }

  public getState(): SessionState {
    return { ...this.state };
  }

  public getProvider(): LlmProvider {
    return this.state.llmProvider || (this.state.groqKeyInMemory ? detectProvider(this.state.groqKeyInMemory) : 'groq');
  }

  public getGroqKey(): string | null {
    return this.state.groqKeyInMemory;
  }

  public setGroqKey(key: string | null) {
    this.state.groqKeyInMemory = key;
    this.state.isGroqConnected = !!key;
    if (key) {
      this.state.llmProvider = detectProvider(key);
    }
    this.notify();
  }

  public getSelectedModel(): string {
    return this.state.selectedModel;
  }

  public async getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  public subscribe(listener: (state: SessionState) => void) {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const nextState = { ...this.state };
    this.listeners.forEach((l) => l(nextState));
  }

  // Set Model Preference
  public setSelectedModel(modelId: string) {
    this.state.selectedModel = modelId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREF_MODEL_KEY, modelId);
      }
    } catch (_) {}
    this.notify();
  }

  // Disconnect Action: Purges in-memory key immediately
  public disconnectGroq() {
    this.state.groqKeyInMemory = null;
    this.state.isGroqConnected = false;
    this.state.connectionError = null;
    this.state.availableModels = DEFAULT_MODELS;
    this.notify();
  }

  // Validate Key through Backend and Retrieve Available Models
  public async connectAndValidateKey(apiKey: string): Promise<{ success: boolean; error?: string; provider?: string }> {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      return { success: false, error: 'Please enter a valid API key.' };
    }

    const provider = detectProvider(cleanKey);
    const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.groq;

    this.state.llmProvider = provider;
    this.state.isTestingKey = true;
    this.state.connectionError = null;
    this.notify();

    try {
      let models: GroqModel[] = [];

      // If provider has a models endpoint (Groq, OpenAI, OpenRouter), test & discover active models
      if (config.modelsEndpoint) {
        const directRes = await fetch(config.modelsEndpoint, {
          headers: config.authHeader(cleanKey),
        });

        if (!directRes.ok) {
          if (directRes.status === 401) {
            throw new Error(`Invalid ${config.name} API key. Please check your credentials in the ${config.name} console.`);
          }
          if (directRes.status === 429) {
            throw new Error(`${config.name} rate limit reached. Please wait a moment.`);
          }
          throw new Error(`${config.name} connection error (${directRes.status})`);
        }

        const directData = await directRes.json();
        const rawModels: any[] = directData.data || [];
        const availableModelIds = new Set(
          rawModels
            .filter((m: any) => !DECOMMISSIONED_MODELS.has(m.id) && m.active !== false)
            .map((m: any) => m.id)
        );

        models = rawModels
          .filter((m: any) =>
            !DECOMMISSIONED_MODELS.has(m.id) &&
            !['whisper', 'guard', 'safeguard', 'audio', 'clip', 'embedding', 'tts'].some((p) => m.id.toLowerCase().includes(p))
          )
          .map((m: any) => ({ id: m.id, created: m.created, owned_by: m.owned_by }));

        // Pick the best universal model that this key ACTUALLY HAS ACCESS TO
        const bestModel =
          config.fallbackModels.find((id) => availableModelIds.has(id)) ||
          models[0]?.id ||
          config.defaultModel;

        this.state.selectedModel = bestModel;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PREF_MODEL_KEY, bestModel);
          }
        } catch (_) {}
      } else {
        // Anthropic or endpoints without public listing: default to verified model
        this.state.selectedModel = config.defaultModel;
        models = config.fallbackModels.map((id) => ({ id, owned_by: config.name }));
      }

      // Successfully validated!
      this.state.groqKeyInMemory = cleanKey;
      this.state.isGroqConnected = true;
      this.state.availableModels = models.length > 0 ? models : config.fallbackModels.map((id) => ({ id, owned_by: config.name }));
      this.state.isTestingKey = false;
      this.state.connectionError = null;

      this.notify();
      return { success: true, provider: config.name };
    } catch (err: any) {
      this.state.isTestingKey = false;
      this.state.isGroqConnected = false;
      this.state.connectionError = err.message || `Failed to connect to ${config.name}.`;
      this.notify();
      return { success: false, error: this.state.connectionError || 'Connection failed' };
    }
  }
}

export const sessionManager = new SessionManager();
