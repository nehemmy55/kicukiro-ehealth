// Where the app finds the Node.js + Express API.
//
// 1. If EXPO_PUBLIC_API_URL is set (in mobile/.env), that is used.
// 2. Otherwise, when running in Expo Go, the app reuses the IP address of the
//    computer running `npx expo start` — so a phone on the same Wi-Fi reaches
//    the backend automatically at http://<that-IP>:4000/api.
// 3. On the web, it uses the same host the page was loaded from.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

function detectApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
  }
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:${API_PORT}/api`;
  // Android emulator fallback (10.0.2.2 = the computer running the emulator)
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}/api` : `http://localhost:${API_PORT}/api`;
}

export const API_URL = detectApiUrl();
export const FACILITY = 'Kicukiro Health Center';
