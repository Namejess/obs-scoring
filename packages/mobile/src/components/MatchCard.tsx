import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { Match } from '@obs-scoring/shared'

interface MatchCardProps {
  match: Match
  onPress: () => void
  onDelete?: () => void
}

export function MatchCard({ match, onPress, onDelete }: MatchCardProps) {
  return (
    <TouchableOpacity style={[styles.card, match.isCurrent && styles.current]} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.players}>
            {match.player1} vs {match.player2}
          </Text>
          {match.isCurrent && <Text style={styles.liveBadge}>LIVE</Text>}
        </View>

        <View style={styles.teams}>
          {match.team1 && <Text style={styles.team}>{match.team1}</Text>}
          {match.team1 && match.team2 && <Text style={styles.teamSeparator}>·</Text>}
          {match.team2 && <Text style={styles.team}>{match.team2}</Text>}
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.score}>
            {match.player1Score} - {match.player2Score}
          </Text>
        </View>
      </View>

      {onDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteText}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2a4a',
    overflow: 'hidden',
  },
  current: {
    borderColor: '#22c55e',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  players: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  liveBadge: {
    backgroundColor: '#22c55e',
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  team: {
    fontSize: 12,
    color: '#71717a',
  },
  teamSeparator: {
    fontSize: 12,
    color: '#71717a',
  },
  scoreContainer: {
    marginTop: 8,
  },
  score: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366f1',
  },
  deleteBtn: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteText: {
    fontSize: 24,
    color: '#ef4444',
  },
})
