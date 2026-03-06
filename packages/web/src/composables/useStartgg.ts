import { ref, computed } from 'vue'

// Types
export interface StartggTournament {
  id: number
  name: string
  slug: string
  startAt: number
  endAt: number
  city: string | null
  countryCode: string | null
  isOnline: boolean
  numAttendees: number
  state: number // 1=CREATED, 2=ACTIVE, 3=COMPLETED
  events: { id: number; name: string }[]
}

export interface StartggEvent {
  id: number
  name: string
  slug: string
  state: string
  numEntrants: number
  startAt: number | null
}

export interface StartggSet {
  id: string
  state: number
  round: number
  identifier: string
  fullRoundText: string
  player1Tag: string
  player1Prefix: string | null
  player1Score: number
  player2Tag: string
  player2Prefix: string | null
  player2Score: number
  winnerId: string | null
  bestOf: number
  match: { id: number } | null
  // Sources pour la construction de l'arbre du bracket
  entrant1Source?: {
    type: string | null // 'set' | 'seed'
    sourceId: string | null // ID du set source
    condition: string | null // 'winner' | 'loser'
  } | null
  entrant2Source?: {
    type: string | null
    sourceId: string | null
    condition: string | null
  } | null
}

export interface StartggSetsResponse {
  sets: StartggSet[]
  pageInfo: {
    total: number
    page: number
    perPage: number
    totalPages: number
  }
}

export const SET_STATE = {
  CREATED: 1,
  ACTIVE: 2,
  COMPLETED: 3,
  BYE: 4,
  CALLED: 6,
  QUEUED: 7,
} as const

export function getSetStateLabel(state: number): string {
  switch (state) {
    case SET_STATE.CREATED:
      return 'À venir'
    case SET_STATE.ACTIVE:
      return 'En cours'
    case SET_STATE.COMPLETED:
      return 'Terminé'
    case SET_STATE.BYE:
      return 'Bye'
    case SET_STATE.CALLED:
      return 'Appelé'
    case SET_STATE.QUEUED:
      return 'File'
    default:
      return 'Inconnu'
  }
}

export function getSetStateColor(state: number): string {
  switch (state) {
    case SET_STATE.ACTIVE:
    case SET_STATE.CALLED:
      return '#22C55E'
    case SET_STATE.QUEUED:
    case SET_STATE.CREATED:
      return '#3B82F6'
    case SET_STATE.COMPLETED:
      return '#6B7280'
    default:
      return '#6B7280'
  }
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function useStartgg() {
  const tournaments = ref<StartggTournament[]>([])
  const events = ref<StartggEvent[]>([])
  const sets = ref<StartggSet[]>([])
  const setsPageInfo = ref<StartggSetsResponse['pageInfo'] | null>(null)

  const loading = ref(false)
  const loadingEvents = ref(false)
  const loadingSets = ref(false)
  const selectingSetId = ref<string | null>(null)
  const error = ref<string | null>(null)

  const selectedTournament = ref<StartggTournament | null>(null)
  const selectedEvent = ref<StartggEvent | null>(null)

  // Computed
  const hasToken = computed(() => tournaments.value.length > 0 || !error.value?.includes('token'))

  // API calls
  async function fetchTournaments() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/api/startgg/tournaments`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur API')
      }
      tournaments.value = await res.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur de chargement'
    } finally {
      loading.value = false
    }
  }

  async function fetchEvents(tournamentSlug: string) {
    loadingEvents.value = true
    error.value = null
    try {
      const res = await fetch(
        `${API_BASE}/api/startgg/tournaments/${encodeURIComponent(tournamentSlug)}/events`
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur API')
      }
      events.value = await res.json()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur de chargement'
    } finally {
      loadingEvents.value = false
    }
  }

  async function fetchSets(eventId: string, options?: { states?: number[]; perPage?: number }) {
    loadingSets.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (options?.states?.length) {
        params.set('states', options.states.join(','))
      }
      if (options?.perPage) {
        params.set('perPage', String(options.perPage))
      }
      const url = `${API_BASE}/api/startgg/events/${eventId}/sets?${params}`
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur API')
      }
      const data: StartggSetsResponse = await res.json()
      sets.value = data.sets
      setsPageInfo.value = data.pageInfo
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur de chargement'
    } finally {
      loadingSets.value = false
    }
  }

  async function selectSet(setId: string): Promise<{ id: number } | null> {
    selectingSetId.value = setId
    try {
      const res = await fetch(`${API_BASE}/api/startgg/sets/${setId}/select`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur de sélection')
      }
      const data = await res.json()
      // API returns { match: { id, ... }, set: {...} }
      return data.match ? { id: data.match.id } : null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur de sélection'
      return null
    } finally {
      selectingSetId.value = null
    }
  }

  // Navigation helpers
  function selectTournament(tournament: StartggTournament) {
    selectedTournament.value = tournament
    selectedEvent.value = null
    sets.value = []
    fetchEvents(tournament.slug)
  }

  function selectEvent(event: StartggEvent) {
    selectedEvent.value = event
    fetchSets(String(event.id), {
      states: [SET_STATE.ACTIVE, SET_STATE.CALLED, SET_STATE.QUEUED],
      perPage: 50,
    })
  }

  function goBackToTournaments() {
    selectedTournament.value = null
    selectedEvent.value = null
    events.value = []
    sets.value = []
  }

  function goBackToEvents() {
    selectedEvent.value = null
    sets.value = []
  }

  // Format helpers
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function getTournamentStateLabel(state: number): { label: string; color: string } {
    switch (state) {
      case 1:
        return { label: 'À venir', color: '#3B82F6' }
      case 2:
        return { label: 'En cours', color: '#22C55E' }
      case 3:
        return { label: 'Terminé', color: '#6B7280' }
      default:
        return { label: 'Inconnu', color: '#6B7280' }
    }
  }

  return {
    // State
    tournaments,
    events,
    sets,
    setsPageInfo,
    loading,
    loadingEvents,
    loadingSets,
    selectingSetId,
    error,
    selectedTournament,
    selectedEvent,
    hasToken,

    // Actions
    fetchTournaments,
    fetchEvents,
    fetchSets,
    selectSet,
    selectTournament,
    selectEvent,
    goBackToTournaments,
    goBackToEvents,

    // Helpers
    formatDate,
    getTournamentStateLabel,
    getSetStateLabel,
    getSetStateColor,
    SET_STATE,
  }
}
