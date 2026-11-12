import React, { useState } from "react"
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native"
import { Ionicons, Feather } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import { getPosition } from "../platform"
import type { Place, Town } from "../types"

const POPULAR_TOWNS: Place[] = [
  { location: "Paarl, Western Cape", province: "Western Cape", lat: -33.72, lng: 18.96 },
  { location: "Polokwane, Limpopo", province: "Limpopo", lat: -23.9, lng: 29.45 },
  { location: "Nelspruit, Mpumalanga", province: "Mpumalanga", lat: -25.47, lng: 30.98 },
  { location: "Bloemfontein, Free State", province: "Free State", lat: -29.12, lng: 26.22 },
  { location: "Rustenburg, North West", province: "North West", lat: -25.67, lng: 27.24 },
  { location: "Pietermaritzburg, KwaZulu-Natal", province: "KwaZulu-Natal", lat: -29.62, lng: 30.38 },
  { location: "Pretoria, Gauteng", province: "Gauteng", lat: -25.75, lng: 28.19 },
]

interface LocationPickerModalProps {
  visible: boolean
  onClose: () => void
  onSelectPlace: (place: Place | null) => void
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  onClose,
  onSelectPlace,
}) => {
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Town[]>([])
  const [gpsLoading, setGpsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const handleSearch = async (text: string) => {
    setQuery(text)
    if (!text.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const results = await api.towns(text.trim(), 8)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleUseGps = async () => {
    setGpsLoading(true)
    try {
      const pos = await getPosition()
      const rev = await api.reverse(pos.lat, pos.lng)
      onSelectPlace({
        location: rev.label,
        lat: rev.lat,
        lng: rev.lng,
        province: rev.province,
      })
      onClose()
    } catch (err) {
      alert((err as Error).message || "Could not retrieve GPS location.")
    } finally {
      setGpsLoading(false)
    }
  }

  const handleSelect = (p: Place) => {
    onSelectPlace(p)
    onClose()
  }

  const handleClear = () => {
    onSelectPlace(null)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search South African town or city..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={handleSearch}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* GPS Auto-Detect Button */}
          <TouchableOpacity
            style={styles.gpsButton}
            onPress={handleUseGps}
            disabled={gpsLoading}
            activeOpacity={0.8}
          >
            {gpsLoading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="navigate-circle" size={22} color={colors.primary} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsTitle}>Use Current Location</Text>
              <Text style={styles.gpsSub}>Auto-detect using device GPS</Text>
            </View>
          </TouchableOpacity>

          {/* Show All SA option */}
          <TouchableOpacity style={styles.allSaButton} onPress={handleClear}>
            <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.allSaText}>Nationwide (All South Africa)</Text>
          </TouchableOpacity>

          <Text style={styles.listSectionTitle}>
            {query ? "Search Results" : "Agricultural Hubs"}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.listScroll}>
            {searchLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : query && searchResults.length > 0 ? (
              searchResults.map((t, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.townItem}
                  onPress={() =>
                    handleSelect({
                      location: t.label,
                      province: t.province,
                      lat: t.lat,
                      lng: t.lng,
                    })
                  }
                >
                  <Feather name="map-pin" size={16} color={colors.primary} />
                  <View>
                    <Text style={styles.townName}>{t.town}</Text>
                    <Text style={styles.provinceName}>{t.province}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : query && searchResults.length === 0 ? (
              <Text style={styles.noResultsText}>No towns found matching "{query}"</Text>
            ) : (
              POPULAR_TOWNS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.townItem}
                  onPress={() => handleSelect(p)}
                >
                  <Feather name="map-pin" size={16} color={colors.primary} />
                  <View>
                    <Text style={styles.townName}>{p.location.split(",")[0]}</Text>
                    <Text style={styles.provinceName}>{p.province}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    marginBottom: 10,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  gpsSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  allSaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  allSaText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  listScroll: {
    maxHeight: 260,
  },
  townItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  townName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  provinceName: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  noResultsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 20,
  },
})
