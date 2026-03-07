use crate::{
    db::matches as db,
    models::{CreateMatchDto, ErrorResponse, UpdateScoreDto},
    state::AppState,
    websocket::events::{WsEvent, broadcast},
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

/// GET /matches
pub async fn list_matches(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match db::find_all(&state.pool).await {
        Ok(matches) => (StatusCode::OK, Json(serde_json::json!(matches))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// GET /matches/current
pub async fn get_current_match(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match db::find_current(&state.pool).await {
        Ok(Some(m)) => (StatusCode::OK, Json(m)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new("No current match")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// GET /matches/obsData
pub async fn get_obs_data(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match db::get_obs_data(&state.pool).await {
        Ok(data) => (StatusCode::OK, Json(data)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// GET /matches/:id
pub async fn get_match(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match db::find_by_id(&state.pool, id).await {
        Ok(Some(m)) => (StatusCode::OK, Json(m)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new("Match not found")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// POST /matches
pub async fn create_match(
    State(state): State<Arc<AppState>>,
    Json(dto): Json<CreateMatchDto>,
) -> impl IntoResponse {
    if dto.player1.trim().is_empty() || dto.player2.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("player1 and player2 are required")),
        )
            .into_response();
    }

    match db::create(&state.pool, dto).await {
        Ok(m) => {
            broadcast(&state.ws_clients, WsEvent::MatchCreated { match_data: m.clone() }).await;
            (StatusCode::CREATED, Json(m)).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// PATCH /matches/:id
pub async fn update_score(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(dto): Json<UpdateScoreDto>,
) -> impl IntoResponse {
    match db::update_score(&state.pool, id, dto).await {
        Ok(Some(m)) => {
            broadcast(
                &state.ws_clients,
                WsEvent::ScoreUpdate {
                    match_id: m.id,
                    player1_score: m.player1_score,
                    player2_score: m.player2_score,
                },
            )
            .await;
            (StatusCode::OK, Json(m)).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new("Match not found")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// PATCH /matches/:id/setCurrent
pub async fn set_current(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match db::set_current(&state.pool, id).await {
        Ok(Some(m)) => {
            broadcast(
                &state.ws_clients,
                WsEvent::CurrentMatchChanged { match_data: Some(m.clone()) },
            )
            .await;
            (StatusCode::OK, Json(m)).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new("Match not found")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}

/// DELETE /matches/:id
pub async fn delete_match(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    match db::delete(&state.pool, id).await {
        Ok(true) => {
            broadcast(&state.ws_clients, WsEvent::MatchDeleted { id }).await;
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new("Match not found")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(e.to_string())),
        )
            .into_response(),
    }
}
