import { GoogleGenerativeAI } from '@google/generative-ai'

type Region = 'south' | 'north'
type Gender = 'female' | 'male' | 'neutral'
type Direction = 'vn2zh' | 'zh2vn'
type Audience = 'none' | 'elder' | 'peer' | 'younger' | 'lover' | 'boss' | 'colleague' | 'friend' | 'stranger'
type Tone = 'auto' | 'formal' | 'casual' | 'intimate' | 'polite'

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
  const genderText = gender === 'female' ? '女性' : gender === 'male' ? '男性' : '不特別區分性別'
  const dirText = direction === 'vn2zh' ? '將越南文翻譯成繁體中文' : '將繁體中文翻譯成越南文'
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
（從本句提取可存入詞庫的詞條，每行一筆，格式：原文 | 譯文。規則：① 提取有意義的單字、詞組、短語；② 若詞組可拆出常用單字，兩筆都要存，例如「ăn KFC」要存「ăn KFC | 吃KFC」同時也存「ăn | 吃」；③ 每筆長度適中，單字或 2～5 詞的短語為主；④ 不要存整句。若無合適詞彙可留空。）`

}

const TRANSLATION_MARKER = '【翻譯】'
const EXPLANATION_MARKER = '【解釋】'
const BACK_MARKER = '【回譯】'
const VOCAB_MARKER = '【詞彙】'

export interface VocabEntry {
  source: string
  target: string
}

function parseVocabEntries(text: string): VocabEntry[] {
  const idx = text.indexOf(VOCAB_MARKER)
  if (idx === -1) return []
  const after = text.slice(idx + VOCAB_MARKER.length).replace(/^\s*\n?/, '').trim()
  const lines = after.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const entries: VocabEntry[] = []
  for (const line of lines) {
    const sep = line.indexOf('|')
    if (sep === -1) continue
    const source = line.slice(0, sep).trim()
    const target = line.slice(sep + 1).trim()
    if (source && target && source.length <= 100 && target.length <= 100) {
      entries.push({ source, target })
    }
  }
  return entries
}

function parseTranslationAndExplanation(raw: string): { translation: string; explanation: string; backTranslation?: string; vocabEntries: VocabEntry[] } {
  const t = raw.trim()
  const transIdx = t.indexOf(TRANSLATION_MARKER)
  const explIdx = t.indexOf(EXPLANATION_MARKER)
  const backIdx = t.indexOf(BACK_MARKER)
  if (transIdx === -1 && explIdx === -1) {
    return { translation: t, explanation: '', vocabEntries: parseVocabEntries(t) }
  }
  let translation = ''
  let explanation = ''
  let backTranslation = ''
  const vocabIdx = t.indexOf(VOCAB_MARKER)
  const endExpl = backIdx >= 0 ? backIdx : (vocabIdx >= 0 ? vocabIdx : t.length)
  if (transIdx !== -1 && explIdx !== -1) {
    translation = t.slice(transIdx + TRANSLATION_MARKER.length, explIdx).replace(/^\s*\n?/, '').replace(/\n?$/, '').trim()
    explanation = t.slice(explIdx + EXPLANATION_MARKER.length, endExpl).replace(/^\s*\n?/, '').replace(/\n?$/, '').trim()
  } else if (transIdx !== -1) {
    translation = t.slice(transIdx + TRANSLATION_MARKER.length, backIdx >= 0 ? backIdx : undefined).replace(/^\s*\n?/, '').trim()
  } else {
    explanation = t.slice(explIdx + EXPLANATION_MARKER.length, endExpl).replace(/^\s*\n?/, '').trim()
  }
  if (backIdx !== -1) {
    const beforeVocab = t.indexOf(VOCAB_MARKER)
    const endBack = beforeVocab >= 0 ? beforeVocab : t.length
    backTranslation = t.slice(backIdx + BACK_MARKER.length, endBack).replace(/^\s*\n?/, '').trim()
  }
  const vocabEntries = parseVocabEntries(t)
  return { translation, explanation, backTranslation: backTranslation || undefined, vocabEntries }
}


export interface TranslateOptions {
  region: Region
  gender: Gender
  direction: Direction
  audience: Audience
  tone: Tone
  modelId: string
}

export async function translateWithGemini(
  apiKey: string,
  text: string,
  options: TranslateOptions
): Promise<{ translation: string; explanation: string; backTranslation?: string; vocabEntries: VocabEntry[] }> {
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
  const output = result.response.text()
  if (!output) throw new Error('沒有取得翻譯結果')
  return parseTranslationAndExplanation(output)
}
