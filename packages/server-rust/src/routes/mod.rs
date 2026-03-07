pub mod matches;
pub mod startgg;

use crate::state::AppState;
use axum::{
    routing::{get, patch, post, put},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

pub fn create_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health
        .route("/health", get(health_handler))
        // Matches REST
        .route("/matches", get(matches::list_matches).post(matches::create_match))
        .route("/matches/current", get(matches::get_current_match))
        .route("/matches/obsData", get(matches::get_obs_data))
        .route(
            "/matches/:id",
            get(matches::get_match)
                .patch(matches::update_score)
                .delete(matches::delete_match),
        )
        .route("/matches/:id/setCurrent", patch(matches::set_current))
        // start.gg — config & local cache
        .route("/api/startgg/config", get(startgg::get_config).put(startgg::put_config))
        .route("/api/startgg/local-sets", get(startgg::get_local_sets))
        // start.gg — proxy GraphQL
        .route("/api/startgg/tournaments", get(startgg::get_tournaments))
        .route("/api/startgg/tournaments/:slug/events", get(startgg::get_tournament_events))
        .route("/api/startgg/events/:event_id/sets", get(startgg::get_event_sets))
        .route("/api/startgg/events/:event_id/active", get(startgg::get_active_sets))
        .route("/api/startgg/sets/:set_id", get(startgg::get_set_detail))
        // start.gg — select set (cache + fallback GraphQL)
        .route("/api/startgg/sets/:set_id/select", post(startgg::select_set_with_fallback))
        // start.gg — polling control
        .route("/api/startgg/poll/start", post(startgg::poll_start))
        .route("/api/startgg/poll/stop", post(startgg::poll_stop))
        .route("/api/startgg/poll/status", get(startgg::poll_status))
        // WebSocket
        .route("/ws", get(crate::websocket::ws_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "name": "obs-scoring-server-rust",
        "version": env!("CARGO_PKG_VERSION"),
        "status": "ok",
        "runtime": "axum/tokio"
    }))
}
