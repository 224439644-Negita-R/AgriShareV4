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
import { Ionicons, Feather } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import type { Booking, Profile } from "../types"

interface BookingsViewProps {
  user: Profile | null
  onOpenAuth: () => void
}

export const BookingsView: React.FC<BookingsViewProps> = ({ user, onOpenAuth }) => {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<string>("All")
  const [loading, setLoading] = useState(true)

  const fetchBookings = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.bookings()
      setBookings(res)
    } catch {
      // Ignored
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
  }, [user])

  const handleCancel = (id: number) => {
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this hire request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await api.cancel(id)
            await fetchBookings()
          } catch (err) {
            Alert.alert("Cancellation Failed", (err as Error).message)
          }
        },
      },
    ])
  }

  if (!user) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign In to View Bookings</Text>
        <Text style={styles.emptySub}>Track all your equipment hires and requests in one place.</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={onOpenAuth}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const filtered = bookings.filter((b) => {
    if (filter === "All") return true
    return b.status === filter
  })

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>My Equipment Hires</Text>
      <Text style={styles.pageSub}>Track machine bookings, confirmations & hire schedules</Text>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        {["All", "Pending", "Confirmed", "Completed", "Cancelled"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="inbox" size={36} color={colors.textMuted} />
          <Text style={styles.emptyCardText}>No {filter.toLowerCase()} bookings found.</Text>
        </View>
      ) : (
        filtered.map((b) => {
          const statusBg =
            b.status === "Confirmed"
              ? colors.statusConfirmedBg
              : b.status === "Pending"
              ? colors.statusPendingBg
              : b.status === "Completed"
              ? colors.statusCompletedBg
              : colors.statusRejectedBg

          const statusColor =
            b.status === "Confirmed"
              ? colors.statusConfirmedText
              : b.status === "Pending"
              ? colors.statusPendingText
              : b.status === "Completed"
              ? colors.statusCompletedText
              : colors.statusRejectedText

          return (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                <Image
                  source={{
                    uri:
                      b.equipment?.img ||
                      "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=200",
                  }}
                  style={styles.cardThumb}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardMachine} numberOfLines={1}>
                    {b.equipment?.name}
                  </Text>
                  <Text style={styles.cardOwner}>Owner: {b.equipment?.owner}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{b.status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hire Dates</Text>
                  <Text style={styles.detailVal}>
                    {b.startDate} to {b.endDate} ({b.days} days)
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Daily Rate</Text>
                  <Text style={styles.detailVal}>R{b.rate} / day</Text>
                </View>
                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Estimate</Text>
                  <Text style={styles.totalVal}>R{b.estimate}</Text>
                </View>
              </View>

              {/* Actions: Cancel if pending */}
              {b.status === "Pending" && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancel(b.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>Cancel Request</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })
      )}
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
    padding: 24,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  signInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  signInBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  pageSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  filtersScroll: {
    flexDirection: "row",
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    gap: 10,
  },
  emptyCardText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  bookingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  cardThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.bgInput,
  },
  cardMachine: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardOwner: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  detailVal: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 6,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bgInput,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cancelBtnText: {
    color: colors.dangerLight,
    fontSize: 12,
    fontWeight: "600",
  },
})
