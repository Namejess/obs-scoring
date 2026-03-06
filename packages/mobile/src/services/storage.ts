const API_URL_KEY = '@obs-scoring/api-url'

// Default to empty - user must configure
let cachedApiUrl: string | null = null

export async function getApiUrl(): Promise<string | null> {
  if (cachedApiUrl !== null) {
    return cachedApiUrl
  }

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    const url = await AsyncStorage.getItem(API_URL_KEY)
    cachedApiUrl = url
    return url
  } catch {
    return null
  }
}

export async function setApiUrl(url: string): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    await AsyncStorage.setItem(API_URL_KEY, url)
    cachedApiUrl = url
  } catch (error) {
    console.error('Failed to save API URL:', error)
    throw error
  }
}

export async function testConnection(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await response.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}

export function clearCache(): void {
  cachedApiUrl = null
}
