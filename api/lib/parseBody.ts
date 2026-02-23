import type { VercelRequest } from '@vercel/node'

/**
 * 取得 POST 的 JSON body。Vercel 同源請求有時不會自動解析 req.body，改從 stream 讀取。
 */
export async function getJsonBody<T = Record<string, unknown>>(req: VercelRequest): Promise<T> {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as T
  }
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    const r = req as unknown as { on: (e: string, cb: (...args: unknown[]) => void) => void }
    r.on('data', (chunk: Buffer) => chunks.push(chunk))
    r.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    r.on('error', reject)
  })
  if (!raw.trim()) return {} as T
  return JSON.parse(raw) as T
}
