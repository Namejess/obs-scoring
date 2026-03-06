import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native'
import { useMatches } from '../hooks/useMatches'
import { MatchCard } from '../components/MatchCard'
import { ConnectionIndicator } from '../components/ConnectionIndicator'
import type { Match } from '@obs-scoring/shared'

interface MatchListScreenProps {
  onMatchPress: (match: Match) => void
  onCreatePress: () => void
  onSettingsPress: () => void
  onStartggPress?: () => void
}

export function MatchListScreen({
  onMatchPress,
  onCreatePress,
  onSettingsPress,
  onStartggPress,
}: MatchListScreenProps) {
  const { matches, loading, error, fetchMatches, deleteMatch } = useMatches()

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleDelete = useCallback(
    (match: Match) => {
      Alert.alert('Delete Match', `Delete "${match.player1} vs ${match.player2}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMatch(match.id),
        },
      ])
    },
    [deleteMatch]
  )

  const renderItem = ({ item }: { item: Match }) => (
    <MatchCard
      match={item}
      onPress={() => onMatchPress(item)}
      onDelete={() => handleDelete(item)}
    />
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OBS Scoring</Text>
        <View style={styles.headerRight}>
          <ConnectionIndicator />
          <TouchableOpacity style={styles.settingsBtn} onPress={onSettingsPress}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={matches}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMatches} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No matches yet</Text>
              <Text style={styles.emptySubtext}>Create your first match to get started</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={onCreatePress}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {onStartggPress && (
        <TouchableOpacity style={styles.startggFab} onPress={onStartggPress}>
          <Text style={styles.startggText}>🎮</Text>
        </TouchableOpacity>
      )}
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e4e4e7',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#71717a',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#52525b',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
  startggFab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  startggText: {
    fontSize: 22,
  },
})
