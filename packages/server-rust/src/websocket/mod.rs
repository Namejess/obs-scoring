pub mod events;

use crate::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;
use uuid::Uuid;

/// Handler WebSocket — upgrade HTTP → WS
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let client_id = Uuid::new_v4().to_string();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Enregistrer le client
    {
        let mut clients: tokio::sync::RwLockWriteGuard<
            HashMap<String, mpsc::UnboundedSender<Message>>,
        > = state.ws_clients.write().await;
        clients.insert(client_id.clone(), tx);
    }
    tracing::info!("WS client connected: {}", client_id);

    loop {
        tokio::select! {
            // Messages à envoyer au client
            Some(msg) = rx.recv() => {
                if socket.send(msg).await.is_err() {
                    break;
                }
            }
            // Messages reçus du client
            Some(result) = socket.recv() => {
                match result {
                    Ok(Message::Close(_)) | Err(_) => break,
                    Ok(Message::Ping(data)) => {
                        let _ = socket.send(Message::Pong(data)).await;
                    }
                    _ => {}
                }
            }
            else => break,
        }
    }

    // Nettoyage
    {
        let mut clients: tokio::sync::RwLockWriteGuard<
            HashMap<String, mpsc::UnboundedSender<Message>>,
        > = state.ws_clients.write().await;
        clients.remove(&client_id);
    }
    tracing::info!("WS client disconnected: {}", client_id);
}
