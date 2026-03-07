use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Match — équivalent du modèle Prisma Match
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Match {
    pub id: i64,
    pub player1: String,
    pub player2: String,
    pub team1: Option<String>,
    pub team2: Option<String>,
    pub player1_score: i64,
    pub player2_score: i64,
    pub is_current: bool,
    pub created_at: DateTime<Utc>,
    pub startgg_set_id: Option<String>,
}

/// DTO création match
#[derive(Debug, Deserialize)]
pub struct CreateMatchDto {
    pub player1: String,
    pub player2: String,
    pub team1: Option<String>,
    pub team2: Option<String>,
}

/// DTO mise à jour score
#[derive(Debug, Deserialize)]
pub struct UpdateScoreDto {
    pub player1_score: i64,
    pub player2_score: i64,
}

/// Données OBS overlay
#[derive(Debug, Serialize)]
pub struct OBSPlayerData {
    pub name: String,
    pub team: Option<String>,
    pub score: i64,
}

#[derive(Debug, Serialize)]
pub struct OBSOverlayData {
    pub players: Vec<OBSPlayerData>,
    pub match_id: Option<i64>,
}

/// Config start.gg (singleton)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StartggConfig {
    pub id: i64,
    pub api_key: String,
    pub tournament_slug: Option<String>,
    pub event_id: Option<String>,
    pub poll_interval_ms: i64,
    pub enabled: bool,
    pub updated_at: DateTime<Utc>,
}

/// Set start.gg (cache local SQLite)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StartggSet {
    pub id: String,
    pub event_id: String,
    pub event_name: Option<String>,
    pub phase_id: i64,
    pub phase_name: Option<String>,
    pub phase_group_id: i64,
    pub full_round_text: String,
    pub identifier: Option<String>,
    pub round: i64,
    pub state: i64,
    pub best_of: i64,
    pub player1_tag: String,
    pub player2_tag: String,
    pub player1_prefix: Option<String>,
    pub player2_prefix: Option<String>,
    pub player1_score: i64,
    pub player2_score: i64,
    pub winner_id: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

/// Set enrichi avec metadata bracket (pour réponse API)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartggSetForBracket {
    #[serde(flatten)]
    pub set: StartggSet,
    pub w_placement: Option<i64>,
    pub l_placement: Option<i64>,
    pub entrant1_source: Option<serde_json::Value>,
    pub entrant2_source: Option<serde_json::Value>,
}

/// Réponse paginée générique
#[derive(Debug, Serialize)]
pub struct PageInfo {
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

/// Réponse JSON erreur standard
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl ErrorResponse {
    pub fn new(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
            details: None,
        }
    }
}
