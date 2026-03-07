use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time;
use tracing::{debug, error, info};

use crate::{
    services::startgg as svc,
    state::AppState,
    websocket::events::{broadcast, WsEvent},
};

// ─── Polling registry ─────────────────────────────────────────────────────────
// Tracks active polling tasks keyed by event_id

pub type PollingHandles = Arc<RwLock<HashMap<String, JoinHandle<()>>>>;

pub fn build_polling_handles() -> PollingHandles {
    Arc::new(RwLock::new(HashMap::new()))
}

// ─── Hash of a set's mutable fields for change detection ─────────────────────

fn set_hash(s: &crate::models::StartggSet) -> String {
    format!("{}:{}:{}:{}", s.id, s.state, s.player1_score, s.player2_score)
}

// ─── Core polling loop ────────────────────────────────────────────────────────

pub async fn start_polling(
    state: Arc<AppState>,
    handles: PollingHandles,
    event_id: String,
    interval_ms: u64,
) {
    // Cancel any existing task for this event
    {
        let mut map = handles.write().await;
        if let Some(old) = map.remove(&event_id) {
            old.abort();
        }
    }

    let state_clone = state.clone();
    let event_id_clone = event_id.clone();

    let handle = tokio::spawn(async move {
        info!("Polling started for event_id={} interval={}ms", event_id_clone, interval_ms);
        let mut interval = time::interval(Duration::from_millis(interval_ms));
        // prev_hashes: set_id -> hash string
        let mut prev_hashes: HashMap<String, String> = HashMap::new();

        loop {
            interval.tick().await;

            let api_key = match fetch_api_key(&state_clone).await {
                Some(k) => k,
                None => {
                    debug!("No API key configured, skipping poll for event {}", event_id_clone);
                    continue;
                }
            };

            match svc::get_active_sets(
                &state_clone.http_client,
                &api_key,
                &state_clone.pool,
                &event_id_clone,
            )
            .await
            {
                Ok(result) => {
                    let mut changed = false;
                    let mut new_hashes: HashMap<String, String> = HashMap::new();

                    for bracket_set in &result.sets {
                        let set = &bracket_set.set;
                        let hash = set_hash(set);
                        new_hashes.insert(set.id.clone(), hash.clone());

                        if prev_hashes.get(&set.id).map(|h| h != &hash).unwrap_or(true) {
                            changed = true;
                        }
                    }

                    if changed {
                        debug!(
                            "Poll detected changes for event {}, broadcasting {} sets",
                            event_id_clone,
                            result.sets.len()
                        );

                        let sets_json: Vec<serde_json::Value> = result
                            .sets
                            .iter()
                            .map(|s| serde_json::to_value(s).unwrap_or(serde_json::Value::Null))
                            .collect();

                        broadcast(
                            &state_clone.ws_clients,
                            WsEvent::StartggSetsUpdated { sets: sets_json },
                        )
                        .await;
                    }

                    prev_hashes = new_hashes;
                }
                Err(e) => {
                    error!("Poll error for event {}: {}", event_id_clone, e);
                }
            }
        }
    });

    {
        let mut map = handles.write().await;
        map.insert(event_id, handle);
    }
}

pub async fn stop_polling(handles: &PollingHandles, event_id: &str) -> bool {
    let mut map = handles.write().await;
    if let Some(handle) = map.remove(event_id) {
        handle.abort();
        info!("Polling stopped for event_id={}", event_id);
        true
    } else {
        false
    }
}

pub async fn stop_all_polling(handles: &PollingHandles) {
    let mut map = handles.write().await;
    for (event_id, handle) in map.drain() {
        handle.abort();
        info!("Polling stopped for event_id={}", event_id);
    }
}

// ─── Helper: read api_key from DB ─────────────────────────────────────────────

async fn fetch_api_key(state: &AppState) -> Option<String> {
    sqlx::query_scalar!(
        r#"SELECT api_key FROM startgg_config WHERE id = 1 AND enabled = 1"#
    )
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten()
    .filter(|k: &String| !k.is_empty())
}
