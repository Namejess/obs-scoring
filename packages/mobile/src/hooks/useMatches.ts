import { useState, useEffect, useCallback } from 'react'
import type { Match, CreateMatchDto, UpdateScoreDto } from '@obs-scoring/shared'
import { api } from '../services/api'
import { useSocket } from '../context/SocketContext'

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { onScoreUpdate, onMatchCreated, onMatchDeleted, onCurrentMatchChanged } = useSocket()

  // Set up socket event listeners
  useEffect(() => {
    const unsubScoreUpdate = onScoreUpdate((event) => {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === event.matchId
            ? { ...m, player1Score: event.player1Score, player2Score: event.player2Score }
            : m
        )
      )
    })

    const unsubMatchCreated = onMatchCreated((event) => {
      setMatches((prev) => [event.match, ...prev])
    })

    const unsubMatchDeleted = onMatchDeleted((event) => {
      setMatches((prev) => prev.filter((m) => m.id !== event.id))
    })

    const unsubCurrentMatchChanged = onCurrentMatchChanged((event) => {
      setMatches((prev) =>
        prev.map((m) => ({
          ...m,
          isCurrent: m.id === event.match?.id,
        }))
      )
    })

    return () => {
      unsubScoreUpdate()
      unsubMatchCreated()
      unsubMatchDeleted()
      unsubCurrentMatchChanged()
    }
  }, [onScoreUpdate, onMatchCreated, onMatchDeleted, onCurrentMatchChanged])

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMatches()
      setMatches(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch matches')
    } finally {
      setLoading(false)
    }
  }, [])

  const createMatch = useCallback(async (data: CreateMatchDto): Promise<Match | null> => {
    setError(null)
    try {
      return await api.createMatch(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create match')
      return null
    }
  }, [])

  const updateScore = useCallback(
    async (id: number, data: UpdateScoreDto): Promise<Match | null> => {
      setError(null)
      try {
        return await api.updateScore(id, data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update score')
        return null
      }
    },
    []
  )

  const setCurrentMatch = useCallback(async (id: number): Promise<Match | null> => {
    setError(null)
    try {
      return await api.setCurrentMatch(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set current match')
      return null
    }
  }, [])

  const deleteMatch = useCallback(async (id: number): Promise<boolean> => {
    setError(null)
    try {
      await api.deleteMatch(id)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete match')
      return false
    }
  }, [])

  return {
    matches,
    loading,
    error,
    fetchMatches,
    createMatch,
    updateScore,
    setCurrentMatch,
    deleteMatch,
  }
}
