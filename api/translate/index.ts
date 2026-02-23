import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb, query } from '../lib/db.js'
import { getBearerToken, verifyToken } from '../lib/auth.js'
import { decrypt } from '../lib/encrypt.js'
import { getJsonBody } from '../lib/parseBody.js'
import type { TranslateOptions } from '../lib/translate.js'
import { translateWithGemini } from '../lib/translate.js'

interface SettingsRow {
  api_key_encrypted: string | null
  model_id: string | null
}

interface VocabRow {
  target_text: string
  note: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = getBearerToken(req)
  const payload = token ? await verifyToken(token) : null
  if (!payload) {
    return res.status(401).json({ error: '請先登入' })
  }

  try {
    await initDb()
  } catch (e) {
    console.error('initDb', e)
    return res.status(500).json({ error: 'Database unavailable' })
  }

  const r = await query<SettingsRow>(
    'SELECT api_key_encrypted, model_id FROM settings WHERE user_id = $1',
    [payload.userId]
  )
  const row = r.rows[0]
  if (!row?.api_key_encrypted) {
    return res.status(400).json({ error: '請先在設定中填入 Gemini API 金鑰並儲存' })
  }

  let apiKey: string
  try {
    apiKey = decrypt(row.api_key_encrypted)
  } catch {
    return res.status(500).json({ error: '金鑰解密失敗' })
  }

  let body: { text?: string; options?: Record<string, unknown> }
  try {
    body = await getJsonBody(req)
  } catch (e) {
    console.error('translate parseBody', e)
    return res.status(400).json({ error: '請求格式錯誤' })
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const opts = body.options && typeof body.options === 'object' ? body.options : {}
  if (!text) {
    return res.status(400).json({ error: '請輸入要翻譯的文字' })
  }

  const direction = opts.direction === 'zh2vn' ? 'zh2vn' : 'vn2zh'

  // P3: 先查詞庫，命中則直接回傳
  const vocabRes = await query<VocabRow>(
    'SELECT target_text, note FROM vocabulary WHERE user_id = $1 AND direction = $2 AND source_text = $3 LIMIT 1',
    [payload.userId, direction, text]
  )
  const vocabRow = vocabRes.rows[0]
  if (vocabRow) {
    return res.status(200).json({
      translation: vocabRow.target_text,
      explanation: vocabRow.note || '',
      backTranslation: undefined,
      fromVocabulary: true
    })
  }

  const options: TranslateOptions = {
    region: (opts.region === 'north' ? 'north' : 'south'),
    gender: (opts.gender === 'female' || opts.gender === 'neutral' ? opts.gender : 'male'),
    direction,
    audience: (['none', 'elder', 'peer', 'younger', 'lover', 'boss', 'colleague', 'friend', 'stranger'].includes(String(opts.audience)) ? opts.audience : 'none') as TranslateOptions['audience'],
    tone: (['auto', 'formal', 'casual', 'intimate', 'polite'].includes(String(opts.tone)) ? opts.tone : 'auto') as TranslateOptions['tone'],
    modelId: (opts.modelId as string) || row.model_id || 'gemini-2.5-flash'
  }

  try {
    const result = await translateWithGemini(apiKey, text, options)
    return res.status(200).json(result)
  } catch (e) {
    console.error('translate', e)
    const msg = e instanceof Error ? e.message : '翻譯失敗'
    return res.status(500).json({ error: msg })
  }
}
