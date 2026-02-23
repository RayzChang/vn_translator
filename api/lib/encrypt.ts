import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret || secret.length < 16) {
    throw new Error('ENCRYPTION_KEY must be set and at least 16 characters')
  }
  return scryptSync(secret, 'tw-vn-translator', KEY_LEN)
}

export function encrypt(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = (cipher as unknown as { getAuthTag(): Buffer }).getAuthTag()
  const combined = Buffer.concat([iv, tag, enc])
  return combined.toString('base64')
}

export function decrypt(cipherText: string): string {
  const key = getKey()
  const combined = Buffer.from(cipherText, 'base64')
  const iv = combined.subarray(0, IV_LEN)
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = combined.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}
