/** 後端 API 基底路徑（部署後同源 /api，本地開發需 proxy 或 vercel dev） */
const API_BASE = '/api'

const AUTH_TOKEN_KEY = 'tw-vn-translator-token'
const AUTH_USER_KEY = 'tw-vn-translator-user'

export interface ApiUser {
  id: string
  loginId: string
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function getStoredUser(): ApiUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as ApiUser
    return u?.id && u?.loginId ? u : null
  } catch {
    return null
  }
}

export function setStoredAuth(token: string, user: ApiUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `請求失敗 ${res.status}`)
  }
  return data
}

export async function apiRegister(loginId: string, password: string): Promise<{ token: string; user: ApiUser }> {
  const data = await request<{ token: string; user: ApiUser }>('/auth/register', {
    method: 'POST',
    body: { loginId, password }
  })
  return data
}

export async function apiLogin(loginId: string, password: string): Promise<{ token: string; user: ApiUser }> {
  const data = await request<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: { loginId, password }
  })
  return data
}

export interface ApiSettings {
  modelId: string
  hasApiKey: boolean
  preferences: Record<string, unknown>
}

export async function apiGetSettings(token: string): Promise<ApiSettings> {
  return request<ApiSettings>('/settings', { token })
}

export async function apiSaveSettings(
  token: string,
  body: { apiKey?: string; modelId?: string; preferences?: Record<string, unknown> }
): Promise<ApiSettings> {
  return request<ApiSettings>('/settings', { method: 'POST', token, body })
}

export interface TranslateOptions {
  region: string
  gender: string
  direction: string
  audience: string
  tone: string
  modelId: string
}

export async function apiTranslate(
  token: string,
  text: string,
  options: TranslateOptions
): Promise<{ translation: string; explanation: string; backTranslation?: string }> {
  return request<{ translation: string; explanation: string; backTranslation?: string }>('/translate', {
    method: 'POST',
    token,
    body: { text, options }
  })
}
