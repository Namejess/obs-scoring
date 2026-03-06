import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import {
  startggApi,
  StartggSet,
  StartggSetsResponse,
  SET_STATE,
  getSetStateLabel,
  getSetStateColor,
} from '../services/startgg'

interface BracketScreenProps {
  eventId: string
  eventName: string
  tournamentName: string
  onBack: () => void
  onSetSelected: (matchId: number) => void
}

type FilterState = 'all' | 'active' | 'pending' | 'completed'

export function BracketScreen({
  eventId,
  eventName,
  tournamentName,
  onBack,
  onSetSelected,
}: BracketScreenProps) {
  const [setsData, setSetsData] = useState<StartggSetsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectingSetId, setSelectingSetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>('active')
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const getStateFilter = (f: FilterState): number[] | undefined => {
    switch (f) {
      case 'active':
        return [SET_STATE.ACTIVE, SET_STATE.CALLED, SET_STATE.QUEUED]
      case 'pending':
        return [SET_STATE.CREATED, SET_STATE.QUEUED]
      case 'completed':
        return [SET_STATE.COMPLETED]
      default:
        return undefined
    }
  }

  const fetchSets = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setError(null)
        const data = await startggApi.getEventSets(eventId, {
          states: getStateFilter(filter),
          perPage: 50,
        })
        setSetsData(data)
      } catch (err) {
        if (showLoading) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement')
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [eventId, filter]
  )

  // Initial fetch and polling setup
  useEffect(() => {
    setLoading(true)
    fetchSets()

    // Start polling every 15s when viewing active sets
    if (pollingEnabled && (filter === 'active' || filter === 'all')) {
      pollingRef.current = setInterval(() => {
        fetchSets(false) // Silent refresh
      }, 15000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [fetchSets, filter, pollingEnabled])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchSets()
  }, [fetchSets])

  const selectSet = async (set: StartggSet) => {
    setSelectingSetId(set.id)
    try {
      const result = await startggApi.selectSet(set.id)
      Alert.alert(
        'Match sélectionné',
        `${set.player1Tag} vs ${set.player2Tag} est maintenant affiché dans OBS`,
        [
          { text: 'Voir le match', onPress: () => onSetSelected(result.id) },
          { text: 'OK', style: 'cancel' },
        ]
      )
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de sélectionner')
    } finally {
      setSelectingSetId(null)
    }
  }

  const renderFilterButton = (f: FilterState, label: string) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === f && styles.filterButtonActive]}
      onPress={() => setFilter(f)}
    >
      <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  )

  const renderSet = ({ item }: { item: StartggSet }) => {
    const isSelecting = selectingSetId === item.id
    const stateColor = getSetStateColor(item.state)
    const stateLabel = getSetStateLabel(item.state)

    // Format player display with prefix
    const formatPlayer = (tag: string, prefix: string | null) =>
      prefix ? `${prefix} | ${tag}` : tag

    return (
      <TouchableOpacity
        style={[styles.setCard, item.state === SET_STATE.ACTIVE && styles.setCardActive]}
        onPress={() => selectSet(item)}
        disabled={isSelecting}
        activeOpacity={0.7}
      >
        {isSelecting && (
          <View style={styles.selectingOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        <View style={styles.setHeader}>
          <Text style={styles.roundText}>{item.fullRoundText}</Text>
          <View style={[styles.stateBadge, { backgroundColor: stateColor }]}>
            <Text style={styles.stateText}>{stateLabel}</Text>
          </View>
        </View>

        <View style={styles.players}>
          <View style={styles.playerRow}>
            <Text
              style={[
                styles.playerTag,
                item.winnerId && item.winnerId !== item.id && styles.playerTagWinner,
              ]}
              numberOfLines={1}
            >
              {formatPlayer(item.player1Tag, item.player1Prefix)}
            </Text>
            <Text style={styles.score}>{item.player1Score >= 0 ? item.player1Score : '-'}</Text>
          </View>
          <View style={styles.playerRow}>
            <Text
              style={[
                styles.playerTag,
                item.winnerId && item.winnerId !== item.id && styles.playerTagWinner,
              ]}
              numberOfLines={1}
            >
              {formatPlayer(item.player2Tag, item.player2Prefix)}
            </Text>
            <Text style={styles.score}>{item.player2Score >= 0 ? item.player2Score : '-'}</Text>
          </View>
        </View>

        {item.bestOf > 0 && <Text style={styles.bestOf}>Bo{item.bestOf}</Text>}

        {item.match && (
          <View style={styles.linkedBadge}>
            <Text style={styles.linkedText}>Lié au match #{item.match.id}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.tournamentTitle} numberOfLines={1}>
            {tournamentName}
          </Text>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {eventName}
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        {renderFilterButton('active', 'En cours')}
        {renderFilterButton('pending', 'À venir')}
        {renderFilterButton('completed', 'Terminés')}
        {renderFilterButton('all', 'Tous')}
      </View>

      <View style={styles.pollingRow}>
        <TouchableOpacity
          style={styles.pollingToggle}
          onPress={() => setPollingEnabled(!pollingEnabled)}
        >
          <View style={[styles.pollingDot, pollingEnabled && styles.pollingDotActive]} />
          <Text style={styles.pollingText}>
            {pollingEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Text>
        </TouchableOpacity>
        {setsData && (
          <Text style={styles.countText}>
            {setsData.sets.length} set{setsData.sets.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Chargement des sets...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchSets()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={setsData?.sets || []}
          keyExtractor={(item) => item.id}
          renderItem={renderSet}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Aucun set{' '}
              {filter === 'active' ? 'en cours' : filter === 'pending' ? 'à venir' : 'trouvé'}
            </Text>
          }
        />
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
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  backButton: {
    paddingRight: 16,
  },
  backText: {
    color: '#6366f1',
    fontSize: 16,
  },
  headerTitles: {
    flex: 1,
  },
  tournamentTitle: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  filters: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  pollingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pollingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pollingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  pollingDotActive: {
    backgroundColor: '#22C55E',
  },
  pollingText: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  countText: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: '#a1a1aa',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  setCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  setCardActive: {
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  selectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roundText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stateText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  players: {
    gap: 8,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerTag: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    marginRight: 12,
  },
  playerTagWinner: {
    color: '#22C55E',
    fontWeight: '600',
  },
  score: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    minWidth: 24,
    textAlign: 'center',
  },
  bestOf: {
    position: 'absolute',
    top: 16,
    right: 80,
    color: '#6B7280',
    fontSize: 11,
  },
  linkedBadge: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#6366f1',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  linkedText: {
    color: '#fff',
    fontSize: 11,
  },
  emptyText: {
    textAlign: 'center',
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 40,
  },
})
