import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb, query } from '../lib/db'
import { getBearerToken, verifyToken } from '../lib/auth'
import { encrypt } from '../lib/encrypt'

interface SettingsRow {
  api_key_encrypted: string | null
  model_id: string | null
  preferences: Record<string, unknown>
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
    const r = await query<SettingsRow>(
      'SELECT api_key_encrypted, model_id, preferences FROM settings WHERE user_id = $1',
      [payload.userId]
    )
    const row = r.rows[0]
    if (!row) {
      return res.status(200).json({ modelId: 'gemini-2.5-flash', hasApiKey: false, preferences: {} })
    }
    return res.status(200).json({
      modelId: row.model_id || 'gemini-2.5-flash',
      hasApiKey: Boolean(row.api_key_encrypted),
      preferences: row.preferences || {}
    })
  }

  if (req.method === 'POST') {
    const body = req.body as { apiKey?: string; modelId?: string; preferences?: Record<string, unknown> }
    const apiKey = body.apiKey !== undefined ? (typeof body.apiKey === 'string' ? body.apiKey.trim() : null) : undefined
    const modelId = typeof body.modelId === 'string' ? body.modelId : undefined
    const preferences = body.preferences && typeof body.preferences === 'object' ? body.preferences : undefined

    const r = await query<SettingsRow>(
      'SELECT api_key_encrypted, model_id, preferences FROM settings WHERE user_id = $1',
      [payload.userId]
    )
    let row = r.rows[0]
    if (!row) {
      await query(
        'INSERT INTO settings (user_id, api_key_encrypted, model_id, preferences) VALUES ($1, $2, $3, $4)',
        [
          payload.userId,
          apiKey !== undefined ? (apiKey ? encrypt(apiKey) : null) : null,
          modelId || 'gemini-2.5-flash',
          JSON.stringify(preferences || {})
        ]
      )
    } else {
      const updates: string[] = []
      const values: unknown[] = []
      let i = 1
      if (apiKey !== undefined) {
        updates.push(`api_key_encrypted = $${i++}`)
        values.push(apiKey ? encrypt(apiKey) : null)
      }
      if (modelId !== undefined) {
        updates.push(`model_id = $${i++}`)
        values.push(modelId)
      }
      if (preferences !== undefined) {
        updates.push(`preferences = $${i++}::jsonb`)
        values.push(JSON.stringify(preferences))
      }
      if (updates.length > 0) {
        updates.push('updated_at = NOW()')
        values.push(payload.userId)
        const whereNum = values.length
        await query(
          `UPDATE settings SET ${updates.join(', ')} WHERE user_id = $${whereNum}`,
          values
        )
      }
    }
    const refetch = await query<SettingsRow>(
      'SELECT api_key_encrypted, model_id, preferences FROM settings WHERE user_id = $1',
      [payload.userId]
    )
    row = refetch.rows[0]
    return res.status(200).json({
      modelId: row?.model_id || 'gemini-2.5-flash',
      hasApiKey: Boolean(row?.api_key_encrypted),
      preferences: row?.preferences || {}
    })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
