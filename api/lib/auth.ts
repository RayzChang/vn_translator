import bcrypt from 'bcryptjs'
import * as jose from 'jose'
import { query } from './db'

const SALT_ROUNDS = 10
const JWT_SECRET = process.env.JWT_SECRET || 'tw-vn-translator-dev-secret-change-in-production'
const JWT_ISSUER = 'tw-vn-translator'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(userId: string, loginId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return new jose.SignJWT({ userId, loginId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<{ userId: string; loginId: string } | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret, { issuer: JWT_ISSUER })
    const userId = payload.userId as string
    const loginId = payload.loginId as string
    if (!userId || !loginId) return null
    return { userId, loginId }
  } catch {
    return null
  }
}

export function getBearerToken(req: { headers?: { authorization?: string } }): string | null {
  const auth = req.headers?.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

export interface UserRow {
  id: string
  login_id: string
  password_hash: string
}

export async function findUserByLoginId(loginId: string): Promise<UserRow | null> {
  const res = await query<UserRow>('SELECT id, login_id, password_hash FROM users WHERE login_id = $1', [loginId.trim().toLowerCase()])
  return res.rows[0] ?? null
}

export async function createUser(loginId: string, passwordHash: string): Promise<UserRow> {
  const res = await query<UserRow>(
    'INSERT INTO users (login_id, password_hash) VALUES ($1, $2) RETURNING id, login_id, password_hash',
    [loginId.trim().toLowerCase(), passwordHash]
  )
  return res.rows[0]
}
