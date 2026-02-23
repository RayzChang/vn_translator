import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    pool = new Pool({ connectionString })
  }
  return pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params)
}

export async function initDb(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      login_id VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      api_key_encrypted TEXT,
      model_id VARCHAR(100) DEFAULT 'gemini-2.5-flash',
      preferences JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      direction VARCHAR(10) NOT NULL CHECK (direction IN ('vn2zh', 'zh2vn')),
      source_text TEXT NOT NULL,
      target_text TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, direction, source_text)
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_vocabulary_user_direction ON vocabulary(user_id, direction)`)
}
