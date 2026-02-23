import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb } from '../lib/db.js'
import { findUserByLoginId, verifyPassword, createToken } from '../lib/auth.js'
import { getJsonBody } from '../lib/parseBody.js'

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
    if (!loginId || !password) {
      return res.status(400).json({ error: '請輸入帳號與密碼' })
    }
    const user = await findUserByLoginId(loginId)
    if (!user) {
      return res.status(401).json({ error: '帳號或密碼錯誤' })
    }
    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: '帳號或密碼錯誤' })
    }
    const token = await createToken(user.id, user.login_id)
    return res.status(200).json({
      token,
      user: { id: user.id, loginId: user.login_id }
    })
  } catch (e) {
    console.error('login', e)
    return res.status(500).json({ error: '登入失敗' })
  }
}
