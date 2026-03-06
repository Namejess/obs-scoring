import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { Match } from '@obs-scoring/shared'

interface ScoreControlsProps {
  match: Match
  onIncrement: (player: 1 | 2) => void
  onDecrement: (player: 1 | 2) => void
  disabled?: boolean
}

export function ScoreControls({ match, onIncrement, onDecrement, disabled }: ScoreControlsProps) {
  return (
    <View style={styles.container}>
      {/* Player 1 */}
      <View style={styles.playerSection}>
        <Text style={styles.playerName} numberOfLines={1}>
          {match.player1}
        </Text>
        {match.team1 && <Text style={styles.teamName}>{match.team1}</Text>}

        <View style={styles.scoreRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnMinus]}
            onPress={() => onDecrement(1)}
            disabled={disabled || match.player1Score === 0}
          >
            <Text style={styles.btnText}>−</Text>
          </TouchableOpacity>

          <Text style={styles.score}>{match.player1Score}</Text>

          <TouchableOpacity
            style={[styles.btn, styles.btnPlus]}
            onPress={() => onIncrement(1)}
            disabled={disabled}
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Separator */}
      <View style={styles.separator}>
        <Text style={styles.vs}>VS</Text>
      </View>

      {/* Player 2 */}
      <View style={styles.playerSection}>
        <Text style={styles.playerName} numberOfLines={1}>
          {match.player2}
        </Text>
        {match.team2 && <Text style={styles.teamName}>{match.team2}</Text>}

        <View style={styles.scoreRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnMinus]}
            onPress={() => onDecrement(2)}
            disabled={disabled || match.player2Score === 0}
          >
            <Text style={styles.btnText}>−</Text>
          </TouchableOpacity>

          <Text style={styles.score}>{match.player2Score}</Text>

          <TouchableOpacity
            style={[styles.btn, styles.btnPlus]}
            onPress={() => onIncrement(2)}
            disabled={disabled}
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  playerSection: {
    flex: 1,
    alignItems: 'center',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e4e4e7',
    textAlign: 'center',
    marginBottom: 4,
  },
  teamName: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPlus: {
    backgroundColor: '#6366f1',
  },
  btnMinus: {
    backgroundColor: '#2a2a4a',
  },
  btnText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  score: {
    fontSize: 48,
    fontWeight: '700',
    color: '#6366f1',
    minWidth: 60,
    textAlign: 'center',
  },
  separator: {
    paddingHorizontal: 16,
  },
  vs: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717a',
  },
})
