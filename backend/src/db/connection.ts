import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
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

    await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT FALSE;
  `);

    await pool.query(`
    ALTER TABLE metadata_cache
      ADD COLUMN IF NOT EXISTS tmdb_id INTEGER,
      ADD COLUMN IF NOT EXISTS media_type TEXT,
      ADD COLUMN IF NOT EXISTS release_date TEXT DEFAULT '';

    UPDATE metadata_cache SET release_date = '' WHERE release_date IS NULL;
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS recommendation_feedback (
      id          SERIAL PRIMARY KEY,
      tmdb_id     INTEGER NOT NULL,
      media_type  VARCHAR(10) NOT NULL,
      title       TEXT NOT NULL,
      summary     TEXT NOT NULL,
      feedback    VARCHAR(10) NOT NULL CHECK (feedback IN ('like', 'dislike')),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (tmdb_id, media_type)
    );

    CREATE TABLE IF NOT EXISTS recommendation_cache (
      id                SERIAL PRIMARY KEY,
      recommendations   JSONB NOT NULL,
      generated_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);

    await pool.query(`
    ALTER TABLE recommendation_feedback
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE recommendation_cache
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  `);

    await pool.query(`
    ALTER TABLE recommendation_feedback
      DROP CONSTRAINT IF EXISTS recommendation_feedback_tmdb_id_media_type_key;
  `);

    await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS recommendation_feedback_user_tmdb_media_idx
      ON recommendation_feedback (user_id, tmdb_id, media_type);
  `);

    await pool.query(`
    ALTER TABLE recommendation_cache
      ADD COLUMN IF NOT EXISTS media_type_filter TEXT;
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id         SERIAL PRIMARY KEY,
      level      VARCHAR(10) NOT NULL,
      message    TEXT NOT NULL,
      context    JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS logs_level_idx ON logs (level);
  `);

    await pool.query(`
    ALTER TABLE metadata_cache
      ADD COLUMN IF NOT EXISTS trailer_key VARCHAR(50);
  `);

    await pool.query(`
    ALTER TABLE metadata_cache
      ADD COLUMN IF NOT EXISTS imdb_id TEXT;
  `);

    await pool.query(`
    ALTER TABLE jellyfin_library
      ADD COLUMN IF NOT EXISTS date_created TIMESTAMPTZ;
  `);

    await pool.query(`
    ALTER TABLE jellyfin_library
      ADD COLUMN IF NOT EXISTS media_info JSONB;
  `);

    await pool.query(`
    ALTER TABLE jellyfin_library
      ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS jellyfin_library (
      id          SERIAL PRIMARY KEY,
      jellyfin_id VARCHAR(255) UNIQUE NOT NULL,
      tmdb_id     INTEGER,
      media_type  VARCHAR(10),
      title       TEXT NOT NULL,
      year        TEXT,
      synced_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS jellyfin_sync_log (
      id            SERIAL PRIMARY KEY,
      started_at    TIMESTAMPTZ DEFAULT NOW(),
      success       BOOLEAN NOT NULL,
      item_count    INTEGER,
      error_message TEXT
    );
  `);
}
