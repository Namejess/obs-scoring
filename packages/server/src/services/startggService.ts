import { prisma } from '../lib/prisma.js'

const STARTGG_API = 'https://api.start.gg/gql/alpha'

// Types pour les réponses GraphQL
interface StartggSlot {
  slotIndex: number
  entrant: {
    id: string
    name: string
    participants: Array<{
      gamerTag: string
      prefix: string | null
    }>
  } | null
  standing: {
    stats: {
      score: {
        value: number | null
        displayValue: string | null
      } | null
    } | null
  } | null
}

interface StartggSetData {
  id: string
  identifier: string
  fullRoundText: string
  round: number
  state: number
  winnerId: string | null
  totalGames: number
  startedAt: number | null
  completedAt: number | null
  wPlacement: number | null
  lPlacement: number | null
  slots: StartggSlot[]
  entrant1Source: {
    type: string | null
    typeId: string | null
    condition: string | null
  } | null
  entrant2Source: {
    type: string | null
    typeId: string | null
    condition: string | null
  } | null
  phaseGroup: {
    id: string
    displayIdentifier: string
    phase: {
      id: string
      name: string
    }
  }
  event?: {
    id: string
    name: string
  }
}

interface StartggTournament {
  id: string
  name: string
  slug: string
  startAt: number
  endAt: number
  state: number
  numAttendees: number
  isOnline: boolean
  city: string | null
  countryCode: string | null
  events: Array<{
    id: string
    name: string
    state: number
    numEntrants: number
  }>
}

interface StartggEvent {
  id: string
  name: string
  slug: string
  state: number
  numEntrants: number
  type: number
  phases: Array<{
    id: string
    name: string
    state: number
    bracketType: string
    phaseGroups: {
      nodes: Array<{
        id: string
        displayIdentifier: string
        state: number
      }>
    }
  }>
}

// Client GraphQL générique
async function startggQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  apiKey: string
): Promise<T> {
  const res = await fetch(STARTGG_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 60)
    console.warn(`[startgg] Rate limited, retrying in ${retryAfter}s`)
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    return startggQuery(query, variables, apiKey)
  }

  if (!res.ok) {
    throw new Error(`[startgg] HTTP ${res.status}: ${res.statusText}`)
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors && json.errors.length > 0) {
    throw new Error(`[startgg] ${json.errors[0]?.message ?? 'Unknown error'}`)
  }
  if (!json.data) {
    throw new Error('[startgg] No data in response')
  }
  return json.data
}

// ========== QUERIES ==========

const TOURNAMENTS_QUERY = `
query UserTournaments($perPage: Int!, $upcoming: Boolean) {
  currentUser {
    id
    slug
    tournaments(query: {
      perPage: $perPage
      filter: { tournamentView: "admin", upcoming: $upcoming }
    }) {
      nodes {
        id
        name
        slug
        startAt
        endAt
        state
        numAttendees
        isOnline
        city
        countryCode
        events {
          id
          name
          state
          numEntrants
        }
      }
    }
  }
}
`

const TOURNAMENT_EVENTS_QUERY = `
query TournamentEvents($slug: String!) {
  tournament(slug: $slug) {
    id
    name
    slug
    events {
      id
      name
      slug
      state
      numEntrants
      type
      phases {
        id
        name
        state
        bracketType
        phaseGroups(query: { perPage: 50 }) {
          nodes {
            id
            displayIdentifier
            state
          }
        }
      }
    }
  }
}
`

const EVENT_SETS_QUERY = `
query EventSets($eventId: ID!, $page: Int!, $perPage: Int!, $state: [Int]) {
  event(id: $eventId) {
    id
    name
    sets(
      page: $page
      perPage: $perPage
      sortType: CALL_ORDER
      filters: { state: $state }
    ) {
      pageInfo { total page perPage totalPages }
      nodes {
        id
        identifier
        fullRoundText
        round
        state
        winnerId
        totalGames
        startedAt
        completedAt
        wPlacement
        lPlacement
        entrant1Source {
          type
          typeId
          condition
        }
        entrant2Source {
          type
          typeId
          condition
        }
        phaseGroup {
          id
          displayIdentifier
          phase { id name }
        }
        slots {
          slotIndex
          entrant {
            id
            name
            participants { gamerTag prefix }
          }
          standing {
            stats { score { value displayValue } }
          }
        }
      }
    }
  }
}
`

const PHASE_GROUP_SETS_QUERY = `
query PhaseGroupSets($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
  phaseGroup(id: $phaseGroupId) {
    id
    displayIdentifier
    phase { id name }
    sets(page: $page, perPage: $perPage, sortType: STANDARD) {
      pageInfo { total page perPage totalPages }
      nodes {
        id
        identifier
        fullRoundText
        round
        state
        winnerId
        totalGames
        startedAt
        completedAt
        wPlacement
        lPlacement
        slots {
          slotIndex
          entrant {
            id
            name
            participants { gamerTag prefix }
          }
          standing {
            stats { score { value displayValue } }
          }
        }
        entrant1Source {
          type
          typeId
          condition
        }
        entrant2Source {
          type
          typeId
          condition
        }
      }
    }
  }
}
`

const SET_DETAIL_QUERY = `
query SetDetail($setId: ID!) {
  set(id: $setId) {
    id
    identifier
    fullRoundText
    round
    state
    winnerId
    totalGames
    startedAt
    completedAt
    event { id name }
    phaseGroup {
      id
      displayIdentifier
      phase { id name }
    }
    slots {
      slotIndex
      entrant {
        id
        name
        participants { gamerTag prefix }
      }
      standing {
        stats { score { value displayValue } }
      }
    }
  }
}
`

// ========== SERVICE ==========

function getApiKey(): string {
  const key = process.env.STARTGG
  if (!key) {
    throw new Error('STARTGG API key not configured')
  }
  return key
}

function mapSetToDb(set: StartggSetData, eventId: string, eventName?: string) {
  const slot0 = set.slots.find((s) => s.slotIndex === 0)
  const slot1 = set.slots.find((s) => s.slotIndex === 1)

  const player1 = slot0?.entrant?.participants?.[0]
  const player2 = slot1?.entrant?.participants?.[0]

  return {
    id: String(set.id),
    eventId: String(eventId),
    eventName: eventName ?? set.event?.name ?? null,
    phaseId: String(set.phaseGroup.phase.id),
    phaseName: set.phaseGroup.phase.name,
    phaseGroupId: String(set.phaseGroup.id),
    fullRoundText: set.fullRoundText ?? set.identifier ?? 'Unknown',
    identifier: set.identifier,
    round: set.round,
    state: set.state,
    bestOf: set.totalGames ?? 3,
    player1Tag: player1?.gamerTag ?? 'TBD',
    player2Tag: player2?.gamerTag ?? 'TBD',
    player1Prefix: player1?.prefix ?? null,
    player2Prefix: player2?.prefix ?? null,
    player1Score: slot0?.standing?.stats?.score?.value ?? 0,
    player2Score: slot1?.standing?.stats?.score?.value ?? 0,
    winnerId: set.winnerId ? String(set.winnerId) : null,
    startedAt: set.startedAt ? new Date(set.startedAt * 1000) : null,
    completedAt: set.completedAt ? new Date(set.completedAt * 1000) : null,
  }
}

// Version enrichie pour le bracket viewer (inclut les sources des entrants)
function mapSetForBracket(set: StartggSetData, eventId: string, eventName?: string) {
  const base = mapSetToDb(set, eventId, eventName)
  return {
    ...base,
    wPlacement: set.wPlacement ?? null,
    lPlacement: set.lPlacement ?? null,
    // Sources pour construire l'arbre du bracket
    entrant1Source: set.entrant1Source
      ? {
          type: set.entrant1Source.type,
          sourceId: set.entrant1Source.typeId ? String(set.entrant1Source.typeId) : null,
          condition: set.entrant1Source.condition,
        }
      : null,
    entrant2Source: set.entrant2Source
      ? {
          type: set.entrant2Source.type,
          sourceId: set.entrant2Source.typeId ? String(set.entrant2Source.typeId) : null,
          condition: set.entrant2Source.condition,
        }
      : null,
  }
}

export const startggService = {
  // Récupère les tournois où l'user est admin (passés + futurs) - PARALLÉLISÉ
  async getMyTournaments(): Promise<StartggTournament[]> {
    const apiKey = getApiKey()

    // Fetch past and upcoming tournaments IN PARALLEL
    const [pastData, upcomingData] = await Promise.all([
      startggQuery<{
        currentUser: {
          tournaments: { nodes: StartggTournament[] }
        } | null
      }>(TOURNAMENTS_QUERY, { perPage: 25, upcoming: false }, apiKey),
      startggQuery<{
        currentUser: {
          tournaments: { nodes: StartggTournament[] }
        } | null
      }>(TOURNAMENTS_QUERY, { perPage: 25, upcoming: true }, apiKey),
    ])

    if (!pastData.currentUser && !upcomingData.currentUser) {
      throw new Error('Could not fetch current user - check API key')
    }

    const past = pastData.currentUser?.tournaments.nodes || []
    const upcoming = upcomingData.currentUser?.tournaments.nodes || []

    // Combine and dedupe by id, sort by startAt desc (upcoming first)
    const all = [...upcoming, ...past]
    const unique = all.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    return unique.sort((a, b) => b.startAt - a.startAt)
  },

  // Récupère les events d'un tournoi
  async getTournamentEvents(tournamentSlug: string): Promise<StartggEvent[]> {
    const apiKey = getApiKey()
    const slug = tournamentSlug.startsWith('tournament/')
      ? tournamentSlug
      : `tournament/${tournamentSlug}`

    const data = await startggQuery<{
      tournament: { events: StartggEvent[] } | null
    }>(TOURNAMENT_EVENTS_QUERY, { slug }, apiKey)

    if (!data.tournament) {
      throw new Error(`Tournament not found: ${slug}`)
    }
    return data.tournament.events
  },

  // Récupère les sets d'un event (avec filtre optionnel par état)
  async getEventSets(
    eventId: string,
    options: { page?: number; perPage?: number; states?: number[] } = {}
  ) {
    const apiKey = getApiKey()
    const { page = 1, perPage = 30, states } = options

    const data = await startggQuery<{
      event: {
        id: string
        name: string
        sets: {
          pageInfo: { total: number; page: number; perPage: number; totalPages: number }
          nodes: StartggSetData[]
        }
      } | null
    }>(EVENT_SETS_QUERY, { eventId, page, perPage, state: states ?? null }, apiKey)

    if (!data.event) {
      throw new Error(`Event not found: ${eventId}`)
    }

    // Upsert les sets en DB
    const sets = data.event.sets.nodes.filter((s) => s.slots.some((sl) => sl.entrant))
    for (const set of sets) {
      const dbData = mapSetToDb(set, eventId, data.event.name)
      await prisma.startggSet.upsert({
        where: { id: String(set.id) },
        update: dbData,
        create: dbData,
      })
    }

    return {
      eventId: data.event.id,
      eventName: data.event.name,
      pageInfo: data.event.sets.pageInfo,
      sets: sets.map((s) => mapSetForBracket(s, eventId, data.event!.name)),
    }
  },

  // Récupère les sets d'un phase group spécifique
  async getPhaseGroupSets(phaseGroupId: string, options: { page?: number; perPage?: number } = {}) {
    const apiKey = getApiKey()
    const { page = 1, perPage = 50 } = options

    const data = await startggQuery<{
      phaseGroup: {
        id: string
        displayIdentifier: string
        phase: { id: string; name: string }
        sets: {
          pageInfo: { total: number; page: number; perPage: number; totalPages: number }
          nodes: StartggSetData[]
        }
      } | null
    }>(PHASE_GROUP_SETS_QUERY, { phaseGroupId, page, perPage }, apiKey)

    if (!data.phaseGroup) {
      throw new Error(`PhaseGroup not found: ${phaseGroupId}`)
    }

    return {
      phaseGroupId: data.phaseGroup.id,
      displayIdentifier: data.phaseGroup.displayIdentifier,
      phase: data.phaseGroup.phase,
      pageInfo: data.phaseGroup.sets.pageInfo,
      sets: data.phaseGroup.sets.nodes.filter((s) => s.slots.some((sl) => sl.entrant)),
    }
  },

  // Récupère un set spécifique avec détails complets
  async getSetDetail(setId: string) {
    const apiKey = getApiKey()
    const data = await startggQuery<{ set: StartggSetData | null }>(
      SET_DETAIL_QUERY,
      { setId },
      apiKey
    )

    if (!data.set) {
      throw new Error(`Set not found: ${setId}`)
    }

    return data.set
  },

  // Sélectionne un set start.gg et crée/met à jour le Match interne
  async selectSet(setId: string) {
    // Récupère les détails du set depuis l'API
    const set = await this.getSetDetail(setId)

    const slot0 = set.slots.find((s) => s.slotIndex === 0)
    const slot1 = set.slots.find((s) => s.slotIndex === 1)

    const player1 = slot0?.entrant?.participants?.[0]
    const player2 = slot1?.entrant?.participants?.[0]

    if (!player1 || !player2) {
      throw new Error('Set does not have both players determined yet')
    }

    // Upsert le StartggSet en DB
    const eventId = set.event?.id ?? 'unknown'
    const dbSetData = mapSetToDb(set, eventId, set.event?.name)
    await prisma.startggSet.upsert({
      where: { id: setId },
      update: dbSetData,
      create: dbSetData,
    })

    // Désactive tous les matchs existants
    await prisma.match.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    })

    // Crée ou met à jour le Match lié
    const existingMatch = await prisma.match.findFirst({
      where: { startggSetId: setId },
    })

    let match
    if (existingMatch) {
      match = await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          player1: player1.gamerTag,
          player2: player2.gamerTag,
          team1: player1.prefix,
          team2: player2.prefix,
          player1Score: slot0?.standing?.stats?.score?.value ?? 0,
          player2Score: slot1?.standing?.stats?.score?.value ?? 0,
          isCurrent: true,
        },
      })
    } else {
      match = await prisma.match.create({
        data: {
          player1: player1.gamerTag,
          player2: player2.gamerTag,
          team1: player1.prefix,
          team2: player2.prefix,
          player1Score: slot0?.standing?.stats?.score?.value ?? 0,
          player2Score: slot1?.standing?.stats?.score?.value ?? 0,
          isCurrent: true,
          startggSetId: setId,
        },
      })
    }

    return {
      match,
      set: dbSetData,
      fullRoundText: set.fullRoundText,
    }
  },

  // Récupère les sets actifs/appelés (pour le polling)
  async getActiveSets(eventId: string) {
    return this.getEventSets(eventId, {
      states: [2, 6], // ACTIVE, CALLED
      perPage: 20,
    })
  },

  // Récupère tous les sets locaux stockés
  async getLocalSets(eventId?: string) {
    const whereClause = eventId ? { eventId } : {}
    return prisma.startggSet.findMany({
      where: whereClause,
      orderBy: [{ state: 'asc' }, { round: 'asc' }],
      include: { match: true },
    })
  },
}
