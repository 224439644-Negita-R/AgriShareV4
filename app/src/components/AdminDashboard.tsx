import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import type { AdminOverview, AdminRoleRequest, AdminUser } from "../types"

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"roles" | "users" | "overview">("roles")
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [roleRequests, setRoleRequests] = useState<AdminRoleRequest[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AdminRoleRequest | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [ov, rr, us] = await Promise.all([
        api.adminOverview().catch(() => null),
        api.adminRoleRequests().catch(() => []),
        api.adminUsers().catch(() => []),
      ])
      setOverview(ov)
      setRoleRequests(rr)
      setUsers(us)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenReview = (req: AdminRoleRequest) => {
    setSelectedRequest(req)
    setReviewNote("")
    setReviewModalVisible(true)
  }

  const handleDecide = async (approve: boolean) => {
    if (!selectedRequest) return
    setActionLoading(true)
    try {
      await api.adminDecideRoleRequest(selectedRequest.id, approve, reviewNote.trim())
      setReviewModalVisible(false)
      Alert.alert(
        approve ? "Request Approved" : "Request Rejected",
        `User ${selectedRequest.name}'s account type has been ${
          approve ? `updated to ${selectedRequest.requested_role}` : "kept unchanged"
        }.`
      )
      await fetchData()
    } catch (err) {
      Alert.alert("Error", (err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleUserStatus = async (u: AdminUser) => {
    const newStatus = u.status === "active" ? "suspended" : "active"
    try {
      await api.adminUpdateUser(u.id, { status: newStatus })
      await fetchData()
    } catch (err) {
      Alert.alert("Error", (err as Error).message)
    }
  }

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  const pendingRequests = roleRequests.filter((r) => r.status === "pending")

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Title */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
          <Text style={styles.headerTitle}>Admin Command Center</Text>
        </View>
        <Text style={styles.headerSub}>Manage user accounts, roles & equipment safety</Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{overview?.users?.total ?? users.length}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: colors.accent }]}>{pendingRequests.length}</Text>
          <Text style={styles.statLabel}>Role Requests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{overview?.listings?.active ?? 0}</Text>
          <Text style={styles.statLabel}>Listings Active</Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "roles" && styles.tabBtnActive]}
          onPress={() => setActiveTab("roles")}
        >
          <Text style={[styles.tabText, activeTab === "roles" && styles.tabTextActive]}>
            Role Requests ({pendingRequests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "users" && styles.tabBtnActive]}
          onPress={() => setActiveTab("users")}
        >
          <Text style={[styles.tabText, activeTab === "users" && styles.tabTextActive]}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Role Requests Tab */}
      {activeTab === "roles" && (
        <View>
          {roleRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="check-circle" size={36} color={colors.primary} />
              <Text style={styles.emptyText}>No role change requests submitted yet.</Text>
            </View>
          ) : (
            roleRequests.map((req) => {
              const isPending = req.status === "pending"
              const isApproved = req.status === "approved"
              const statusBg = isApproved
                ? colors.statusConfirmedBg
                : isPending
                ? colors.statusPendingBg
                : colors.statusRejectedBg
              const statusColor = isApproved
                ? colors.statusConfirmedText
                : isPending
                ? colors.statusPendingText
                : colors.statusRejectedText

              return (
                <View key={req.id} style={styles.roleCard}>
                  <View style={styles.roleCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{req.name}</Text>
                      <Text style={styles.userEmail}>{req.email}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{req.status}</Text>
                    </View>
                  </View>

                  <View style={styles.roleChangeBanner}>
                    <Text style={styles.roleFrom}>{req.current_role}</Text>
                    <Feather name="arrow-right" size={16} color={colors.primary} />
                    <Text style={styles.roleTo}>{req.requested_role}</Text>
                  </View>

                  {req.reason ? (
                    <Text style={styles.reasonText}>Reason: "{req.reason}"</Text>
                  ) : null}

                  {req.review_note ? (
                    <Text style={styles.reviewNote}>Admin Note: {req.review_note}</Text>
                  ) : null}

                  {/* Review Action for Pending Requests */}
                  {isPending && (
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() => handleOpenReview(req)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.reviewBtnText}>Review & Decide</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })
          )}
        </View>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <View>
          {users.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userLeft}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarTxt}>{u.name ? u.name.slice(0, 2) : "U"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uName}>{u.name}</Text>
                  <Text style={styles.uEmail}>{u.email}</Text>
                  <View style={styles.uBadgeRow}>
                    <View style={styles.uRolePill}>
                      <Text style={styles.uRoleText}>{u.role}</Text>
                    </View>
                    <View
                      style={[
                        styles.uStatusPill,
                        u.status === "active" ? styles.uActive : styles.uSuspended,
                      ]}
                    >
                      <Text style={styles.uStatusText}>{u.status}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Status Action */}
              {u.role !== "Admin" && (
                <TouchableOpacity
                  style={[styles.statusToggleBtn, u.status === "active" && styles.suspendBtn]}
                  onPress={() => handleToggleUserStatus(u)}
                >
                  <Text style={styles.statusToggleText}>
                    {u.status === "active" ? "Suspend" : "Activate"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Role Change Request</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <View style={{ marginVertical: 12 }}>
                <Text style={styles.modalUser}>
                  User: <Text style={{ color: colors.textPrimary }}>{selectedRequest.name}</Text> (
                  {selectedRequest.email})
                </Text>
                <View style={styles.roleChangeBanner}>
                  <Text style={styles.roleFrom}>{selectedRequest.current_role}</Text>
                  <Feather name="arrow-right" size={16} color={colors.primary} />
                  <Text style={styles.roleTo}>{selectedRequest.requested_role}</Text>
                </View>
                {selectedRequest.reason ? (
                  <Text style={styles.reasonText}>Reason: "{selectedRequest.reason}"</Text>
                ) : null}
              </View>
            )}

            <Text style={styles.noteLabel}>Admin Review Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Verified machinery ownership documentation"
              placeholderTextColor={colors.textMuted}
              value={reviewNote}
              onChangeText={setReviewNote}
              multiline
              numberOfLines={2}
            />

            <View style={styles.decideRow}>
              <TouchableOpacity
                style={[styles.decideBtn, styles.rejectBtn]}
                onPress={() => handleDecide(false)}
                disabled={actionLoading}
              >
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.decideBtn, styles.approveBtn]}
                onPress={() => handleDecide(true)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.approveBtnText}>Approve & Update Role</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
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
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: colors.bgCard,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
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
  roleCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  roleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  roleChangeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  roleFrom: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  roleTo: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "800",
  },
  reasonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginBottom: 6,
  },
  reviewNote: {
    fontSize: 11,
    color: colors.accent,
    marginBottom: 8,
  },
  reviewBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  reviewBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  uName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  uEmail: {
    fontSize: 11,
    color: colors.textMuted,
  },
  uBadgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  uRolePill: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  uRoleText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  uStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  uActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  uSuspended: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  uStatusText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  statusToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  suspendBtn: {
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalUser: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 16,
  },
  decideRow: {
    flexDirection: "row",
    gap: 10,
  },
  decideBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  rejectBtn: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  rejectBtnText: {
    color: colors.dangerLight,
    fontSize: 14,
    fontWeight: "700",
  },
  approveBtn: {
    backgroundColor: colors.primary,
  },
  approveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
})
