/**
 * Adaptateur pour convertir les données start.gg vers le format brackets-viewer.js
 *
 * start.gg utilise `entrant1Source/entrant2Source` (d'où vient le joueur)
 * brackets-viewer utilise `opponent1_id/opponent2_id` dans les matches
 *
 * Complexité: O(n) où n = nombre de sets
 */

import type { StartggSet } from '@/composables/useStartgg'
import type {
  Stage,
  Match,
  MatchGame,
  Participant,
  StageType,
  StageSettings,
  Status,
  Result,
} from 'brackets-model'

// Mapping des états start.gg vers brackets-model Status
const STATE_MAP: Record<number, Status> = {
  1: 0, // CREATED -> Locked (waiting)
  2: 2, // ACTIVE -> Running
  3: 4, // COMPLETED -> Completed
  4: 4, // BYE -> Completed (treated as completed)
  6: 2, // CALLED -> Running
  7: 1, // QUEUED -> Waiting
}

// Interface pour le résultat de la conversion
export interface BracketsViewerData {
  stages: Stage[]
  matches: Match[]
  matchGames: MatchGame[]
  participants: Participant[]
  matchIdToSetId: Map<number, string> // Mapping ID interne -> ID start.gg
}

/**
 * Convertit un tableau de sets start.gg vers le format brackets-viewer.js
 */
export function convertStartggToBracketsViewer(
  sets: StartggSet[],
  eventName: string = 'Tournament'
): BracketsViewerData {
  if (!sets || sets.length === 0) {
    return { stages: [], matches: [], matchGames: [], participants: [], matchIdToSetId: new Map() }
  }

  // 1. Extraire tous les participants uniques
  const participantMap = new Map<string, Participant>()
  let participantId = 1

  for (const set of sets) {
    const p1Key = formatPlayerKey(set.player1Tag, set.player1Prefix)
    const p2Key = formatPlayerKey(set.player2Tag, set.player2Prefix)

    if (p1Key && !participantMap.has(p1Key)) {
      participantMap.set(p1Key, {
        id: participantId++,
        tournament_id: 0,
        name: formatPlayerName(set.player1Tag, set.player1Prefix),
      })
    }

    if (p2Key && !participantMap.has(p2Key)) {
      participantMap.set(p2Key, {
        id: participantId++,
        tournament_id: 0,
        name: formatPlayerName(set.player2Tag, set.player2Prefix),
      })
    }
  }

  const participants = Array.from(participantMap.values())

  // 2. Séparer Winners et Losers brackets
  const winnersSets = sets.filter((s) => s.round > 0)
  const losersSets = sets.filter((s) => s.round < 0)

  // 3. Déterminer le type de stage
  const hasLosers = losersSets.length > 0
  const stageType: StageType = hasLosers ? 'double_elimination' : 'single_elimination'

  // 4. Créer le stage
  const stage: Stage = {
    id: 0,
    tournament_id: 0,
    name: eventName,
    type: stageType,
    number: 1,
    settings: {
      size: getNextPowerOfTwo(participantMap.size),
      grandFinal: hasLosers ? 'double' : undefined,
    } as StageSettings,
  }

  // 5. Convertir les sets en matches
  // brackets-viewer utilise des group_id: 0 = Winners, 1 = Losers
  const matches: Match[] = []
  const matchGames: MatchGame[] = []
  const matchIdToSetId = new Map<number, string>() // Mapping pour retrouver le set original

  let matchId = 0

  // Process Winners bracket
  const winnersRounds = [...new Set(winnersSets.map((s) => s.round))].sort((a, b) => a - b)

  for (const round of winnersRounds) {
    const roundSets = winnersSets.filter((s) => s.round === round)

    for (let i = 0; i < roundSets.length; i++) {
      const set = roundSets[i]
      if (!set) continue

      const match = createMatch(
        matchId,
        stage.id as number,
        0, // group_id = Winners
        round - 1, // round_id (0-indexed)
        i, // number in round
        set,
        participantMap
      )

      matches.push(match)

      // Stocker le mapping pour retrouver le set original
      matchIdToSetId.set(matchId, set.id)

      // Ajouter les games si le match est complété
      if (set.state === 3) {
        const games = createMatchGames(matchId, set)
        matchGames.push(...games)
      }

      matchId++
    }
  }

  // Process Losers bracket
  const losersRounds = [...new Set(losersSets.map((s) => s.round))].sort((a, b) => a - b)

  for (const round of losersRounds) {
    const roundSets = losersSets.filter((s) => s.round === round)

    for (let i = 0; i < roundSets.length; i++) {
      const set = roundSets[i]
      if (!set) continue

      const match = createMatch(
        matchId,
        stage.id as number,
        1, // group_id = Losers
        Math.abs(round) - 1, // round_id (0-indexed, positive)
        i, // number in round
        set,
        participantMap
      )

      matches.push(match)

      // Stocker le mapping pour retrouver le set original
      matchIdToSetId.set(matchId, set.id)

      if (set.state === 3) {
        const games = createMatchGames(matchId, set)
        matchGames.push(...games)
      }

      matchId++
    }
  }

  return {
    stages: [stage],
    matches,
    matchGames,
    participants,
    matchIdToSetId,
  }
}

/**
 * Crée un match brackets-viewer à partir d'un set start.gg
 */
function createMatch(
  id: number,
  stageId: number,
  groupId: number,
  roundId: number,
  numberInRound: number,
  set: StartggSet,
  participantMap: Map<string, Participant>
): Match {
  const p1Key = formatPlayerKey(set.player1Tag, set.player1Prefix)
  const p2Key = formatPlayerKey(set.player2Tag, set.player2Prefix)

  const p1 = p1Key ? participantMap.get(p1Key) : undefined
  const p2 = p2Key ? participantMap.get(p2Key) : undefined

  const status = STATE_MAP[set.state] ?? 0
  const isCompleted = set.state === 3

  // Déterminer le résultat si complété
  let p1Result: Result | undefined = undefined
  let p2Result: Result | undefined = undefined

  if (isCompleted && set.player1Score !== undefined && set.player2Score !== undefined) {
    if (set.player1Score > set.player2Score) {
      p1Result = 'win'
      p2Result = 'loss'
    } else if (set.player2Score > set.player1Score) {
      p1Result = 'loss'
      p2Result = 'win'
    } else {
      p1Result = 'draw'
      p2Result = 'draw'
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match: Match = {
    id,
    stage_id: stageId,
    group_id: groupId,
    round_id: roundId,
    number: numberInRound + 1,
    child_count: 0,
    status,
    opponent1: p1
      ? ({
          id: p1.id,
          score: set.player1Score ?? undefined,
          result: p1Result,
        } as Match['opponent1'])
      : null,
    opponent2: p2
      ? ({
          id: p2.id,
          score: set.player2Score ?? undefined,
          result: p2Result,
        } as Match['opponent2'])
      : null,
  }
  return match
}

/**
 * Crée les games pour un match
 */
function createMatchGames(matchId: number, set: StartggSet): MatchGame[] {
  // brackets-viewer peut afficher les games individuels
  // Pour l'instant, on crée un game unique avec le score final
  const p1Score = set.player1Score ?? 0
  const p2Score = set.player2Score ?? 0

  const game: MatchGame = {
    id: matchId,
    stage_id: 0,
    parent_id: matchId,
    number: 1,
    status: 4, // Completed
    opponent1: {
      id: null,
      score: p1Score,
      result: p1Score > p2Score ? 'win' : 'loss',
    },
    opponent2: {
      id: null,
      score: p2Score,
      result: p2Score > p1Score ? 'win' : 'loss',
    },
  }

  return [game]
}

/**
 * Formate le nom du joueur avec préfixe
 */
function formatPlayerName(tag: string, prefix: string | null): string {
  if (!tag) return 'TBD'
  return prefix ? `${prefix} | ${tag}` : tag
}

/**
 * Crée une clé unique pour un joueur
 */
function formatPlayerKey(tag: string, prefix: string | null): string | null {
  if (!tag) return null
  return prefix ? `${prefix}|${tag}` : tag
}

/**
 * Retourne la prochaine puissance de 2
 */
function getNextPowerOfTwo(n: number): number {
  let power = 1
  while (power < n) {
    power *= 2
  }
  return power
}
