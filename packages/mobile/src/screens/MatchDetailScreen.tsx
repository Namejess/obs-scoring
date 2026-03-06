import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import type { Match } from '@obs-scoring/shared'
import { api } from '../services/api'
import { useSocket } from '../context/SocketContext'
import { ScoreControls } from '../components/ScoreControls'
import { ConnectionIndicator } from '../components/ConnectionIndicator'

interface MatchDetailScreenProps {
  matchId: number
  onBack: () => void
}

export function MatchDetailScreen({ matchId, onBack }: MatchDetailScreenProps) {
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const { onScoreUpdate, onCurrentMatchChanged } = useSocket()

  const fetchMatch = useCallback(async () => {
    try {
      const data = await api.getMatch(matchId)
      setMatch(data)
    } catch (error) {
      Alert.alert('Error', 'Failed to load match')
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    fetchMatch()
  }, [fetchMatch])

  // Listen for real-time updates
  useEffect(() => {
    const unsubScore = onScoreUpdate((event) => {
      if (event.matchId === matchId) {
        setMatch((prev) =>
          prev
            ? { ...prev, player1Score: event.player1Score, player2Score: event.player2Score }
            : null
        )
      }
    })

    const unsubCurrent = onCurrentMatchChanged((event) => {
      setMatch((prev) => (prev ? { ...prev, isCurrent: event.match?.id === prev.id } : null))
    })

    return () => {
      unsubScore()
      unsubCurrent()
    }
  }, [matchId, onScoreUpdate, onCurrentMatchChanged])

  const handleIncrement = async (player: 1 | 2) => {
    if (!match || updating) return

    setUpdating(true)
    const newScore = {
      player1Score: player === 1 ? match.player1Score + 1 : match.player1Score,
      player2Score: player === 2 ? match.player2Score + 1 : match.player2Score,
    }

    try {
      const updated = await api.updateScore(match.id, newScore)
      setMatch(updated)
    } catch {
      Alert.alert('Error', 'Failed to update score')
    } finally {
      setUpdating(false)
    }
  }

  const handleDecrement = async (player: 1 | 2) => {
    if (!match || updating) return

    const currentScore = player === 1 ? match.player1Score : match.player2Score
    if (currentScore === 0) return

    setUpdating(true)
    const newScore = {
      player1Score: player === 1 ? match.player1Score - 1 : match.player1Score,
      player2Score: player === 2 ? match.player2Score - 1 : match.player2Score,
    }

    try {
      const updated = await api.updateScore(match.id, newScore)
      setMatch(updated)
    } catch {
      Alert.alert('Error', 'Failed to update score')
    } finally {
      setUpdating(false)
    }
  }

  const handleSetCurrent = async () => {
    if (!match || updating) return

    setUpdating(true)
    try {
      const updated = await api.setCurrentMatch(match.id)
      setMatch(updated)
    } catch {
      Alert.alert('Error', 'Failed to set as current match')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    )
  }

  if (!match) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Match not found</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <ConnectionIndicator />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.matchInfo}>
          {match.isCurrent && <Text style={styles.liveBadge}>LIVE - OBS Overlay Active</Text>}
        </View>

        <ScoreControls
          match={match}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          disabled={updating}
        />

        {!match.isCurrent && (
          <TouchableOpacity
            style={[styles.setCurrentBtn, updating && styles.btnDisabled]}
            onPress={handleSetCurrent}
            disabled={updating}
          >
            <Text style={styles.setCurrentText}>Set as Current Match</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  backText: {
    fontSize: 16,
    color: '#6366f1',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  matchInfo: {
    marginBottom: 24,
    alignItems: 'center',
  },
  liveBadge: {
    backgroundColor: '#22c55e',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  setCurrentBtn: {
    marginTop: 24,
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  setCurrentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#71717a',
    fontSize: 16,
  },
})
