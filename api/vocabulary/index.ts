import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb, query } from '../lib/db.js'
import { getBearerToken, verifyToken } from '../lib/auth.js'
import { getJsonBody } from '../lib/parseBody.js'

interface VocabRow {
  id: string
  direction: string
  source_text: string
  target_text: string
  note: string | null
  created_at: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  if (req.method === 'GET') {
    const direction = typeof req.query.direction === 'string' && (req.query.direction === 'vn2zh' || req.query.direction === 'zh2vn') ? req.query.direction : null
    const q = direction
      ? 'SELECT id, direction, source_text, target_text, note, created_at FROM vocabulary WHERE user_id = $1 AND direction = $2 ORDER BY updated_at DESC'
      : 'SELECT id, direction, source_text, target_text, note, created_at FROM vocabulary WHERE user_id = $1 ORDER BY updated_at DESC'
    const params = direction ? [payload.userId, direction] : [payload.userId]
    const r = await query<VocabRow>(q, params)
    return res.status(200).json({ items: r.rows })
  }

  if (req.method === 'POST') {
    let body: { sourceText?: string; targetText?: string; direction?: string; note?: string }
    try {
      body = await getJsonBody(req)
    } catch (e) {
      console.error('vocabulary parseBody', e)
      return res.status(400).json({ error: '請求格式錯誤' })
    }
    const sourceText = typeof body.sourceText === 'string' ? body.sourceText.trim() : ''
    const targetText = typeof body.targetText === 'string' ? body.targetText.trim() : ''
    const direction = body.direction === 'zh2vn' ? 'zh2vn' : 'vn2zh'
    const note = typeof body.note === 'string' ? body.note.trim() || null : null
    if (!sourceText || !targetText) {
      return res.status(400).json({ error: '請提供原文與譯文' })
    }
    const r = await query<VocabRow>(
      `INSERT INTO vocabulary (user_id, direction, source_text, target_text, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, direction, source_text)
       DO UPDATE SET target_text = EXCLUDED.target_text, note = EXCLUDED.note, updated_at = NOW()
       RETURNING id, direction, source_text, target_text, note, created_at`,
      [payload.userId, direction, sourceText, targetText, note]
    )
    const row = r.rows[0]
    return res.status(200).json({ item: row, updated: r.rowCount === 1 })
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
    if (!id) return res.status(400).json({ error: '請提供 id' })
    const r = await query('DELETE FROM vocabulary WHERE id = $1 AND user_id = $2 RETURNING id', [id, payload.userId])
    if (r.rowCount === 0) return res.status(404).json({ error: '找不到該詞條' })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
