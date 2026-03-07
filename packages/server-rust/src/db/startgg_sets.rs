use crate::models::StartggSet;
use anyhow::Result;
use sqlx::SqlitePool;

const SELECT_SET: &str = r#"
    SELECT id, event_id, event_name, phase_id, phase_name, phase_group_id,
           full_round_text, identifier, round, state, best_of,
           player1_tag, player2_tag, player1_prefix, player2_prefix,
           player1_score, player2_score, winner_id,
           started_at, completed_at, updated_at
    FROM startgg_sets
"#;

pub async fn upsert_batch(pool: &SqlitePool, sets: &[StartggSet]) -> Result<()> {
    if sets.is_empty() { return Ok(()); }

    let mut tx = pool.begin().await?;
    for set in sets {
        sqlx::query(r#"
            INSERT INTO startgg_sets (
                id, event_id, event_name, phase_id, phase_name, phase_group_id,
                full_round_text, identifier, round, state, best_of,
                player1_tag, player2_tag, player1_prefix, player2_prefix,
                player1_score, player2_score, winner_id,
                started_at, completed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                state = excluded.state,
                player1_score = excluded.player1_score,
                player2_score = excluded.player2_score,
                winner_id = excluded.winner_id,
                completed_at = excluded.completed_at,
                updated_at = excluded.updated_at
        "#)
        .bind(&set.id).bind(&set.event_id).bind(&set.event_name)
        .bind(&set.phase_id).bind(&set.phase_name).bind(&set.phase_group_id)
        .bind(&set.full_round_text).bind(&set.identifier)
        .bind(set.round).bind(set.state).bind(set.best_of)
        .bind(&set.player1_tag).bind(&set.player2_tag)
        .bind(&set.player1_prefix).bind(&set.player2_prefix)
        .bind(set.player1_score).bind(set.player2_score)
        .bind(&set.winner_id).bind(set.started_at).bind(set.completed_at)
        .bind(set.updated_at)
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn find_by_event(pool: &SqlitePool, event_id: &str, states: Option<&[i64]>) -> Result<Vec<StartggSet>> {
    let sets = match states {
        None => {
            sqlx::query_as::<_, StartggSet>(&format!(
                "{} WHERE event_id = ? ORDER BY state ASC, round ASC", SELECT_SET
            ))
            .bind(event_id)
            .fetch_all(pool).await?
        }
        Some(s) => {
            // Construire IN (?,?,...) dynamiquement
            let placeholders = s.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "{} WHERE event_id = ? AND state IN ({}) ORDER BY state ASC, round ASC",
                SELECT_SET, placeholders
            );
            let mut q = sqlx::query_as::<_, StartggSet>(&sql).bind(event_id);
            for state in s { q = q.bind(*state); }
            q.fetch_all(pool).await?
        }
    };
    Ok(sets)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<StartggSet>> {
    let set = sqlx::query_as::<_, StartggSet>(&format!("{} WHERE id = ?", SELECT_SET))
        .bind(id)
        .fetch_optional(pool).await?;
    Ok(set)
}
