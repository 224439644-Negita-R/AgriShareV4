import React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import type { Role } from "../types"

export type TabType = "browse" | "bookings" | "owner" | "operators" | "profile" | "admin"

interface NavigationProps {
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  userRole?: Role
  pendingBookingsCount?: number
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  pendingBookingsCount = 0,
}) => {
  return (
    <View style={styles.tabBar}>
      {/* Browse Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab("browse")}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === "browse" ? "search" : "search-outline"}
          size={20}
          color={activeTab === "browse" ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.tabLabel, activeTab === "browse" && styles.activeTabLabel]}>
          Browse
        </Text>
      </TouchableOpacity>

      {/* Bookings Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab("bookings")}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === "bookings" ? "calendar" : "calendar-outline"}
          size={20}
          color={activeTab === "bookings" ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.tabLabel, activeTab === "bookings" && styles.activeTabLabel]}>
          Bookings
        </Text>
      </TouchableOpacity>

      {/* Owner / List Equipment Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab("owner")}
        activeOpacity={0.7}
      >
        <View>
          <MaterialCommunityIcons
            name={activeTab === "owner" ? "tractor" : "tractor"}
            size={20}
            color={activeTab === "owner" ? colors.primary : colors.textMuted}
          />
          {pendingBookingsCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingBookingsCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.tabLabel, activeTab === "owner" && styles.activeTabLabel]}>
          {userRole === "Equipment Owner" ? "Dashboard" : "List Gear"}
        </Text>
      </TouchableOpacity>

      {/* Operators Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab("operators")}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === "operators" ? "people" : "people-outline"}
          size={20}
          color={activeTab === "operators" ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.tabLabel, activeTab === "operators" && styles.activeTabLabel]}>
          Operators
        </Text>
      </TouchableOpacity>

      {/* Admin Tab (Only if user is Admin) */}
      {userRole === "Admin" && (
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onSelectTab("admin")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === "admin" ? "shield-checkmark" : "shield-checkmark-outline"}
            size={20}
            color={activeTab === "admin" ? colors.accent : colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "admin" && { color: colors.accent }]}>
            Admin
          </Text>
        </TouchableOpacity>
      )}

      {/* Profile Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab("profile")}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activeTab === "profile" ? "person" : "person-outline"}
          size={20}
          color={activeTab === "profile" ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.tabLabel, activeTab === "profile" && styles.activeTabLabel]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 16,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    color: colors.textMuted,
    fontWeight: "500",
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
})
