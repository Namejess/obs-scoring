use crate::{
    db::{matches as db_matches, startgg_sets as db_sets},
    models::{ErrorResponse, StartggSet},
    services::{polling, startgg as svc},
    state::AppState,
    websocket::events::{WsEvent, broadcast},
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct SetsQuery {
    pub states: Option<String>, // ex: "2,6,7"
    pub per_page: Option<i64>,
    pub page: Option<i64>,
}

/// GET /api/startgg/config
pub async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match sqlx::query_as!(
        crate::models::StartggConfig,
        r#"SELECT id, api_key, tournament_slug, event_id, poll_interval_ms, enabled,
           updated_at as "updated_at: _" FROM startgg_config WHERE id = 1"#
    )
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(mut config)) => {
            if !config.api_key.is_empty() {
                config.api_key = "***configured***".to_string();
            }
            (StatusCode::OK, Json(serde_json::json!(config))).into_response()
        }
        Ok(None) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "id": 1, "api_key": "", "tournament_slug": null, "event_id": null,
                "poll_interval_ms": 15000, "enabled": false
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// PUT /api/startgg/config
#[derive(Debug, Deserialize, Serialize)]
pub struct PutConfigBody {
    pub api_key: Option<String>,
    pub tournament_slug: Option<String>,
    pub event_id: Option<String>,
    pub poll_interval_ms: Option<i64>,
    pub enabled: Option<bool>,
}

pub async fn put_config(
    State(state): State<Arc<AppState>>,
    Json(body): Json<PutConfigBody>,
) -> impl IntoResponse {
    // Read current config first
    let current = sqlx::query_as!(
        crate::models::StartggConfig,
        r#"SELECT id, api_key, tournament_slug, event_id, poll_interval_ms, enabled,
           updated_at as "updated_at: _" FROM startgg_config WHERE id = 1"#
    )
    .fetch_optional(&state.pool)
    .await;

    let (old_api_key, old_slug, old_event_id, old_interval, old_enabled) = match current {
        Ok(Some(c)) => (c.api_key, c.tournament_slug, c.event_id, c.poll_interval_ms, c.enabled),
        _ => (String::new(), None, None, 15000, false),
    };

    let new_api_key = body.api_key.as_deref().unwrap_or(&old_api_key).to_string();
    let new_slug = body.tournament_slug.as_deref().or(old_slug.as_deref());
    let new_event_id = body.event_id.as_deref().or(old_event_id.as_deref());
    let new_interval = body.poll_interval_ms.unwrap_or(old_interval);
    let new_enabled = body.enabled.unwrap_or(old_enabled);

    let result = sqlx::query!(
        r#"INSERT INTO startgg_config (id, api_key, tournament_slug, event_id, poll_interval_ms, enabled, updated_at)
           VALUES (1, ?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             api_key        = COALESCE(NULLIF(?1, ''), api_key),
             tournament_slug = ?2,
             event_id        = ?3,
             poll_interval_ms = ?4,
             enabled         = ?5,
             updated_at      = CURRENT_TIMESTAMP"#,
        new_api_key,
        new_slug,
        new_event_id,
        new_interval,
        new_enabled,
    )
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => {
            // Reload and return (mask key)
            match sqlx::query_as!(
                crate::models::StartggConfig,
                r#"SELECT id, api_key, tournament_slug, event_id, poll_interval_ms, enabled,
                   updated_at as "updated_at: _" FROM startgg_config WHERE id = 1"#
            )
            .fetch_one(&state.pool)
            .await
            {
                Ok(mut config) => {
                    if !config.api_key.is_empty() {
                        config.api_key = "***configured***".to_string();
                    }
                    (StatusCode::OK, Json(serde_json::json!(config))).into_response()
                }
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse::new(e.to_string())),
                )
                    .into_response(),
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// GET /api/startgg/local-sets?eventId=
pub async fn get_local_sets(
    State(state): State<Arc<AppState>>,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let event_id = q.get("eventId").cloned().unwrap_or_default();
    if event_id.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("eventId is required")),
        )
            .into_response();
    }

    match db_sets::find_by_event(&state.pool, &event_id, None).await {
        Ok(sets) => (StatusCode::OK, Json(sets)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

fn format_player_name(prefix: &Option<String>, tag: &str) -> String {
    match prefix {
        Some(p) if !p.is_empty() => format!("{} | {}", p, tag),
        _ => tag.to_string(),
    }
}

// ─── Helper: get api_key from DB or return 503 ───────────────────────────────

async fn require_api_key(state: &AppState) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let key = sqlx::query_scalar!(
        r#"SELECT api_key FROM startgg_config WHERE id = 1"#
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_default();

    if key.is_empty() {
        Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse::new("start.gg API key not configured. Set it in /api/startgg/config.")),
        ))
    } else {
        Ok(key)
    }
}

// ─── GET /api/startgg/tournaments ────────────────────────────────────────────

pub async fn get_tournaments(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let api_key = match require_api_key(&state).await {
        Ok(k) => k,
        Err(e) => return e.into_response(),
    };

    match svc::get_my_tournaments(&state.http_client, &api_key).await {
        Ok(tournaments) => (StatusCode::OK, Json(tournaments)).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse::new(format!("start.gg error: {}", e))),
        )
            .into_response(),
    }
}

// ─── GET /api/startgg/tournaments/:slug/events ────────────────────────────────

pub async fn get_tournament_events(
    State(state): State<Arc<AppState>>,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let api_key = match require_api_key(&state).await {
        Ok(k) => k,
        Err(e) => return e.into_response(),
    };

    match svc::get_tournament_events(&state.http_client, &api_key, &slug).await {
        Ok(events) => (StatusCode::OK, Json(events)).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse::new(format!("start.gg error: {}", e))),
        )
            .into_response(),
    }
}

// ─── GET /api/startgg/events/:eventId/sets ────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EventSetsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub states: Option<String>, // "2,6,7"
}

pub async fn get_event_sets(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
    Query(q): Query<EventSetsQuery>,
) -> impl IntoResponse {
    let api_key = match require_api_key(&state).await {
        Ok(k) => k,
        Err(e) => return e.into_response(),
    };

    let states = q.states.as_deref().map(|s| {
        s.split(',')
            .filter_map(|v| v.trim().parse::<i64>().ok())
            .collect::<Vec<_>>()
    });

    let opts = svc::GetSetsOptions {
        page: q.page.unwrap_or(1),
        per_page: q.per_page.unwrap_or(30),
        states,
    };

    match svc::get_event_sets(&state.http_client, &api_key, &state.pool, &event_id, opts).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse::new(format!("start.gg error: {}", e))),
        )
            .into_response(),
    }
}

// ─── GET /api/startgg/events/:eventId/active ─────────────────────────────────

pub async fn get_active_sets(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
) -> impl IntoResponse {
    let api_key = match require_api_key(&state).await {
        Ok(k) => k,
        Err(e) => return e.into_response(),
    };

    match svc::get_active_sets(&state.http_client, &api_key, &state.pool, &event_id).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse::new(format!("start.gg error: {}", e))),
        )
            .into_response(),
    }
}

// ─── GET /api/startgg/sets/:setId ────────────────────────────────────────────

pub async fn get_set_detail(
    State(state): State<Arc<AppState>>,
    Path(set_id): Path<String>,
) -> impl IntoResponse {
    let api_key = match require_api_key(&state).await {
        Ok(k) => k,
        Err(e) => return e.into_response(),
    };

    match svc::get_set_detail(&state.http_client, &api_key, &set_id).await {
        Ok(set) => (StatusCode::OK, Json(set)).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse::new(format!("start.gg error: {}", e))),
        )
            .into_response(),
    }
}

// ─── POST /api/startgg/sets/:setId/select (fallback GraphQL si absent du cache) ─

/// Sélectionne un set comme match courant. Cherche d'abord dans le cache SQLite,
/// si absent appelle l'API start.gg pour récupérer les détails.
pub async fn select_set_with_fallback(
    State(state): State<Arc<AppState>>,
    Path(set_id): Path<String>,
) -> impl IntoResponse {
    // 1. Chercher dans le cache local
    let cached = db_sets::find_by_id(&state.pool, &set_id).await;

    let set: StartggSet = match cached {
        Ok(Some(s)) => s,
        Ok(None) => {
            // 2. Fallback: récupérer via API start.gg
            let api_key = match require_api_key(&state).await {
                Ok(k) => k,
                Err(_) => {
                    return (
                        StatusCode::NOT_FOUND,
                        Json(ErrorResponse::new("Set not found in local cache. Fetch event sets first or configure API key.")),
                    ).into_response();
                }
            };

            match svc::get_set_detail(&state.http_client, &api_key, &set_id).await {
                Ok(gql_set) => {
                    let event_id = gql_set.event.as_ref().map(|e| e.id.to_string()).unwrap_or_default();
                    let event_name = gql_set.event.as_ref().map(|e| e.name.as_str());
                    match svc::map_set_to_db(&gql_set, &event_id, event_name) {
                        Some(s) => {
                            // Persister en cache
                            let _ = db_sets::upsert_batch(&state.pool, &[s.clone()]).await;
                            s
                        }
                        None => {
                            return (
                                StatusCode::NOT_FOUND,
                                Json(ErrorResponse::new("Set not found")),
                            ).into_response();
                        }
                    }
                }
                Err(e) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(ErrorResponse::new(format!("start.gg error: {}", e))),
                    ).into_response();
                }
            }
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse::new(e.to_string())),
            )
                .into_response();
        }
    };

    // Créer/update le match lié
    let player1 = format_player_name(&set.player1_prefix, &set.player1_tag);
    let player2 = format_player_name(&set.player2_prefix, &set.player2_tag);

    let match_result = match sqlx::query!(
        r#"INSERT INTO matches (player1, player2, player1_score, player2_score, is_current, startgg_set_id)
           VALUES (?, ?, ?, ?, 1, ?)
           ON CONFLICT(startgg_set_id) DO UPDATE SET
             player1 = excluded.player1,
             player2 = excluded.player2,
             player1_score = excluded.player1_score,
             player2_score = excluded.player2_score,
             is_current = 1"#,
        player1,
        player2,
        set.player1_score,
        set.player2_score,
        set.id,
    )
    .execute(&state.pool)
    .await
    {
        Ok(_) => {
            sqlx::query!(
                "UPDATE matches SET is_current = 0 WHERE is_current = 1 AND (startgg_set_id != ? OR startgg_set_id IS NULL)",
                set.id
            )
            .execute(&state.pool)
            .await
            .ok();
            db_matches::find_current(&state.pool).await
        }
        Err(e) => Err(anyhow::anyhow!(e)),
    };

    match match_result {
        Ok(Some(m)) => {
            broadcast(
                &state.ws_clients,
                WsEvent::CurrentMatchChanged { match_data: Some(m.clone()) },
            )
            .await;
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "match": m,
                    "set": set,
                    "fullRoundText": set.full_round_text,
                })),
            )
                .into_response()
        }
        Ok(None) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new("Failed to retrieve created match")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

// ─── POST /api/startgg/poll/start ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PollStartPayload {
    pub event_id: String,
    pub interval_ms: Option<u64>,
}

pub async fn poll_start(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PollStartPayload>,
) -> impl IntoResponse {
    if payload.event_id.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("event_id is required")),
        )
            .into_response();
    }

    // Verify API key is configured
    if require_api_key(&state).await.is_err() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse::new("start.gg API key not configured")),
        )
            .into_response();
    }

    let interval_ms = payload.interval_ms.unwrap_or(15_000);
    polling::start_polling(
        state.clone(),
        state.polling_handles.clone(),
        payload.event_id.clone(),
        interval_ms,
    )
    .await;

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "started",
            "event_id": payload.event_id,
            "interval_ms": interval_ms,
        })),
    )
        .into_response()
}

// ─── POST /api/startgg/poll/stop ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PollStopPayload {
    pub event_id: Option<String>,
}

pub async fn poll_stop(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PollStopPayload>,
) -> impl IntoResponse {
    match payload.event_id.as_deref() {
        Some(event_id) if !event_id.is_empty() => {
            let stopped = polling::stop_polling(&state.polling_handles, event_id).await;
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": if stopped { "stopped" } else { "not_found" }, "event_id": event_id })),
            )
                .into_response()
        }
        _ => {
            polling::stop_all_polling(&state.polling_handles).await;
            (StatusCode::OK, Json(serde_json::json!({ "status": "all_stopped" }))).into_response()
        }
    }
}

// ─── GET /api/startgg/poll/status ────────────────────────────────────────────

pub async fn poll_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let handles = state.polling_handles.read().await;
    let active: Vec<&String> = handles.keys().collect();
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "active_polls": active,
            "count": active.len(),
        })),
    )
        .into_response()
}
