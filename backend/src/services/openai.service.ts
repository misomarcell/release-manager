import { config } from '../config.js';
import { asRecord, asString } from '../utils/coerce.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function isOpenAiAvailable(): boolean {
  return !!config.openai.apiKey;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string | null> {
  const { model = 'gpt-4o-mini', temperature = 0.8, maxTokens = 1024 } = options;

  console.log(`[OpenAI] chatCompletion — model=${model}, messages=${messages.length}`);

  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[OpenAI] chatCompletion failed — status=${res.status} ${res.statusText}`, body);
      return null;
    }

    const data = asRecord(await res.json());
    const choices = Array.isArray(data['choices']) ? data['choices'] : [];
    if (choices.length === 0) {
      console.error('[OpenAI] chatCompletion — empty choices in response');
      return null;
    }

    const content = asString(asRecord(asRecord(choices[0])['message'])['content']) || null;
    console.log(`[OpenAI] chatCompletion — received ${content?.length ?? 0} chars`);
    return content;
  } catch (err) {
    console.error('[OpenAI] chatCompletion — request threw:', err);
    return null;
  }
}
