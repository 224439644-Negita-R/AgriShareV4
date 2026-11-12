import React, { useState } from "react"
import {
  View,
  Text,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import { addDays, diffDays, todayStr } from "../dates"
import type { Equipment, Profile } from "../types"

interface EquipmentDetailsModalProps {
  visible: boolean
  equipment: Equipment | null
  user: Profile | null
  onClose: () => void
  onBookSuccess: () => void
  onRequireAuth: () => void
}

export const EquipmentDetailsModal: React.FC<EquipmentDetailsModalProps> = ({
  visible,
  equipment,
  user,
  onClose,
  onBookSuccess,
  onRequireAuth,
}) => {
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(addDays(todayStr(), 2))
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState("")

  if (!equipment) return null

  const days = Math.max(1, diffDays(startDate, endDate) + 1)
  const estimateTotal = days * equipment.rate

  const handleBooking = async () => {
    if (!user) {
      onRequireAuth()
      return
    }
    if (user.role === "Equipment Owner" && equipment.mine) {
      setBookingError("You cannot book your own equipment")
      return
    }
    setBookingLoading(true)
    setBookingError("")
    try {
      await api.book(equipment.id, startDate, endDate)
      onBookSuccess()
      onClose()
    } catch (err) {
      setBookingError((err as Error).message || "Booking failed")
    } finally {
      setBookingLoading(false)
    }
  }

  const handleCall = () => {
    if (equipment.owner?.phone) {
      Linking.openURL(`tel:${equipment.owner.phone}`)
    }
  }

  const handleEmail = () => {
    if (equipment.owner?.email) {
      Linking.openURL(`mailto:${equipment.owner.email}?subject=Hire inquiry for ${equipment.name}`)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Top Bar with Close button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.topTitle} numberOfLines={1}>
              {equipment.name}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Equipment Image */}
            <View style={styles.imageBox}>
              <Image
                source={{
                  uri: equipment.img || "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=800",
                }}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.badgeRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{equipment.type}</Text>
                </View>
                {equipment.operator && (
                  <View style={styles.operatorBadge}>
                    <Text style={styles.operatorText}>Operator Included</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Header Details */}
            <View style={styles.section}>
              <Text style={styles.name}>{equipment.name}</Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color={colors.primary} />
                <Text style={styles.locationText}>
                  {equipment.place || equipment.province}
                  {equipment.km ? ` · ${equipment.km} km away` : ""}
                </Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>R{equipment.rate}</Text>
                <Text style={styles.pricePer}> / day</Text>
              </View>
            </View>

            {/* Specs Grid */}
            {equipment.specs && equipment.specs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specifications</Text>
                <View style={styles.specsGrid}>
                  {equipment.specs.map(([key, val], idx) => (
                    <View key={idx} style={styles.specItem}>
                      <Text style={styles.specKey}>{key}</Text>
                      <Text style={styles.specVal}>{val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Description */}
            {equipment.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Overview</Text>
                <Text style={styles.description}>{equipment.description}</Text>
              </View>
            ) : null}

            {/* Owner Details & Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Equipment Owner</Text>
              <View style={styles.ownerCard}>
                <View style={styles.ownerAvatar}>
                  <Text style={styles.ownerAvatarText}>
                    {equipment.owner?.name ? equipment.owner.name.slice(0, 2).toUpperCase() : "OW"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.ownerNameRow}>
                    <Text style={styles.ownerName}>{equipment.owner?.name || "Verified Owner"}</Text>
                    {equipment.owner?.verified && (
                      <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primary} />
                    )}
                  </View>
                  <Text style={styles.ownerSub}>AgriShare verified farm equipment provider</Text>
                </View>
              </View>

              {/* Direct Contact Buttons if owner shared phone/email */}
              {(equipment.owner?.phone || equipment.owner?.email) && (
                <View style={styles.contactRow}>
                  {equipment.owner?.phone && (
                    <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                      <Ionicons name="call" size={16} color="#ffffff" />
                      <Text style={styles.contactBtnText}>Call Owner</Text>
                    </TouchableOpacity>
                  )}
                  {equipment.owner?.email && (
                    <TouchableOpacity style={[styles.contactBtn, styles.emailBtn]} onPress={handleEmail}>
                      <Ionicons name="mail" size={16} color="#ffffff" />
                      <Text style={styles.contactBtnText}>Email</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Booking & Date Selection */}
            <View style={styles.bookingBox}>
              <Text style={styles.sectionTitle}>Hire This Machine</Text>

              {bookingError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{bookingError}</Text>
                </View>
              ) : null}

              <View style={styles.datePickerRow}>
                <View style={styles.dateInputBox}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.dateInputBox}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Calculation Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Duration</Text>
                  <Text style={styles.summaryVal}>
                    {days} {days === 1 ? "day" : "days"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Rate</Text>
                  <Text style={styles.summaryVal}>R{equipment.rate} / day</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalText}>Estimated Total</Text>
                  <Text style={styles.totalVal}>R{estimateTotal}</Text>
                </View>
              </View>

              {/* Submit Hire Button */}
              <TouchableOpacity
                style={[styles.bookBtn, bookingLoading && { opacity: 0.7 }]}
                onPress={handleBooking}
                disabled={bookingLoading}
                activeOpacity={0.8}
              >
                {bookingLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.bookBtnText}>Request Booking</Text>
                )}
              </TouchableOpacity>
            </View>
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
    height: "92%",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    maxWidth: "70%",
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageBox: {
    width: "100%",
    height: 240,
    backgroundColor: colors.bgInput,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badgeRow: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    gap: 8,
  },
  typeBadge: {
    backgroundColor: "rgba(11, 15, 25, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  operatorBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  operatorText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  pricePer: {
    fontSize: 14,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  specItem: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: "48%",
  },
  specKey: {
    fontSize: 11,
    color: colors.textMuted,
  },
  specVal: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerAvatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  ownerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  ownerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  contactBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emailBtn: {
    backgroundColor: colors.info,
  },
  contactBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  bookingBox: {
    padding: 20,
    backgroundColor: colors.bgDark,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: colors.dangerLight,
    fontSize: 12,
  },
  datePickerRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  dateInputBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  dateInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: colors.bgInput,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  totalVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  bookBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  bookBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
})
