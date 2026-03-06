import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { CreateMatchDto } from '@obs-scoring/shared'
import { useMatches } from '../hooks/useMatches'

interface CreateMatchScreenProps {
  onBack: () => void
  onCreated: () => void
}

export function CreateMatchScreen({ onBack, onCreated }: CreateMatchScreenProps) {
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [team1, setTeam1] = useState('')
  const [team2, setTeam2] = useState('')
  const [loading, setLoading] = useState(false)

  const { createMatch, error } = useMatches()

  const handleSubmit = async () => {
    if (!player1.trim() || !player2.trim()) return

    setLoading(true)
    const data: CreateMatchDto = {
      player1: player1.trim(),
      player2: player2.trim(),
    }
    if (team1.trim()) data.team1 = team1.trim()
    if (team2.trim()) data.team2 = team2.trim()

    const result = await createMatch(data)
    setLoading(false)

    if (result) {
      onCreated()
    }
  }

  const isValid = player1.trim() && player2.trim()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Match</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Player 1</Text>
            <TextInput
              style={styles.input}
              placeholder="Player name *"
              placeholderTextColor="#71717a"
              value={player1}
              onChangeText={setPlayer1}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Team name (optional)"
              placeholderTextColor="#71717a"
              value={team1}
              onChangeText={setTeam1}
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Player 2</Text>
            <TextInput
              style={styles.input}
              placeholder="Player name *"
              placeholderTextColor="#71717a"
              value={player2}
              onChangeText={setPlayer2}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Team name (optional)"
              placeholderTextColor="#71717a"
              value={team2}
              onChangeText={setTeam2}
              editable={!loading}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, (!isValid || loading) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
          >
            <Text style={styles.submitText}>{loading ? 'Creating...' : 'Create Match'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  placeholder: {
    width: 60,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#2a2a4a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#e4e4e7',
    marginBottom: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
