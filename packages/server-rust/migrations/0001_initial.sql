-- Migration initiale : création des tables
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1 TEXT NOT NULL,
    player2 TEXT NOT NULL,
    team1 TEXT,
    team2 TEXT,
    player1_score INTEGER NOT NULL DEFAULT 0,
    player2_score INTEGER NOT NULL DEFAULT 0,
    is_current BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    startgg_set_id TEXT UNIQUE REFERENCES startgg_sets(id)
);

CREATE TABLE IF NOT EXISTS startgg_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    api_key TEXT NOT NULL DEFAULT '',
    tournament_slug TEXT,
    event_id TEXT,
    poll_interval_ms INTEGER NOT NULL DEFAULT 15000,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS startgg_sets (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_name TEXT,
    phase_id TEXT NOT NULL DEFAULT '',
    phase_name TEXT,
    phase_group_id TEXT NOT NULL DEFAULT '',
    full_round_text TEXT NOT NULL DEFAULT '',
    identifier TEXT,
    round INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL DEFAULT 1,
    best_of INTEGER NOT NULL DEFAULT 3,
    player1_tag TEXT NOT NULL DEFAULT '',
    player2_tag TEXT NOT NULL DEFAULT '',
    player1_prefix TEXT,
    player2_prefix TEXT,
    player1_score INTEGER NOT NULL DEFAULT 0,
    player2_score INTEGER NOT NULL DEFAULT 0,
    winner_id TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_matches_is_current ON matches(is_current);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startgg_sets_event_id ON startgg_sets(event_id);
CREATE INDEX IF NOT EXISTS idx_startgg_sets_state ON startgg_sets(state);
