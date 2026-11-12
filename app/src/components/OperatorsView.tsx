import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import type { OperatorCard } from "../types"

export const OperatorsView: React.FC = () => {
  const [operators, setOperators] = useState<OperatorCard[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOperators = async () => {
    try {
      setLoading(true)
      const res = await api.operators()
      setOperators(res)
    } catch {
      // Ignored
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOperators()
  }, [])

  const handleCall = (phone: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`)
  }

  const handleEmail = (email: string | null, name: string) => {
    if (email) Linking.openURL(`mailto:${email}?subject=Operator hire inquiry for ${name}`)
  }

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Certified Machinery Operators</Text>
      <Text style={styles.pageSub}>
        Experienced drivers and technicians ready for farm deployment
      </Text>

      {operators.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="users" size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>No operators found right now.</Text>
        </View>
      ) : (
        operators.map((op) => (
          <View key={op.id} style={styles.operatorCard}>
            <View style={styles.topRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{op.initials || op.name.slice(0, 2)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{op.name}</Text>
                  {op.verified && (
                    <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primary} />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Feather name="map-pin" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{op.location || op.province}</Text>
                </View>
              </View>

              <View style={styles.rateBox}>
                <Text style={styles.rateVal}>R{op.dayRate}</Text>
                <Text style={styles.rateSub}>/ day</Text>
              </View>
            </View>

            {/* Experience & Certs */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillText}>{op.years} years experience</Text>
              </View>
              {op.certs ? (
                <View style={styles.statPill}>
                  <Text style={styles.statPillText}>{op.certs}</Text>
                </View>
              ) : null}
            </View>

            {/* Skills */}
            {op.skills && op.skills.length > 0 && (
              <View style={styles.skillsRow}>
                {op.skills.map((s, idx) => (
                  <View key={idx} style={styles.skillTag}>
                    <Text style={styles.skillText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bio */}
            {op.bio ? <Text style={styles.bio}>{op.bio}</Text> : null}

            {/* Contact Actions */}
            <View style={styles.actionsRow}>
              {op.phone && (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleCall(op.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={14} color="#ffffff" />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
              )}
              {op.email && (
                <TouchableOpacity
                  style={[styles.contactBtn, styles.emailBtn]}
                  onPress={() => handleEmail(op.email, op.name)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mail" size={14} color="#ffffff" />
                  <Text style={styles.contactBtnText}>Email</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
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
    paddingVertical: 80,
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
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  operatorCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rateBox: {
    alignItems: "flex-end",
  },
  rateVal: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  rateSub: {
    fontSize: 10,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statPill: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  skillTag: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  skillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  bio: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  contactBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emailBtn: {
    backgroundColor: colors.info,
  },
  contactBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
})
