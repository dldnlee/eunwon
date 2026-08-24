import OpenAI from 'openai';

// Upstage's API is OpenAI Chat Completions-compatible — per their own quickstart
// (console.upstage.ai/docs/getting-started) they use the `openai` package directly
// with a custom baseURL, rather than a provider-abstraction SDK.
//
// The client is built lazily (not at module load) because scripts/sync-programs.ts
// loads .env.local at runtime via dotenv — ES module imports hoist above that call,
// so a top-level `new OpenAI(...)` here would read UPSTAGE_API_KEY before it's set.
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.UPSTAGE_API_KEY!,
      baseURL: 'https://api.upstage.ai/v1',
    });
  }
  return client;
}

export const UPSTAGE_MODEL = 'solar-pro4';

/** One-shot chat completion — returns the message text. */
export async function generateText(params: {
  prompt: string;
  maxTokens?: number;
  onUsage?: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
}): Promise<string> {
  const completion = await getClient().chat.completions.create({
    model: UPSTAGE_MODEL,
    messages: [{ role: 'user', content: params.prompt }],
    max_tokens: params.maxTokens,
  });

  if (completion.usage) {
    params.onUsage?.({
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
    });
  }

  return completion.choices[0]?.message?.content ?? '';
}

/** Strip ```json fences models sometimes add despite "JSON only" instructions, then parse. */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(cleaned) as T;
}
