import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSocket } from '../context/SocketContext'

export function ConnectionIndicator() {
  const { status, reconnectAttempts } = useSocket()

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#22c55e'
      case 'reconnecting':
        return '#f59e0b'
      default:
        return '#ef4444'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'reconnecting':
        return `Reconnecting... (${reconnectAttempts})`
      default:
        return 'Disconnected'
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() + '20' }]}>
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.text, { color: getStatusColor() }]}>{getStatusText()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
})
