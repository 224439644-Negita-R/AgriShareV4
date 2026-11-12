import React from "react"
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import type { Equipment } from "../types"

interface EquipmentCardProps {
  item: Equipment
  onPress: () => void
  onToggleFavorite?: () => void
}

export const EquipmentCard: React.FC<EquipmentCardProps> = ({ item, onPress, onToggleFavorite }) => {
  const imageUri = item.img
    ? item.img.startsWith("http")
      ? item.img
      : item.img
    : "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=600&auto=format&fit=crop&q=80"

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Equipment Image with Tags */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>

        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favButton}
            onPress={onToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={item.saved ? "heart" : "heart-outline"}
              size={18}
              color={item.saved ? colors.danger : "#ffffff"}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Name and Rating */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#fbbf24" />
            <Text style={styles.ratingText}>{item.rating || "4.8"}</Text>
          </View>
        </View>

        {/* Location & Province */}
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={12} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {item.place || item.province}
            {item.km !== undefined && item.km !== null ? ` · ${item.km} km` : ""}
          </Text>
        </View>

        {/* Owner Info & Operator Availability */}
        <View style={styles.ownerRow}>
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerText}>{item.owner?.name || "Verified Owner"}</Text>
            {item.owner?.verified && (
              <MaterialCommunityIcons name="check-decagram" size={13} color={colors.primary} />
            )}
          </View>
          {item.operator && (
            <View style={styles.operatorTag}>
              <Text style={styles.operatorTagText}>+ Operator</Text>
            </View>
          )}
        </View>

        {/* Footer: Price & Action */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.priceAmount}>R{item.rate}</Text>
            <Text style={styles.pricePer}>per day</Text>
          </View>
          <TouchableOpacity style={styles.viewBtn} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.viewBtnText}>Hire Gear</Text>
            <Feather name="arrow-right" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  imageContainer: {
    width: "100%",
    height: 180,
    backgroundColor: colors.bgInput,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  typeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(11, 15, 25, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  favButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(11, 15, 25, 0.7)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 14,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fbbf24",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ownerText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  operatorTag: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  operatorTagText: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 2,
  },
  priceAmount: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  pricePer: {
    fontSize: 10,
    color: colors.textMuted,
  },
  viewBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
})
