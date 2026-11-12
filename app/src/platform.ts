import { Platform, Linking, BackHandler } from "react-native"
import * as Location from "expo-location"
import * as Haptics from "expo-haptics"
import * as SecureStore from "expo-secure-store"
import Constants from "expo-constants"

export const isNative = () => Platform.OS !== "web"
export const platformName = () => Platform.OS as "ios" | "android" | "web"

let memoryToken: string | null = null
const KEY = "agrishare_token"

/** Where the API lives. */
export function getApiBase(): string {
  // 1. Explicit environment variable (e.g. cloud production URL)
  const envUrl = process.env.EXPO_PUBLIC_API_URL
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "")
  }

  // 2. Custom override stored in web localStorage
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      const custom = window.localStorage.getItem("agrishare_server_url")
      if (custom && custom.trim()) return custom.trim().replace(/\/$/, "")
    }
  } catch {}

  // 3. Expo Go automatic host detection: routes to your computer's local Wi-Fi IP automatically
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const hostIp = hostUri.split(":")[0]
    if (hostIp) {
      return `http://${hostIp}:3001/api`
    }
  }

  // 4. Android Emulator loopback or local fallback
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api"
  } else if (Platform.OS === "ios") {
    return "http://localhost:3001/api"
  }

  // 5. On web development (e.g. localhost:8081), route to backend server on port 3001
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location) {
      const port = window.location.port
      if (port && port !== "3001") {
        return `http://${window.location.hostname}:3001/api`
      }
    }
    return "/api"
  }

  return "http://localhost:3001/api"
}

export function setCustomServerUrl(url: string | null) {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      if (url && url.trim()) {
        window.localStorage.setItem("agrishare_server_url", url.trim())
      } else {
        window.localStorage.removeItem("agrishare_server_url")
      }
    }
  } catch {}
}

export const API_BASE = getApiBase()

export async function initPlatform() {
  try {
    if (Platform.OS !== "web") {
      memoryToken = await SecureStore.getItemAsync(KEY)
    } else if (typeof window !== "undefined" && window.localStorage) {
      memoryToken = window.localStorage.getItem(KEY)
    }
  } catch {
    memoryToken = null
  }
}

export const getNativeToken = () => memoryToken

export async function setNativeToken(t: string | null) {
  memoryToken = t
  try {
    if (Platform.OS !== "web") {
      if (t) {
        await SecureStore.setItemAsync(KEY, t)
      } else {
        await SecureStore.deleteItemAsync(KEY)
      }
    } else if (typeof window !== "undefined" && window.localStorage) {
      if (t) {
        window.localStorage.setItem(KEY, t)
      } else {
        window.localStorage.removeItem(KEY)
      }
    }
  } catch {}
}

/** GPS: uses expo-location */
export async function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") {
      throw new Error("Location permission was blocked. Allow location in settings or pick a town.")
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 10,
    }
  } catch (e) {
    throw new Error((e as Error).message || "Could not retrieve GPS location. Pick a town instead.")
  }
}

/** Haptics feedback */
export async function hapticLight() {
  try {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  } catch {}
}

export async function hapticSuccess() {
  try {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  } catch {}
}

export async function hapticError() {
  try {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  } catch {}
}

/** External links */
export async function openExternal(url: string) {
  try {
    await Linking.openURL(url)
  } catch {}
}

/** Android hardware back button */
export function onAndroidBack(callback: () => boolean): () => void {
  if (Platform.OS !== "android") return () => {}
  const sub = BackHandler.addEventListener("hardwareBackPress", () => callback())
  return () => sub.remove()
}
