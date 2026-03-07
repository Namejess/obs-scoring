mod db;
mod models;
mod routes;
mod services;
mod state;
mod websocket;

use crate::state::AppState;
use anyhow::Result;
use dotenvy::dotenv;
use std::{env, net::SocketAddr, sync::Arc};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    // Charger .env si présent
    dotenv().ok();

    // Logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "obs_scoring_server=info,tower_http=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Configuration
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./data/obs_scoring.db".to_string());
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "3002".to_string())
        .parse()
        .expect("PORT must be a valid port number");

    tracing::info!("Starting obs-scoring-server-rust on port {}", port);

    // Database
    let pool = db::create_pool(&database_url).await?;
    db::run_migrations(&pool).await?;

    // State partagé
    let state = Arc::new(AppState::new(pool));

    // Router Axum
    let app = routes::create_router(state);

    // Démarrage du serveur
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Listening on http://{}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}
