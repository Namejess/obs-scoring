import type { Match, CreateMatchDto, UpdateScoreDto, OBSOverlayData } from '@obs-scoring/shared'
import { getApiUrl } from './storage'

async function getBaseUrl(): Promise<string> {
  const url = await getApiUrl()
  if (!url) {
    throw new Error('API URL not configured. Please configure the server URL in Settings.')
  }
  return url
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getBaseUrl()
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const api = {
  async getMatches(): Promise<Match[]> {
    return apiRequest<Match[]>('/matches')
  },

  async getMatch(id: number): Promise<Match> {
    return apiRequest<Match>(`/matches/${id}`)
  },

  async getCurrentMatch(): Promise<Match | null> {
    try {
      return await apiRequest<Match>('/matches/current')
    } catch {
      return null
    }
  },

  async getOBSData(): Promise<OBSOverlayData> {
    return apiRequest<OBSOverlayData>('/matches/obsData')
  },

  async createMatch(data: CreateMatchDto): Promise<Match> {
    return apiRequest<Match>('/matches', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateScore(id: number, data: UpdateScoreDto): Promise<Match> {
    return apiRequest<Match>(`/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async setCurrentMatch(id: number): Promise<Match> {
    return apiRequest<Match>(`/matches/${id}/setCurrent`, {
      method: 'PATCH',
    })
  },

  async deleteMatch(id: number): Promise<void> {
    return apiRequest<void>(`/matches/${id}`, {
      method: 'DELETE',
    })
  },
}
