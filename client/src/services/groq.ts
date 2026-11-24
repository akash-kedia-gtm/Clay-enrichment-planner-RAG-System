import { sessionManager } from './sessionManager';
import { callGroqWithUniversalFallback } from './groqClient';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callGroqDirect(messages: GroqMessage[]): Promise<any> {
  const apiKey = sessionManager.getGroqKey();
  if (!apiKey) {
    throw new Error('Please connect your LLM API key to run real-time AI generation.');
  }

  const json = await callGroqWithUniversalFallback(apiKey, messages, {
    responseFormatJson: true,
    temperature: 0.2,
  });

  const text = json.choices[0]?.message?.content;
  return JSON.parse(text);
}
