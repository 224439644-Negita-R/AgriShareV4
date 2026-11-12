import React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import type { Profile, Place } from "../types"

interface HeaderProps {
  user: Profile | null
  currentPlace: Place | null
  onOpenLocation: () => void
  onOpenAuth: () => void
  onOpenProfile: () => void
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentPlace,
  onOpenLocation,
  onOpenAuth,
  onOpenProfile,
}) => {
  return (
    <View style={styles.container}>
      {/* Brand & Logo */}
      <View style={styles.brandRow}>
        <View style={styles.logoIconBg}>
          <MaterialCommunityIcons name="tractor" size={22} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.brandTitle}>AgriShare</Text>
          <Text style={styles.brandSubtitle}>South Africa</Text>
        </View>
      </View>

      {/* Right controls: Location & User */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.locationPill} onPress={onOpenLocation} activeOpacity={0.7}>
          <Ionicons name="location-sharp" size={14} color={colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {currentPlace?.location ? currentPlace.location.split(",")[0] : "All SA"}
          </Text>
        </TouchableOpacity>

        {user ? (
          <TouchableOpacity style={styles.avatarButton} onPress={onOpenProfile} activeOpacity={0.7}>
            <Text style={styles.avatarText}>
              {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signInButton} onPress={onOpenAuth} activeOpacity={0.7}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxWidth: 120,
  },
  locationText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "500",
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  signInText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
})
