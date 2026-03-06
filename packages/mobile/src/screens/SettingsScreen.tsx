import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { getApiUrl, setApiUrl, testConnection, clearCache } from '../services/storage'
import { useSocket } from '../context/SocketContext'

interface SettingsScreenProps {
  onBack: () => void
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [url, setUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const { connect, disconnect, status } = useSocket()

  useEffect(() => {
    loadSavedUrl()
  }, [])

  const loadSavedUrl = async () => {
    const saved = await getApiUrl()
    if (saved) {
      setUrl(saved)
      setSavedUrl(saved)
    }
  }

  const handleTest = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a server URL')
      return
    }

    setTesting(true)
    const success = await testConnection(url.trim())
    setTesting(false)

    if (success) {
      Alert.alert('Success', 'Connection successful!')
    } else {
      Alert.alert('Error', 'Could not connect to server. Check the URL and make sure the server is running.')
    }
  }

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a server URL')
      return
    }

    setSaving(true)

    // First test connection
    const success = await testConnection(url.trim())
    if (!success) {
      setSaving(false)
      Alert.alert(
        'Connection Failed',
        'Could not connect to server. Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Anyway',
            onPress: async () => {
              await saveUrl()
            },
          },
        ]
      )
      return
    }

    await saveUrl()
  }

  const saveUrl = async () => {
    try {
      await setApiUrl(url.trim())
      setSavedUrl(url.trim())
      
      // Reconnect socket with new URL
      disconnect()
      await connect()
      
      Alert.alert('Saved', 'Server URL saved and connected!')
    } catch {
      Alert.alert('Error', 'Failed to save URL')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    Alert.alert('Clear Settings', 'Remove saved server URL?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          clearCache()
          disconnect()
          setUrl('')
          setSavedUrl(null)
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server Configuration</Text>
          <Text style={styles.description}>
            Enter the IP address and port of your OBS Scoring server. Your phone must be on the same
            WiFi network as the server.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.100:3000"
            placeholderTextColor="#71717a"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={handleTest}
              disabled={testing || !url.trim()}
            >
              {testing ? (
                <ActivityIndicator color="#6366f1" />
              ) : (
                <Text style={styles.btnSecondaryText}>Test Connection</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleSave}
              disabled={saving || !url.trim()}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {savedUrl && (
            <View style={styles.savedInfo}>
              <Text style={styles.savedLabel}>Currently saved:</Text>
              <Text style={styles.savedUrl}>{savedUrl}</Text>
              <Text style={styles.connectionStatus}>
                Status:{' '}
                <Text
                  style={status === 'connected' ? styles.statusConnected : styles.statusDisconnected}
                >
                  {status}
                </Text>
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help</Text>
          <Text style={styles.helpText}>1. Start the OBS Scoring server on your PC</Text>
          <Text style={styles.helpText}>2. Find your PC's local IP address</Text>
          <Text style={styles.helpText}>3. Enter the URL in format: http://IP:3000</Text>
          <Text style={styles.helpText}>4. Make sure both devices are on the same WiFi</Text>
        </View>

        {savedUrl && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearText}>Clear Saved Settings</Text>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#2a2a4a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#e4e4e7',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
  },
  btnSecondary: {
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: 'transparent',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondaryText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  savedInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  savedLabel: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 4,
  },
  savedUrl: {
    fontSize: 14,
    color: '#e4e4e7',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectionStatus: {
    marginTop: 8,
    fontSize: 12,
    color: '#71717a',
  },
  statusConnected: {
    color: '#22c55e',
    fontWeight: '600',
  },
  statusDisconnected: {
    color: '#ef4444',
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 8,
    lineHeight: 20,
  },
  clearBtn: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    marginTop: 20,
  },
  clearText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
})
