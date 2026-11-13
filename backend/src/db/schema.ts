export const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(255) UNIQUE NOT NULL,
      valid         BOOLEAN DEFAULT FALSE,
      ip_address    VARCHAR(45),
      user_agent    TEXT,
      last_login    TIMESTAMPTZ,
      admin         BOOLEAN DEFAULT FALSE,
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
      tmdb_id      INTEGER,
      media_type   TEXT,
      release_date TEXT DEFAULT '',
      trailer_key  VARCHAR(50),
      imdb_id      TEXT,
      cached_at    TIMESTAMPTZ DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL
    );

    -- TEMPORARY MIGRATION: remove after the production DB has been updated for unified metadata caching.
    ALTER TABLE metadata_cache ADD COLUMN IF NOT EXISTS release_date TEXT DEFAULT '';
    ALTER TABLE metadata_cache ADD COLUMN IF NOT EXISTS trailer_key VARCHAR(50);
    ALTER TABLE metadata_cache ADD COLUMN IF NOT EXISTS imdb_id TEXT;

    CREATE INDEX IF NOT EXISTS metadata_cache_tmdb_media_expires_idx
      ON metadata_cache (tmdb_id, media_type, expires_at);

    CREATE TABLE IF NOT EXISTS recommendation_feedback (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tmdb_id     INTEGER NOT NULL,
      media_type  VARCHAR(10) NOT NULL,
      title       TEXT NOT NULL,
      feedback    VARCHAR(10) NOT NULL CHECK (feedback IN ('like', 'dislike')),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS recommendation_feedback_user_tmdb_media_idx
      ON recommendation_feedback (user_id, tmdb_id, media_type);

    CREATE TABLE IF NOT EXISTS recommendation_cache (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recommendations   JSONB NOT NULL,
      media_type_filter TEXT,
      generated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS logs (
      id         SERIAL PRIMARY KEY,
      level      VARCHAR(10) NOT NULL,
      message    TEXT NOT NULL,
      context    JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS logs_level_idx ON logs (level);

    CREATE TABLE IF NOT EXISTS qbittorrent_torrents (
      id           SERIAL PRIMARY KEY,
      hash         VARCHAR(40) UNIQUE NOT NULL,
      name         TEXT NOT NULL,
      content_path TEXT NOT NULL,
      added_on     TIMESTAMPTZ,
      synced_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS jellyfin_library (
      id           SERIAL PRIMARY KEY,
      jellyfin_id  VARCHAR(255) UNIQUE NOT NULL,
      tmdb_id      INTEGER,
      media_type   VARCHAR(10),
      title        TEXT NOT NULL,
      year         TEXT,
      date_created TIMESTAMPTZ,
      media_info   JSONB,
      size_bytes   BIGINT,
      path         TEXT,
      synced_at    TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE jellyfin_library ADD COLUMN IF NOT EXISTS seasons JSONB;

    CREATE TABLE IF NOT EXISTS sync_log (
      id            SERIAL PRIMARY KEY,
      service       VARCHAR(32) NOT NULL,
      started_at    TIMESTAMPTZ DEFAULT NOW(),
      success       BOOLEAN NOT NULL,
      item_count    INTEGER,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS sync_log_service_started_at_idx ON sync_log (service, started_at DESC);

    CREATE TABLE IF NOT EXISTS watchlist_items (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tmdb_id         INTEGER NOT NULL,
      media_type      VARCHAR(10) NOT NULL,
      title           TEXT NOT NULL,
      year            TEXT NOT NULL DEFAULT '',
      poster          TEXT NOT NULL DEFAULT '',
      imdb_id         TEXT NOT NULL DEFAULT '',
      keywords        TEXT[] NOT NULL DEFAULT '{}',
      last_checked_at TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_user_tmdb_media_idx
      ON watchlist_items (user_id, tmdb_id, media_type);

    -- TEMPORARY MIGRATION: remove after the production DB has been updated for multi-tracker watchlists.
    -- Known releases from before trackers were stored are dropped; followed titles are kept and re-baselined.
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'watchlist_releases' AND column_name = 'tracker'
      ) THEN
        DROP TABLE IF EXISTS watchlist_releases;
        UPDATE watchlist_items SET last_checked_at = NULL;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS watchlist_releases (
      item_id      INTEGER NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
      tracker      VARCHAR(32) NOT NULL,
      torrent_id   VARCHAR(64) NOT NULL,
      release_name TEXT NOT NULL,
      details_url  TEXT NOT NULL DEFAULT '',
      size         BIGINT NOT NULL DEFAULT 0,
      seen         BOOLEAN NOT NULL DEFAULT TRUE,
      found_at     TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (item_id, tracker, torrent_id)
    );

    CREATE TABLE IF NOT EXISTS watchlist_tracker_checks (
      item_id    INTEGER NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
      tracker    VARCHAR(32) NOT NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (item_id, tracker)
    );

    CREATE INDEX IF NOT EXISTS watchlist_releases_unseen_idx ON watchlist_releases (item_id) WHERE NOT seen;

    CREATE TABLE IF NOT EXISTS settings (
      key        VARCHAR(64) PRIMARY KEY,
      value      TEXT NOT NULL,
      encrypted  BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
