use crate::{services::polling::PollingHandles, websocket::events::WsClients};
use reqwest::Client;
use sqlx::SqlitePool;

/// État global partagé via Arc<AppState>
pub struct AppState {
    pub pool: SqlitePool,
    pub ws_clients: WsClients,
    pub http_client: Client,
    pub polling_handles: PollingHandles,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            ws_clients: WsClients::default(),
            http_client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            polling_handles: crate::services::polling::build_polling_handles(),
        }
    }
}
