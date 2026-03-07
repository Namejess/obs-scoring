pub mod matches;
pub mod startgg_sets;

use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::Path;
use tracing::info;

pub async fn create_pool(database_url: &str) -> Result<SqlitePool> {
    let path_str = database_url
        .trim_start_matches("sqlite:")
        .trim_start_matches("//");
    if let Some(parent) = Path::new(path_str).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(16)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(database_url)
        .await?;

    info!("Database pool created: {}", database_url);
    Ok(pool)
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    info!("Migrations applied successfully");
    Ok(())
}
