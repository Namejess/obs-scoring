import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native'
import { SocketProvider, useSocket } from './src/context/SocketContext'
import { getApiUrl } from './src/services/storage'

// Screens
import { MatchListScreen } from './src/screens/MatchListScreen'
import { MatchDetailScreen } from './src/screens/MatchDetailScreen'
import { CreateMatchScreen } from './src/screens/CreateMatchScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { TournamentScreen } from './src/screens/TournamentScreen'
import { BracketScreen } from './src/screens/BracketScreen'

import type { Match } from '@obs-scoring/shared'

// Simple navigation types
type Screen =
  | { name: 'matchList' }
  | { name: 'matchDetail'; matchId: number }
  | { name: 'createMatch' }
  | { name: 'settings' }
  | { name: 'tournaments' }
  | { name: 'bracket'; eventId: string; eventName: string; tournamentName: string }

function AppContent() {
  const [screen, setScreen] = useState<Screen>({ name: 'matchList' })
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const { connect, status } = useSocket()

  useEffect(() => {
    checkSetup()
  }, [])

  const checkSetup = async () => {
    try {
      const url = await getApiUrl()
      if (!url) {
        setNeedsSetup(true)
        setLoading(false)
        return
      }
      // Try to connect
      await connect()
      setNeedsSetup(false)
    } catch {
      setNeedsSetup(true)
    } finally {
      setLoading(false)
    }
  }

  // Navigation handlers
  const navigateTo = (newScreen: Screen) => {
    setScreen(newScreen)
  }

  const goToMatchList = () => navigateTo({ name: 'matchList' })
  const goToSettings = () => navigateTo({ name: 'settings' })
  const goToCreateMatch = () => navigateTo({ name: 'createMatch' })
  const goToMatchDetail = (matchId: number) => navigateTo({ name: 'matchDetail', matchId })
  const goToTournaments = () => navigateTo({ name: 'tournaments' })
  const goToBracket = (eventId: string, eventName: string, tournamentName: string) =>
    navigateTo({ name: 'bracket', eventId, eventName, tournamentName })

  // Show loading spinner during initial setup check
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  // If no server URL is configured, force settings screen
  if (needsSetup && screen.name !== 'settings') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SettingsScreen
          onBack={() => {
            // After setup, re-check and go to match list
            checkSetup().then(() => {
              if (!needsSetup) {
                goToMatchList()
              }
            })
          }}
        />
      </View>
    )
  }

  // Render current screen
  const renderScreen = () => {
    switch (screen.name) {
      case 'matchList':
        return (
          <MatchListScreen
            onMatchPress={(match: Match) => goToMatchDetail(match.id)}
            onCreatePress={goToCreateMatch}
            onSettingsPress={goToSettings}
            onStartggPress={goToTournaments}
          />
        )
      case 'matchDetail':
        return <MatchDetailScreen matchId={screen.matchId} onBack={goToMatchList} />
      case 'createMatch':
        return <CreateMatchScreen onBack={goToMatchList} onCreated={goToMatchList} />
      case 'settings':
        return (
          <SettingsScreen
            onBack={() => {
              checkSetup()
              goToMatchList()
            }}
          />
        )
      case 'tournaments':
        return <TournamentScreen onBack={goToMatchList} onSelectEvent={goToBracket} />
      case 'bracket':
        return (
          <BracketScreen
            eventId={screen.eventId}
            eventName={screen.eventName}
            tournamentName={screen.tournamentName}
            onBack={goToTournaments}
            onSetSelected={goToMatchDetail}
          />
        )
      default:
        return null
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderScreen()}
    </View>
  )
}

export default function App() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#a1a1aa',
    fontSize: 14,
  },
})
