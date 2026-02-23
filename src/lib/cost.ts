import type { GeminiModelId } from './gemini'

/** 各模型每百萬 token 價格（USD）：input / output */
export const MODEL_PRICE_PER_MILLION: Record<
  GeminiModelId,
  { input: number; output: number }
> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.0-flash': { input: 0.2, output: 0.8 },
  'gemini-1.5-flash': { input: 0.15, output: 0.6 },
  'gemini-1.5-pro': { input: 1.25, output: 5 }
}

/** 系統提示約略 token 數（與 prompt 內容有關） */
const SYSTEM_PROMPT_TOKENS = 380

/** 越／中文字約 1 字 ≈ 1.2–1.5 token，此處用 1.4 估算 */
const CHARS_TO_TOKEN_RATIO = 1.4

export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length * CHARS_TO_TOKEN_RATIO) + SYSTEM_PROMPT_TOKENS
}

export function estimateOutputTokens(text: string): number {
  return Math.ceil(text.length * CHARS_TO_TOKEN_RATIO)
}

export function estimateCost(
  modelId: GeminiModelId,
  inputText: string,
  outputText: string
): { inputTokens: number; outputTokens: number; usd: number; twd: number } {
  const inputTokens = estimateInputTokens(inputText)
  const outputTokens = estimateOutputTokens(outputText)
  const price = MODEL_PRICE_PER_MILLION[modelId]
  const usd =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  const twd = usd * 32 // 約略匯率
  return { inputTokens, outputTokens, usd, twd }
}
