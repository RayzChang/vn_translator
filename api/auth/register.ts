import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb, query } from '../lib/db'
import { createUser, findUserByLoginId, hashPassword, createToken } from '../lib/auth'
import { getJsonBody } from '../lib/parseBody'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await initDb()
  } catch (e) {
    console.error('initDb', e)
    return res.status(500).json({ error: 'Database unavailable' })
  }
  let body: { loginId?: string; password?: string }
  try {
    body = await getJsonBody<{ loginId?: string; password?: string }>(req)
  } catch (e) {
    console.error('parseBody', e)
    return res.status(400).json({ error: '請求格式錯誤，請使用 JSON' })
  }
  try {
    const loginId = typeof body.loginId === 'string' ? body.loginId.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!loginId || loginId.length < 2) {
      return res.status(400).json({ error: '請輸入帳號（至少 2 個字元）' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '請輸入密碼（至少 6 個字元）' })
    }
    const existing = await findUserByLoginId(loginId)
    if (existing) {
      return res.status(409).json({ error: '此帳號已被使用' })
    }
    const passwordHash = await hashPassword(password)
    const user = await createUser(loginId, passwordHash)
    if (!user?.id) {
      console.error('createUser returned no row')
      return res.status(500).json({ error: '註冊失敗' })
    }
    await query(
      'INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [user.id]
    )
    const token = await createToken(user.id, user.login_id)
    return res.status(200).json({
      token,
      user: { id: user.id, loginId: user.login_id }
    })
  } catch (e) {
    console.error('register', e)
    return res.status(500).json({ error: '註冊失敗' })
  }
}
