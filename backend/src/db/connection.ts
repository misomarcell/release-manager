import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(255) UNIQUE NOT NULL,
      valid         BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id              VARCHAR(512) PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      public_key      BYTEA NOT NULL,
      counter         BIGINT DEFAULT 0,
      transports      TEXT[],
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token       VARCHAR(512) PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id          SERIAL PRIMARY KEY,
      challenge   VARCHAR(512) NOT NULL,
      username    VARCHAR(255),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
    );

    CREATE TABLE IF NOT EXISTS metadata_cache (
      cache_key    VARCHAR(512) PRIMARY KEY,
      title        TEXT,
      year         TEXT,
      poster       TEXT,
      genre        TEXT,
      runtime      TEXT,
      rating       TEXT,
      rated        TEXT,
      plot         TEXT,
      cached_at    TIMESTAMPTZ DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`DROP TABLE IF EXISTS omdb_cache`);

  await pool.query(`
    ALTER TABLE challenges
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

    UPDATE challenges
    SET expires_at = COALESCE(
      expires_at,
      created_at + INTERVAL '5 minutes',
      NOW() + INTERVAL '5 minutes'
    )
    WHERE expires_at IS NULL;

    ALTER TABLE challenges
      ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '5 minutes');

    ALTER TABLE challenges
      ALTER COLUMN expires_at SET NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
  `);
}
