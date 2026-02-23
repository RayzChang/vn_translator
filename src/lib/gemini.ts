import { GoogleGenerativeAI } from '@google/generative-ai'

const STORAGE_KEY = 'tw-vn-translator-api-key'
const MODEL_STORAGE_KEY = 'tw-vn-translator-model'

/** 專案內可選的 Gemini 模型列表（API 名稱與顯示名稱） */
export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash（推薦，速度與品質平衡）' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite（最快、較省）' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro（品質最佳）' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash（舊版）' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro（舊版）' }
] as const

export type GeminiModelId = (typeof GEMINI_MODELS)[number]['id']

const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash'

export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function setStoredApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function getStoredModel(): GeminiModelId {
  const saved = localStorage.getItem(MODEL_STORAGE_KEY)
  const found = GEMINI_MODELS.some((m) => m.id === saved)
  return found ? (saved as GeminiModelId) : DEFAULT_MODEL
}

export function setStoredModel(modelId: GeminiModelId): void {
  localStorage.setItem(MODEL_STORAGE_KEY, modelId)
}

export type Region = 'south' | 'north'
export type Gender = 'female' | 'male' | 'neutral'
export type Direction = 'vn2zh' | 'zh2vn'

/** 說話對象（關係／輩分） */
export type Audience =
  | 'none'
  | 'elder'      // 長輩
  | 'peer'       // 平輩
  | 'younger'    // 晚輩或小孩
  | 'lover'      // 情人或配偶
  | 'boss'       // 上司或長官
  | 'colleague'  // 同事
  | 'friend'     // 朋友
  | 'stranger'   // 陌生人／一般

/** 語氣／正式度 */
export type Tone = 'auto' | 'formal' | 'casual' | 'intimate' | 'polite'

const AUDIENCE_LABELS: Record<Audience, string> = {
  none: '不指定',
  elder: '長輩（父母、長輩親戚等）',
  peer: '平輩（同齡、同事、一般）',
  younger: '晚輩或小孩',
  lover: '情人或配偶',
  boss: '上司或長官',
  colleague: '同事',
  friend: '朋友',
  stranger: '陌生人／一般'
}

const TONE_LABELS: Record<Tone, string> = {
  auto: '依內容自動',
  formal: '正式',
  casual: '日常口語',
  intimate: '親密隨意',
  polite: '敬語'
}

export { AUDIENCE_LABELS, TONE_LABELS }

function audiencePrompt(audience: Audience): string {
  if (audience === 'none') return '不特別指定對象，依上下文自然呈現。'
  const map: Record<Audience, string> = {
    none: '',
    elder: '對象為長輩（父母、長輩親戚等），越南語需使用對長輩的稱謂與用語（如 con、cháu 等自稱，敬語）。',
    peer: '對象為平輩（同事、朋友、同齡），使用平輩間的稱呼與口吻。',
    younger: '對象為晚輩或小孩，可使用較親近或上對下的稱謂與語氣。',
    lover: '對象為情人或配偶，使用親密關係的稱呼與用語（如 em/anh 等，依說話者性別）。',
    boss: '對象為上司或長官，使用敬語與適當的職場稱謂。',
    colleague: '對象為同事，語氣介於正式與口語之間，視情境。',
    friend: '對象為朋友，使用輕鬆、口語的稱呼。',
    stranger: '對象為陌生人或一般場合，使用禮貌、中性的稱謂。'
  }
  return map[audience]
}

function tonePrompt(tone: Tone): string {
  if (tone === 'auto') return '依原文的正式／口語程度自然呈現。'
  const map: Record<Tone, string> = {
    auto: '',
    formal: '語氣正式，用於文件、公務或正式場合。',
    casual: '日常口語，像簡訊、日常對話。',
    intimate: '親密、隨意，如對伴侶或親近的人。',
    polite: '敬語、禮貌用語，對長輩或需表示尊重時。'
  }
  return map[tone]
}

function buildSystemPrompt(
  region: Region,
  gender: Gender,
  direction: Direction,
  audience: Audience,
  tone: Tone
): string {
  const regionText = region === 'south' ? '南越（西貢／胡志明市）' : '北越（河內）'
  const genderText =
    gender === 'female' ? '女性' : gender === 'male' ? '男性' : '不特別區分性別'
  const dirText =
    direction === 'vn2zh'
      ? '將越南文翻譯成繁體中文'
      : '將繁體中文翻譯成越南文'
  const audienceText = audiencePrompt(audience)
  const toneText = tonePrompt(tone)

  return `你是母語級的越南語與繁體中文譯者，並能協助學習越南語。請嚴格遵守以下規則：

【翻譯規則】
1. **地區**：使用${regionText}的用語、用詞與腔調。
2. **說話者**：譯文中的第一人稱與用語需符合${genderText}的習慣（越南語有男女用語差異時務必遵守）。
3. **說話對象**：${audienceText}
4. **語氣**：${toneText}
5. **任務**：${dirText}。

【輸出格式】依序輸出以下區塊，用標記分隔：

【翻譯】
（只放翻譯結果，不要前綴或空行後加其他內容）

【解釋】
（精簡、挑重點就好，每項一兩句即可，不要長篇）
- 單字／詞意思
- 文法重點（若有）
- 縮寫／網路用語（若有）

${direction === 'zh2vn' ? `【回譯】
（把上面越南文「翻回」中文的約略意思，一句話，讓使用者確認沒傳達錯。）` : ''}

【詞彙】
（從本句提取可存入詞庫的詞條，每行一筆，格式：原文 | 譯文。規則：① 提取有意義的單字、詞組、短語；② 若詞組可拆出常用單字，兩筆都要存，例如「ăn KFC」要存「ăn KFC | 吃KFC」同時也存「ăn | 吃」；③ 每筆長度適中，單字或 2～5 詞的短語為主；④ 不要存整句。若無合適詞彙可留空。）

請勿在以上標記之外多加其他內容。`
}

/** 翻譯結果：翻譯 + 解釋 + 回譯（中→越時才有） */
export interface TranslateResult {
  translation: string
  explanation: string
  backTranslation?: string
}

const TRANSLATION_MARKER = '【翻譯】'
const EXPLANATION_MARKER = '【解釋】'
const BACK_MARKER = '【回譯】'
const VOCAB_MARKER = '【詞彙】'

function parseTranslationAndExplanation(raw: string): TranslateResult {
  const t = raw.trim()
  const transIdx = t.indexOf(TRANSLATION_MARKER)
  const explIdx = t.indexOf(EXPLANATION_MARKER)
  const backIdx = t.indexOf(BACK_MARKER)
  const vocabIdx = t.indexOf(VOCAB_MARKER)
  if (transIdx === -1 && explIdx === -1) {
    return { translation: t, explanation: '' }
  }
  let translation = ''
  let explanation = ''
  let backTranslation = ''
  const afterTrans = transIdx >= 0 ? transIdx + TRANSLATION_MARKER.length : 0
  const afterExpl = explIdx >= 0 ? explIdx + EXPLANATION_MARKER.length : 0
  const endExpl = backIdx >= 0 ? backIdx : (vocabIdx >= 0 ? vocabIdx : t.length)
  if (transIdx !== -1 && explIdx !== -1) {
    translation = t.slice(afterTrans, explIdx).replace(/^\s*\n?/, '').replace(/\n?$/, '').trim()
    explanation = t.slice(afterExpl, endExpl).replace(/^\s*\n?/, '').replace(/\n?$/, '').trim()
  } else if (transIdx !== -1) {
    translation = t.slice(afterTrans, backIdx >= 0 ? backIdx : undefined).replace(/^\s*\n?/, '').trim()
  } else {
    explanation = t.slice(afterExpl, endExpl).replace(/^\s*\n?/, '').trim()
  }
  if (backIdx !== -1) {
    const backEnd = vocabIdx >= 0 ? vocabIdx : t.length
    backTranslation = t.slice(backIdx + BACK_MARKER.length, backEnd).replace(/^\s*\n?/, '').trim()
  }
  return { translation, explanation, backTranslation: backTranslation || undefined }
}

export async function translateWithGemini(
  apiKey: string,
  text: string,
  options: {
    region: Region
    gender: Gender
    direction: Direction
    audience: Audience
    tone: Tone
    modelId: GeminiModelId
  }
): Promise<TranslateResult> {
  if (!apiKey.trim()) {
    throw new Error('請先在設定中填入 Gemini API 金鑰')
  }
  if (!text.trim()) {
    throw new Error('請輸入要翻譯的文字')
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim())
  const model = genAI.getGenerativeModel({
    model: options.modelId,
    systemInstruction: buildSystemPrompt(
      options.region,
      options.gender,
      options.direction,
      options.audience,
      options.tone
    )
  })

  const result = await model.generateContent(text.trim())
  const response = result.response
  const output = response.text()
  if (!output) {
    throw new Error('沒有取得翻譯結果，請再試一次')
  }
  return parseTranslationAndExplanation(output)
}
