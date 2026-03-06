import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { startggApi, StartggTournament, StartggEvent } from '../services/startgg'

interface TournamentScreenProps {
  onBack: () => void
  onSelectEvent: (eventId: string, eventName: string, tournamentName: string) => void
}

export function TournamentScreen({ onBack, onSelectEvent }: TournamentScreenProps) {
  const [tournaments, setTournaments] = useState<StartggTournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<StartggTournament | null>(null)
  const [events, setEvents] = useState<StartggEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTournaments = useCallback(async () => {
    try {
      setError(null)
      const data = await startggApi.getTournaments()
      setTournaments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchTournaments()
  }, [fetchTournaments])

  const selectTournament = async (tournament: StartggTournament) => {
    setSelectedTournament(tournament)
    setLoadingEvents(true)
    try {
      const data = await startggApi.getTournamentEvents(tournament.slug)
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des events')
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleBack = () => {
    if (selectedTournament) {
      setSelectedTournament(null)
      setEvents([])
    } else {
      onBack()
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTournamentStateLabel = (state: number) => {
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

  const renderTournament = ({ item }: { item: StartggTournament }) => {
    const state = getTournamentStateLabel(item.state)
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => selectTournament(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.tournamentName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={[styles.badge, { backgroundColor: state.color }]}>
            <Text style={styles.badgeText}>{state.label}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>
            📅 {formatDate(item.startAt)}
            {item.endAt !== item.startAt && ` - ${formatDate(item.endAt)}`}
          </Text>
          {item.city && (
            <Text style={styles.detailText}>
              📍 {item.city}, {item.countryCode}
            </Text>
          )}
          {item.isOnline && <Text style={styles.detailText}>🌐 En ligne</Text>}
          <Text style={styles.detailText}>
            👥 {item.numAttendees} participants • {item.events.length} event
            {item.events.length > 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEvent = ({ item }: { item: StartggEvent }) => {
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => onSelectEvent(String(item.id), item.name, selectedTournament!.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.eventName}>{item.name}</Text>
        <View style={styles.eventDetails}>
          <Text style={styles.eventDetailText}>👥 {item.numEntrants} participants</Text>
          <Text style={styles.eventState}>{item.state}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  // Events view
  if (selectedTournament) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {selectedTournament.name}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Sélectionner un event</Text>

        {loadingEvents ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderEvent}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucun event trouvé</Text>}
          />
        )}
      </View>
    )
  }

  // Tournaments list view
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tournois start.gg</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Chargement des tournois...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTournaments}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTournament}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Aucun tournoi trouvé. Vérifiez votre token start.gg.
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
    paddingBottom: 16,
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a1a1aa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'uppercase',
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
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tournamentName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  cardDetails: {
    gap: 4,
  },
  detailText: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  eventCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDetailText: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  eventState: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 40,
  },
})
