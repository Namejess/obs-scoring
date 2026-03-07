use crate::models::Match;
use axum::extract::ws::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

/// Événements WebSocket (compatible avec les noms Socket.io côté client Vue/mobile)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum WsEvent {
    #[serde(rename = "scoreUpdate")]
    ScoreUpdate {
        #[serde(rename = "matchId")]
        match_id: i64,
        #[serde(rename = "player1Score")]
        player1_score: i64,
        #[serde(rename = "player2Score")]
        player2_score: i64,
    },
    #[serde(rename = "matchCreated")]
    MatchCreated {
        #[serde(rename = "match")]
        match_data: Match,
    },
    #[serde(rename = "matchDeleted")]
    MatchDeleted { id: i64 },
    #[serde(rename = "currentMatchChanged")]
    CurrentMatchChanged {
        #[serde(rename = "match")]
        match_data: Option<Match>,
    },
    #[serde(rename = "startggSetsUpdated")]
    StartggSetsUpdated { sets: Vec<serde_json::Value> },
}

/// Type pour stocker les clients WebSocket connectés
pub type WsClients = Arc<RwLock<HashMap<String, mpsc::UnboundedSender<Message>>>>;

/// Broadcast un événement à tous les clients connectés
pub async fn broadcast(clients: &WsClients, event: WsEvent) {
    let payload = match serde_json::to_string(&event) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to serialize WsEvent: {}", e);
            return;
        }
    };

    let msg = Message::Text(payload);
    let readers = clients.read().await;
    let mut dead_clients: Vec<String> = Vec::new();

    for (id, tx) in readers.iter() {
        if tx.send(msg.clone()).is_err() {
            dead_clients.push(id.clone());
        }
    }
    drop(readers);

    if !dead_clients.is_empty() {
        let mut writers = clients.write().await;
        for id in dead_clients {
            writers.remove(&id);
        }
    }
}
