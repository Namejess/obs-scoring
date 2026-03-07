use crate::models::{CreateMatchDto, Match, OBSOverlayData, OBSPlayerData, UpdateScoreDto};
use anyhow::Result;
use sqlx::SqlitePool;

const SELECT_MATCH: &str = r#"
    SELECT id, player1, player2, team1, team2,
           player1_score, player2_score, is_current,
           created_at, startgg_set_id
    FROM matches
"#;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Match>> {
    let matches = sqlx::query_as::<_, Match>(&format!(
        "{} ORDER BY created_at DESC, id DESC",
        SELECT_MATCH
    ))
    .fetch_all(pool)
    .await?;
    Ok(matches)
}

pub async fn find_by_id(pool: &SqlitePool, id: i64) -> Result<Option<Match>> {
    let m = sqlx::query_as::<_, Match>(&format!("{} WHERE id = ?", SELECT_MATCH))
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(m)
}

pub async fn find_current(pool: &SqlitePool) -> Result<Option<Match>> {
    let m = sqlx::query_as::<_, Match>(&format!("{} WHERE is_current = 1 LIMIT 1", SELECT_MATCH))
        .fetch_optional(pool)
        .await?;
    Ok(m)
}

pub async fn get_obs_data(pool: &SqlitePool) -> Result<OBSOverlayData> {
    match find_current(pool).await? {
        Some(m) => Ok(OBSOverlayData {
            players: vec![
                OBSPlayerData { name: m.player1, team: m.team1, score: m.player1_score },
                OBSPlayerData { name: m.player2, team: m.team2, score: m.player2_score },
            ],
            match_id: Some(m.id),
        }),
        None => Ok(OBSOverlayData { players: vec![], match_id: None }),
    }
}

pub async fn create(pool: &SqlitePool, dto: CreateMatchDto) -> Result<Match> {
    let result = sqlx::query(
        "INSERT INTO matches (player1, player2, team1, team2) VALUES (?, ?, ?, ?)",
    )
    .bind(&dto.player1)
    .bind(&dto.player2)
    .bind(&dto.team1)
    .bind(&dto.team2)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();
    find_by_id(pool, id).await?.ok_or_else(|| anyhow::anyhow!("match just inserted not found"))
}

pub async fn update_score(pool: &SqlitePool, id: i64, dto: UpdateScoreDto) -> Result<Option<Match>> {
    let rows = sqlx::query(
        "UPDATE matches SET player1_score = ?, player2_score = ? WHERE id = ?",
    )
    .bind(dto.player1_score)
    .bind(dto.player2_score)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 { return Ok(None); }
    find_by_id(pool, id).await
}

pub async fn set_current(pool: &SqlitePool, id: i64) -> Result<Option<Match>> {
    if find_by_id(pool, id).await?.is_none() {
        return Ok(None);
    }

    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE matches SET is_current = 0 WHERE is_current = 1")
        .execute(&mut *tx).await?;
    sqlx::query("UPDATE matches SET is_current = 1 WHERE id = ?")
        .bind(id).execute(&mut *tx).await?;
    tx.commit().await?;

    find_by_id(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<bool> {
    let rows = sqlx::query("DELETE FROM matches WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}
