import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb, query } from '../lib/db'
import { getBearerToken, verifyToken } from '../lib/auth'
import { decrypt } from '../lib/encrypt'
import { translateWithGemini } from '../lib/translate'

interface SettingsRow {
  api_key_encrypted: string | null
  model_id: string | null
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

  const body = req.body as { text?: string; options?: Record<string, unknown> }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const opts = body.options && typeof body.options === 'object' ? body.options : {}
  if (!text) {
    return res.status(400).json({ error: '請輸入要翻譯的文字' })
  }

  const options = {
    region: (opts.region as 'south' | 'north') || 'south',
    gender: (opts.gender as 'female' | 'male' | 'neutral') || 'male',
    direction: (opts.direction as 'vn2zh' | 'zh2vn') || 'vn2zh',
    audience: (opts.audience as string) || 'none',
    tone: (opts.tone as string) || 'auto',
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
