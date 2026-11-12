import React, { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { Feather, Ionicons } from "@expo/vector-icons"

import { colors } from "./theme"
import { api, setUnauthorizedHandler } from "./api"
import { initPlatform, onAndroidBack } from "./platform"
import type { Profile, Place, Equipment } from "./types"

import { Header } from "./components/Header"
import { Navigation, type TabType } from "./components/Navigation"
import { EquipmentCard } from "./components/EquipmentCard"
import { EquipmentDetailsModal } from "./components/EquipmentDetailsModal"
import { AuthModal } from "./components/AuthModal"
import { AddEquipmentModal } from "./components/AddEquipmentModal"
import { LocationPickerModal } from "./components/LocationPickerModal"
import { BookingsView } from "./components/BookingsView"
import { OwnerDashboard } from "./components/OwnerDashboard"
import { OperatorsView } from "./components/OperatorsView"
import { ProfileView } from "./components/ProfileView"
import { AdminDashboard } from "./components/AdminDashboard"

const CATEGORIES = [
  "All",
  "Tractor",
  "Harvester",
  "Planter",
  "Trailer",
  "Irrigation",
  "Sprayer",
  "Baler",
  "Tillage",
]

export default function App() {
  const [user, setUser] = useState<Profile | null>(null)
  const [currentPlace, setCurrentPlace] = useState<Place | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("browse")

  // Browse state
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [loadingEquipment, setLoadingEquipment] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [authVisible, setAuthVisible] = useState(false)
  const [addVisible, setAddVisible] = useState(false)
  const [locationVisible, setLocationVisible] = useState(false)

  // Initialize platform and user session
  useEffect(() => {
    async function setup() {
      await initPlatform()
      setUnauthorizedHandler(() => setUser(null))
      try {
        const u = await api.profile()
        setUser(u)
      } catch {
        setUser(null)
      }
    }
    setup()
  }, [])

  // Android hardware back handler
  useEffect(() => {
    const removeBack = onAndroidBack(() => {
      if (selectedEquipment) {
        setSelectedEquipment(null)
        return true
      }
      if (authVisible) {
        setAuthVisible(false)
        return true
      }
      if (addVisible) {
        setAddVisible(false)
        return true
      }
      if (locationVisible) {
        setLocationVisible(false)
        return true
      }
      if (activeTab !== "browse") {
        setActiveTab("browse")
        return true
      }
      return false
    })
    return () => removeBack()
  }, [selectedEquipment, authVisible, addVisible, locationVisible, activeTab])

  // Fetch equipment list
  const fetchEquipment = useCallback(async () => {
    try {
      setLoadingEquipment(true)
      const q: Record<string, string | number | boolean | undefined> = {}
      if (selectedCategory !== "All") q.type = selectedCategory
      if (searchQuery.trim()) q.q = searchQuery.trim()
      if (currentPlace) {
        q.lat = currentPlace.lat
        q.lng = currentPlace.lng
      }
      const data = await api.equipment(q)
      setEquipment(data)
    } catch {
      // Ignored
    } finally {
      setLoadingEquipment(false)
      setRefreshing(false)
    }
  }, [selectedCategory, searchQuery, currentPlace])

  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

  const onRefresh = () => {
    setRefreshing(true)
    fetchEquipment()
  }

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
    setActiveTab("browse")
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />

        {/* Header */}
        <Header
          user={user}
          currentPlace={currentPlace}
          onOpenLocation={() => setLocationVisible(true)}
          onOpenAuth={() => setAuthVisible(true)}
          onOpenProfile={() => setActiveTab("profile")}
        />

        {/* Main Content Area */}
        <View style={styles.contentContainer}>
          {activeTab === "browse" && (
            <View style={styles.browseContainer}>
              {/* Search Bar */}
              <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                  <Feather name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search tractors, harvesters, planters..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={fetchEquipment}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Categories Scroll */}
              <View style={styles.categoriesWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesContent}
                >
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        selectedCategory === cat && styles.catChipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.catText,
                          selectedCategory === cat && styles.catTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Machinery Feed */}
              {loadingEquipment && !refreshing ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={equipment}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <EquipmentCard
                      item={item}
                      onPress={() => setSelectedEquipment(item)}
                      onToggleFavorite={async () => {
                        if (!user) {
                          setAuthVisible(true)
                          return
                        }
                        try {
                          await api.favorite(item.id)
                          setEquipment((prev) =>
                            prev.map((e) => (e.id === item.id ? { ...e, saved: !e.saved } : e))
                          )
                        } catch {}
                      }}
                    />
                  )}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.primary}
                    />
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyFeed}>
                      <Ionicons name="search-outline" size={44} color={colors.textMuted} />
                      <Text style={styles.emptyFeedTitle}>No Machinery Found</Text>
                      <Text style={styles.emptyFeedSub}>
                        Try adjusting your search keywords, category filter or location.
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          )}

          {activeTab === "bookings" && (
            <BookingsView user={user} onOpenAuth={() => setAuthVisible(true)} />
          )}

          {activeTab === "owner" && (
            <OwnerDashboard
              onOpenAddEquipment={() => {
                if (!user) {
                  setAuthVisible(true)
                } else {
                  setAddVisible(true)
                }
              }}
              onSelectEquipment={(eq) => setSelectedEquipment(eq)}
            />
          )}

          {activeTab === "operators" && <OperatorsView />}

          {activeTab === "profile" && (
            <ProfileView
              user={user}
              onUserUpdated={(u) => setUser(u)}
              onLogout={handleLogout}
              onOpenAuth={() => setAuthVisible(true)}
            />
          )}

          {activeTab === "admin" && user?.role === "Admin" && <AdminDashboard />}
        </View>

        {/* Bottom Tab Navigation */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          userRole={user?.role}
        />

        {/* Modals */}
        <EquipmentDetailsModal
          visible={!!selectedEquipment}
          equipment={selectedEquipment}
          user={user}
          onClose={() => setSelectedEquipment(null)}
          onBookSuccess={() => {
            setActiveTab("bookings")
          }}
          onRequireAuth={() => setAuthVisible(true)}
        />

        <AuthModal
          visible={authVisible}
          onClose={() => setAuthVisible(false)}
          onSuccess={(u) => {
            setUser(u)
            setAuthVisible(false)
          }}
        />

        <AddEquipmentModal
          visible={addVisible}
          onClose={() => setAddVisible(false)}
          onSuccess={(newEq) => {
            setEquipment((prev) => [newEq, ...prev])
            setActiveTab("owner")
          }}
        />

        <LocationPickerModal
          visible={locationVisible}
          onClose={() => setLocationVisible(false)}
          onSelectPlace={(p) => setCurrentPlace(p)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  browseContainer: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  categoriesWrapper: {
    paddingBottom: 10,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  catTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFeed: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyFeedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptyFeedSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
})
