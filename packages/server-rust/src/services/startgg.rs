use anyhow::{anyhow, Result};
use moka::future::Cache;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::{
    db::startgg_sets as db_sets,
    models::{StartggSet, StartggSetForBracket},
};

const API_URL: &str = "https://api.start.gg/gql/alpha";

// ─── GraphQL request/response envelope ───────────────────────────────────────

#[derive(Debug, Serialize)]
struct GqlRequest {
    query: String,
    variables: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct GqlResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GqlError>>,
}

#[derive(Debug, Deserialize)]
struct GqlError {
    message: String,
}

// ─── Domain structs for GraphQL responses ────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlTournament {
    pub id: i64,
    pub name: String,
    pub slug: Option<String>,
    pub start_at: Option<i64>,
    pub end_at: Option<i64>,
    pub num_attendees: Option<i64>,
    pub state: Option<i64>,
    pub images: Option<Vec<GqlImage>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlImage {
    pub url: String,
    pub ratio: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlEvent {
    pub id: i64,
    pub name: String,
    pub slug: Option<String>,
    pub state: Option<i64>,
    pub num_entrants: Option<i64>,
    #[serde(rename = "type")]
    pub event_type: Option<i64>,
    pub phases: Option<Vec<GqlPhase>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlPhase {
    pub id: i64,
    pub name: String,
    pub state: Option<i64>,
    pub bracket_type: Option<String>,
    pub phase_groups: Option<GqlPhaseGroupsPage>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GqlPhaseGroupsPage {
    pub nodes: Vec<GqlPhaseGroup>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlPhaseGroup {
    pub id: i64,
    pub display_identifier: Option<String>,
    pub state: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlPageInfo {
    pub total: Option<i64>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub total_pages: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlSet {
    pub id: Option<serde_json::Value>, // can be int or string
    pub identifier: Option<String>,
    pub full_round_text: Option<String>,
    pub round: Option<i64>,
    pub state: Option<i64>,
    pub winner_id: Option<i64>,
    pub total_games: Option<i64>,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub w_placement: Option<i64>,
    pub l_placement: Option<i64>,
    pub phase_group: Option<GqlSetPhaseGroup>,
    pub slots: Option<Vec<GqlSlot>>,
    pub event: Option<GqlSetEvent>,
    pub entrant1_source: Option<GqlEntrantSource>,
    pub entrant2_source: Option<GqlEntrantSource>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlSetPhaseGroup {
    pub id: i64,
    pub display_identifier: Option<String>,
    pub phase: Option<GqlSetPhase>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GqlSetPhase {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlSetEvent {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlEntrantSource {
    #[serde(rename = "type")]
    pub source_type: Option<String>,
    pub source_id: Option<i64>,
    pub condition: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GqlSlot {
    #[serde(rename = "slotIndex")]
    pub slot_index: Option<i64>,
    pub entrant: Option<GqlEntrant>,
    pub standing: Option<GqlStanding>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GqlEntrant {
    pub id: Option<i64>,
    pub name: Option<String>,
    pub participants: Option<Vec<GqlParticipant>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlParticipant {
    pub gamer_tag: Option<String>,
    pub prefix: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GqlStanding {
    pub stats: Option<GqlStats>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GqlStats {
    pub score: Option<GqlScore>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GqlScore {
    pub value: Option<f64>,
    pub display_value: Option<String>,
}

// ─── Typed response wrappers ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct TournamentsData {
    #[serde(rename = "currentUser")]
    current_user: Option<TournamentsUser>,
}

#[derive(Debug, Deserialize)]
struct TournamentsUser {
    tournaments: Option<TournamentNodes>,
}

#[derive(Debug, Deserialize)]
struct TournamentNodes {
    nodes: Vec<GqlTournament>,
}

#[derive(Debug, Deserialize)]
struct TournamentEventsData {
    tournament: Option<TournamentWithEvents>,
}

#[derive(Debug, Deserialize)]
struct TournamentWithEvents {
    events: Option<Vec<GqlEvent>>,
}

#[derive(Debug, Deserialize)]
struct EventSetsData {
    event: Option<EventWithSets>,
}

#[derive(Debug, Deserialize)]
struct EventWithSets {
    id: Option<i64>,
    name: Option<String>,
    sets: Option<SetsPage>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SetsPage {
    page_info: Option<GqlPageInfo>,
    nodes: Vec<GqlSet>,
}

#[derive(Debug, Deserialize)]
struct PhaseGroupSetsData {
    #[serde(rename = "phaseGroup")]
    phase_group: Option<PhaseGroupWithSets>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PhaseGroupWithSets {
    id: Option<i64>,
    display_identifier: Option<String>,
    phase: Option<GqlSetPhase>,
    sets: Option<SetsPage>,
}

#[derive(Debug, Deserialize)]
struct SetDetailData {
    set: Option<GqlSet>,
}

// ─── Output types for service public API ─────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventSetsResult {
    pub event_id: String,
    pub event_name: Option<String>,
    pub page_info: Option<GqlPageInfo>,
    pub sets: Vec<StartggSetForBracket>,
}

// ─── Cache type alias ─────────────────────────────────────────────────────────

pub type StartggCache = Cache<String, serde_json::Value>;

pub fn build_cache() -> StartggCache {
    Cache::builder()
        .max_capacity(512)
        .time_to_live(Duration::from_secs(300)) // default 5 min; entries override per TTL
        .build()
}

// ─── Core HTTP helper ─────────────────────────────────────────────────────────

pub async fn startgg_query<T: for<'de> Deserialize<'de>>(
    client: &Client,
    query: &str,
    variables: serde_json::Value,
    api_key: &str,
) -> Result<T> {
    let body = GqlRequest {
        query: query.to_string(),
        variables,
    };

    let mut attempts = 0u32;
    loop {
        let resp = client
            .post(API_URL)
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await?;

        // Handle rate limiting
        if resp.status() == 429 {
            let retry_after = resp
                .headers()
                .get("Retry-After")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(5);
            if attempts < 3 {
                attempts += 1;
                tokio::time::sleep(Duration::from_secs(retry_after)).await;
                continue;
            } else {
                return Err(anyhow!("Rate limited by start.gg after {} retries", attempts));
            }
        }

        let gql_resp = resp.json::<GqlResponse<T>>().await?;

        if let Some(errors) = gql_resp.errors {
            if !errors.is_empty() {
                return Err(anyhow!(
                    "GraphQL error: {}",
                    errors.iter().map(|e| e.message.as_str()).collect::<Vec<_>>().join(", ")
                ));
            }
        }

        return gql_resp.data.ok_or_else(|| anyhow!("No data in GraphQL response"));
    }
}

// ─── GraphQL queries ──────────────────────────────────────────────────────────

const TOURNAMENTS_QUERY: &str = r#"
query TournamentsQuery($perPage: Int!, $upcoming: Boolean) {
  currentUser {
    tournaments(query: {
      perPage: $perPage
      filter: { upcoming: $upcoming }
    }) {
      nodes {
        id name slug startAt endAt numAttendees state
        images { url ratio }
      }
    }
  }
}"#;

const TOURNAMENT_EVENTS_QUERY: &str = r#"
query TournamentEventsQuery($slug: String!) {
  tournament(slug: $slug) {
    events {
      id name slug state numEntrants type
      phases {
        id name state bracketType
        phaseGroups { nodes { id displayIdentifier state } }
      }
    }
  }
}"#;

const EVENT_SETS_QUERY: &str = r#"
query EventSetsQuery($eventId: ID!, $page: Int!, $perPage: Int!, $state: [Int]) {
  event(id: $eventId) {
    id name
    sets(page: $page, perPage: $perPage, filters: { state: $state }) {
      pageInfo { total page perPage totalPages }
      nodes {
        id identifier fullRoundText round state winnerId totalGames
        startedAt completedAt wPlacement lPlacement
        entrant1Source { type sourceId condition }
        entrant2Source { type sourceId condition }
        phaseGroup { id displayIdentifier phase { id name } }
        slots {
          slotIndex
          entrant { id name participants { gamerTag prefix } }
          standing { stats { score { value displayValue } } }
        }
      }
    }
  }
}"#;

const PHASE_GROUP_SETS_QUERY: &str = r#"
query PhaseGroupSetsQuery($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
  phaseGroup(id: $phaseGroupId) {
    id displayIdentifier
    phase { id name }
    sets(page: $page, perPage: $perPage) {
      pageInfo { total page perPage totalPages }
      nodes {
        id identifier fullRoundText round state winnerId totalGames
        startedAt completedAt wPlacement lPlacement
        phaseGroup { id displayIdentifier phase { id name } }
        slots {
          slotIndex
          entrant { id name participants { gamerTag prefix } }
          standing { stats { score { value displayValue } } }
        }
      }
    }
  }
}"#;

const SET_DETAIL_QUERY: &str = r#"
query SetDetailQuery($setId: ID!) {
  set(id: $setId) {
    id identifier fullRoundText round state winnerId totalGames
    startedAt completedAt
    event { id name }
    phaseGroup { id displayIdentifier phase { id name } }
    slots {
      slotIndex
      entrant { id name participants { gamerTag prefix } }
      standing { stats { score { value displayValue } } }
    }
  }
}"#;

// ─── Mappers ──────────────────────────────────────────────────────────────────

fn set_id_to_string(id: &serde_json::Value) -> String {
    match id {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        _ => id.to_string(),
    }
}

fn extract_player(slot: &GqlSlot) -> (String, Option<String>) {
    let participant = slot
        .entrant
        .as_ref()
        .and_then(|e| e.participants.as_ref())
        .and_then(|p| p.first());

    let tag = participant
        .and_then(|p| p.gamer_tag.clone())
        .or_else(|| slot.entrant.as_ref().and_then(|e| e.name.clone()))
        .unwrap_or_else(|| "TBD".to_string());

    let prefix = participant.and_then(|p| p.prefix.clone()).filter(|p| !p.is_empty());

    (tag, prefix)
}

fn extract_score(slot: &GqlSlot) -> i64 {
    slot.standing
        .as_ref()
        .and_then(|s| s.stats.as_ref())
        .and_then(|s| s.score.as_ref())
        .and_then(|s| s.value)
        .map(|v| v as i64)
        .unwrap_or(0)
}

fn extract_phase_info(set: &GqlSet) -> (i64, Option<String>, i64, Option<String>) {
    let phase_id = set
        .phase_group
        .as_ref()
        .and_then(|pg| pg.phase.as_ref())
        .map(|p| p.id)
        .unwrap_or(0);
    let phase_name = set
        .phase_group
        .as_ref()
        .and_then(|pg| pg.phase.as_ref())
        .map(|p| p.name.clone());
    let phase_group_id = set
        .phase_group
        .as_ref()
        .map(|pg| pg.id)
        .unwrap_or(0);
    let _phase_group_identifier = set
        .phase_group
        .as_ref()
        .and_then(|pg| pg.display_identifier.clone());
    (phase_id, phase_name, phase_group_id, _phase_group_identifier)
}

pub fn map_set_to_db(set: &GqlSet, event_id: &str, event_name: Option<&str>) -> Option<StartggSet> {
    let id = set.id.as_ref().map(set_id_to_string)?;
    let slots = set.slots.as_deref().unwrap_or(&[]);

    // slot0 = player1, slot1 = player2
    let slot0 = slots.iter().find(|s| s.slot_index == Some(0));
    let slot1 = slots.iter().find(|s| s.slot_index == Some(1));

    let (player1_tag, player1_prefix) = slot0.map(extract_player).unwrap_or_else(|| ("TBD".to_string(), None));
    let (player2_tag, player2_prefix) = slot1.map(extract_player).unwrap_or_else(|| ("TBD".to_string(), None));
    let player1_score = slot0.map(extract_score).unwrap_or(0);
    let player2_score = slot1.map(extract_score).unwrap_or(0);

    let (phase_id, phase_name, phase_group_id, _) = extract_phase_info(set);

    Some(StartggSet {
        id,
        event_id: event_id.to_string(),
        event_name: event_name.map(str::to_string),
        phase_id,
        phase_name,
        phase_group_id,
        full_round_text: set.full_round_text.clone().unwrap_or_default(),
        identifier: set.identifier.clone(),
        round: set.round.unwrap_or(0),
        state: set.state.unwrap_or(0),
        best_of: set.total_games.unwrap_or(3),
        player1_tag,
        player1_prefix,
        player1_score,
        player2_tag,
        player2_prefix,
        player2_score,
        winner_id: set.winner_id.map(|w| w.to_string()),
        started_at: set.started_at.and_then(|t| {
            chrono::DateTime::from_timestamp(t, 0)
        }),
        completed_at: set.completed_at.and_then(|t| {
            chrono::DateTime::from_timestamp(t, 0)
        }),
        updated_at: chrono::Utc::now(),
    })
}

pub fn map_set_for_bracket(set: &GqlSet, event_id: &str, event_name: Option<&str>) -> Option<StartggSetForBracket> {
    let base = map_set_to_db(set, event_id, event_name)?;
    Some(StartggSetForBracket {
        set: base,
        w_placement: set.w_placement,
        l_placement: set.l_placement,
        entrant1_source: set.entrant1_source.as_ref().map(|s| serde_json::json!({
            "type": s.source_type,
            "sourceId": s.source_id,
            "condition": s.condition,
        })),
        entrant2_source: set.entrant2_source.as_ref().map(|s| serde_json::json!({
            "type": s.source_type,
            "sourceId": s.source_id,
            "condition": s.condition,
        })),
    })
}

// ─── Service functions ────────────────────────────────────────────────────────

pub async fn get_my_tournaments(client: &Client, api_key: &str) -> Result<Vec<GqlTournament>> {
    let (past_result, upcoming_result) = tokio::join!(
        startgg_query::<TournamentsData>(
            client,
            TOURNAMENTS_QUERY,
            serde_json::json!({ "perPage": 20, "upcoming": false }),
            api_key,
        ),
        startgg_query::<TournamentsData>(
            client,
            TOURNAMENTS_QUERY,
            serde_json::json!({ "perPage": 20, "upcoming": true }),
            api_key,
        ),
    );

    let mut seen = std::collections::HashSet::new();
    let mut all: Vec<GqlTournament> = Vec::new();

    for result in [past_result, upcoming_result] {
        if let Ok(data) = result {
            if let Some(user) = data.current_user {
                if let Some(t) = user.tournaments {
                    for tournament in t.nodes {
                        if seen.insert(tournament.id) {
                            all.push(tournament);
                        }
                    }
                }
            }
        }
    }

    // Sort by startAt desc (most recent first)
    all.sort_by(|a, b| b.start_at.unwrap_or(0).cmp(&a.start_at.unwrap_or(0)));
    Ok(all)
}

pub async fn get_tournament_events(client: &Client, api_key: &str, slug: &str) -> Result<Vec<GqlEvent>> {
    // Normalize: strip "tournament/" prefix if present
    let normalized = slug.strip_prefix("tournament/").unwrap_or(slug);

    let data = startgg_query::<TournamentEventsData>(
        client,
        TOURNAMENT_EVENTS_QUERY,
        serde_json::json!({ "slug": normalized }),
        api_key,
    )
    .await?;

    data.tournament
        .and_then(|t| t.events)
        .ok_or_else(|| anyhow!("Tournament not found or has no events"))
}

pub struct GetSetsOptions {
    pub page: i64,
    pub per_page: i64,
    pub states: Option<Vec<i64>>,
}

impl Default for GetSetsOptions {
    fn default() -> Self {
        Self { page: 1, per_page: 30, states: None }
    }
}

pub async fn get_event_sets(
    client: &Client,
    api_key: &str,
    pool: &sqlx::SqlitePool,
    event_id: &str,
    opts: GetSetsOptions,
) -> Result<EventSetsResult> {
    let data = startgg_query::<EventSetsData>(
        client,
        EVENT_SETS_QUERY,
        serde_json::json!({
            "eventId": event_id,
            "page": opts.page,
            "perPage": opts.per_page,
            "state": opts.states,
        }),
        api_key,
    )
    .await?;

    let event = data.event.ok_or_else(|| anyhow!("Event not found"))?;
    let event_name = event.name.clone();
    let page_info = event.sets.as_ref().and_then(|s| s.page_info.clone());
    let raw_sets = event.sets.map(|s| s.nodes).unwrap_or_default();
    let event_id_str = event.id.map(|i| i.to_string()).unwrap_or_else(|| event_id.to_string());

    // Map to DB models and upsert
    let db_sets: Vec<StartggSet> = raw_sets
        .iter()
        .filter_map(|s| map_set_to_db(s, &event_id_str, event_name.as_deref()))
        .collect();

    if !db_sets.is_empty() {
        db_sets::upsert_batch(pool, &db_sets).await?;
    }

    // Map to bracket format for response
    let bracket_sets: Vec<StartggSetForBracket> = raw_sets
        .iter()
        .filter_map(|s| map_set_for_bracket(s, &event_id_str, event_name.as_deref()))
        .collect();

    Ok(EventSetsResult {
        event_id: event_id_str,
        event_name,
        page_info,
        sets: bracket_sets,
    })
}

pub async fn get_active_sets(
    client: &Client,
    api_key: &str,
    pool: &sqlx::SqlitePool,
    event_id: &str,
) -> Result<EventSetsResult> {
    get_event_sets(
        client,
        api_key,
        pool,
        event_id,
        GetSetsOptions { page: 1, per_page: 20, states: Some(vec![2, 6]) },
    )
    .await
}

pub async fn get_phase_group_sets(
    client: &Client,
    api_key: &str,
    phase_group_id: &str,
    page: i64,
    per_page: i64,
) -> Result<serde_json::Value> {
    let data = startgg_query::<PhaseGroupSetsData>(
        client,
        PHASE_GROUP_SETS_QUERY,
        serde_json::json!({
            "phaseGroupId": phase_group_id,
            "page": page,
            "perPage": per_page,
        }),
        api_key,
    )
    .await?;

    Ok(serde_json::to_value(data.phase_group)?)
}

pub async fn get_set_detail(client: &Client, api_key: &str, set_id: &str) -> Result<GqlSet> {
    let data = startgg_query::<SetDetailData>(
        client,
        SET_DETAIL_QUERY,
        serde_json::json!({ "setId": set_id }),
        api_key,
    )
    .await?;

    data.set.ok_or_else(|| anyhow!("Set not found"))
}
