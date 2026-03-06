import { getApiUrl } from './storage'

export interface StartggTournament {
  id: number
  name: string
  slug: string
  startAt: number
  endAt: number
  state: number
  numAttendees: number
  isOnline: boolean
  city: string | null
  countryCode: string | null
  events: StartggEvent[]
}

export interface StartggEvent {
  id: number
  name: string
  state: string
  numEntrants: number
}

export interface StartggSet {
  id: string
  eventId: string
  eventName: string | null
  phaseId: string
  phaseName: string | null
  phaseGroupId: string
  fullRoundText: string
  identifier: string | null
  round: number
  state: number
  bestOf: number
  player1Tag: string
  player2Tag: string
  player1Prefix: string | null
  player2Prefix: string | null
  player1Score: number
  player2Score: number
  winnerId: string | null
  match?: { id: number } | null
}

export interface StartggSetsResponse {
  eventId: string
  eventName: string
  pageInfo: {
    total: number
    page: number
    perPage: number
    totalPages: number
  }
  sets: StartggSet[]
}

// State constants
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
      return 'En attente'
    case SET_STATE.ACTIVE:
      return 'En cours'
    case SET_STATE.COMPLETED:
      return 'Terminé'
    case SET_STATE.CALLED:
      return 'Appelé'
    case SET_STATE.QUEUED:
      return 'En file'
    case SET_STATE.BYE:
      return 'Bye'
    default:
      return 'Inconnu'
  }
}

export function getSetStateColor(state: number): string {
  switch (state) {
    case SET_STATE.ACTIVE:
    case SET_STATE.CALLED:
      return '#4CAF50' // green
    case SET_STATE.QUEUED:
    case SET_STATE.CREATED:
      return '#FFC107' // yellow
    case SET_STATE.COMPLETED:
      return '#9E9E9E' // grey
    default:
      return '#757575'
  }
}

export const startggApi = {
  async getTournaments(): Promise<StartggTournament[]> {
    const baseUrl = await getApiUrl()
    const res = await fetch(`${baseUrl}/api/startgg/tournaments`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.tournaments
  },

  async getTournamentEvents(slug: string): Promise<StartggEvent[]> {
    const baseUrl = await getApiUrl()
    const encodedSlug = encodeURIComponent(slug)
    const res = await fetch(`${baseUrl}/api/startgg/tournaments/${encodedSlug}/events`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.events
  },

  async getEventSets(
    eventId: string,
    options?: { states?: number[]; page?: number; perPage?: number }
  ): Promise<StartggSetsResponse> {
    const baseUrl = await getApiUrl()
    const params = new URLSearchParams()
    if (options?.states) params.set('state', options.states.join(','))
    if (options?.page) params.set('page', String(options.page))
    if (options?.perPage) params.set('perPage', String(options.perPage))

    const url = `${baseUrl}/api/startgg/events/${eventId}/sets?${params}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },

  async getActiveSets(eventId: string): Promise<StartggSetsResponse> {
    const baseUrl = await getApiUrl()
    const res = await fetch(`${baseUrl}/api/startgg/events/${eventId}/active`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },

  async selectSet(setId: string): Promise<{ id: number }> {
    const baseUrl = await getApiUrl()
    const res = await fetch(`${baseUrl}/api/startgg/sets/${setId}/select`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
}
