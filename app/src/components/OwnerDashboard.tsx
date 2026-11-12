import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import type { Dashboard, Equipment, Booking } from "../types"

interface OwnerDashboardProps {
  onOpenAddEquipment: () => void
  onSelectEquipment: (eq: Equipment) => void
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  onOpenAddEquipment,
  onSelectEquipment,
}) => {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const res = await api.dashboard()
      setData(res)
    } catch {
      // Not logged in or error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const handleDecide = async (id: number, action: "approve" | "decline") => {
    setActionLoading(id)
    try {
      await api.decide(id, action)
      await fetchDashboard()
    } catch (err) {
      Alert.alert("Action Failed", (err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (eq: Equipment) => {
    try {
      await api.updateEquipment(eq.id, { active: !eq.active })
      await fetchDashboard()
    } catch (err) {
      Alert.alert("Update Failed", (err as Error).message)
    }
  }

  const handleDelete = (id: number) => {
    Alert.alert("Remove Equipment", "Are you sure you want to delete this listing?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteEquipment(id)
            await fetchDashboard()
          } catch (err) {
            Alert.alert("Error", (err as Error).message)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const stats = data?.stats || {
    activeListings: 0,
    pendingRequests: 0,
    bookedDays: 0,
    profileViews: 0,
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Top Banner with Action */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Owner Operations</Text>
          <Text style={styles.headerSub}>Manage your machinery & hire bookings</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onOpenAddEquipment} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.addBtnText}>List Equipment</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{stats.activeListings}</Text>
          <Text style={styles.statLabel}>Active Machines</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: colors.accent }]}>{stats.pendingRequests}</Text>
          <Text style={styles.statLabel}>Pending Requests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{stats.bookedDays}</Text>
          <Text style={styles.statLabel}>Days Booked</Text>
        </View>
      </View>

      {/* Pending Hire Requests Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Incoming Booking Requests</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{data?.requests?.length || 0}</Text>
          </View>
        </View>

        {!data?.requests || data.requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No pending hire requests right now.</Text>
          </View>
        ) : (
          data.requests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqMachine}>{req.equipment?.name}</Text>
                  <Text style={styles.reqFarmer}>Requested by: {req.farmer}</Text>
                  <Text style={styles.reqDates}>
                    {req.startDate} to {req.endDate} ({req.days} days)
                  </Text>
                </View>
                <View style={styles.reqPriceBox}>
                  <Text style={styles.reqPrice}>R{req.estimate}</Text>
                  <Text style={styles.reqPriceSub}>Total estimate</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.declineBtn]}
                  onPress={() => handleDecide(req.id, "decline")}
                  disabled={actionLoading === req.id}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleDecide(req.id, "approve")}
                  disabled={actionLoading === req.id}
                >
                  {actionLoading === req.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.approveText}>Approve Hire</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* My Equipment Listings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Fleet ({data?.equipment?.length || 0})</Text>

        {!data?.equipment || data.equipment.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="tractor" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>You have not listed any equipment yet.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={onOpenAddEquipment}>
              <Text style={styles.emptyBtnText}>Add Your First Machine</Text>
            </TouchableOpacity>
          </View>
        ) : (
          data.equipment.map((eq) => (
            <View key={eq.id} style={styles.equipmentRow}>
              <Image
                source={{
                  uri: eq.img || "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=300",
                }}
                style={styles.eqThumb}
              />
              <View style={styles.eqInfo}>
                <Text style={styles.eqName} numberOfLines={1}>
                  {eq.name}
                </Text>
                <Text style={styles.eqMeta}>
                  {eq.type} · R{eq.rate}/day
                </Text>
                <View style={styles.eqStatusRow}>
                  <TouchableOpacity
                    style={[styles.statusChip, eq.active ? styles.statusActive : styles.statusPaused]}
                    onPress={() => handleToggleActive(eq)}
                  >
                    <Text style={styles.statusChipText}>{eq.active ? "Active" : "Paused"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(eq.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statVal: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  emptyBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  requestCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  requestTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  reqMachine: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  reqFarmer: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reqDates: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "500",
    marginTop: 4,
  },
  reqPriceBox: {
    alignItems: "flex-end",
  },
  reqPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  reqPriceSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  requestActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  declineText: {
    color: colors.dangerLight,
    fontSize: 12,
    fontWeight: "600",
  },
  approveBtn: {
    backgroundColor: colors.primary,
  },
  approveText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    gap: 12,
  },
  eqThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.bgInput,
  },
  eqInfo: {
    flex: 1,
  },
  eqName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  eqMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  eqStatusRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPaused: {
    backgroundColor: "rgba(107, 114, 128, 0.2)",
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  deleteBtn: {
    padding: 8,
  },
})
