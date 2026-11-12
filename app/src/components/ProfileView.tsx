import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native"
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import type { Profile, Role, RoleChangeRequest } from "../types"

interface ProfileViewProps {
  user: Profile | null
  onUserUpdated: (user: Profile) => void
  onLogout: () => void
  onOpenAuth: () => void
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdated,
  onLogout,
  onOpenAuth,
}) => {
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [targetRole, setTargetRole] = useState<Role>("Equipment Owner")
  const [requestReason, setRequestReason] = useState("")
  const [roleRequestLoading, setRoleRequestLoading] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<RoleChangeRequest | null>(null)

  // Profile Edit fields
  const [name, setName] = useState(user?.name || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [shareContact, setShareContact] = useState(user?.shareContact || false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Security / Password modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const fetchRoleRequestStatus = async () => {
    if (!user) return
    try {
      const res = await api.accountTypeRequest()
      setPendingRequest(res.request)
    } catch {
      // Ignored
    }
  }

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setPhone(user.phone || "")
      setShareContact(user.shareContact || false)
      fetchRoleRequestStatus()
    }
  }, [user])

  if (!user) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="person-circle-outline" size={60} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign In to Manage Profile</Text>
        <Text style={styles.emptySub}>Manage your contact details, machinery role, and security.</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={onOpenAuth}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Users cannot request to become Admin; eligible roles are Farmer, Equipment Owner, Operator (excluding current role)
  const availableRoles: Role[] = (["Farmer", "Equipment Owner", "Operator"] as Role[]).filter(
    (r) => r !== user.role
  )

  const handleOpenRoleModal = () => {
    if (availableRoles.length > 0) {
      setTargetRole(availableRoles[0])
    }
    setRequestReason("")
    setRoleModalVisible(true)
  }

  const handleSubmitRoleRequest = async () => {
    if (targetRole === "Admin") {
      Alert.alert("Invalid Request", "You cannot request to be an Administrator.")
      return
    }
    setRoleRequestLoading(true)
    try {
      await api.requestAccountTypeChange(targetRole, requestReason.trim())
      await fetchRoleRequestStatus()
      setRoleModalVisible(false)
      Alert.alert(
        "Request Submitted",
        `Your request to change your account type to ${targetRole} has been sent to the administrator for approval.`
      )
    } catch (err) {
      Alert.alert("Submission Failed", (err as Error).message)
    } finally {
      setRoleRequestLoading(false)
    }
  }

  const handleCancelRoleRequest = async () => {
    try {
      await api.cancelAccountTypeRequest()
      setPendingRequest(null)
      Alert.alert("Cancelled", "Your account type change request has been cancelled.")
    } catch (err) {
      Alert.alert("Error", (err as Error).message)
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const updated = await api.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        shareContact,
      })
      onUserUpdated(updated)
      Alert.alert("Profile Updated", "Your changes have been saved successfully.")
    } catch (err) {
      Alert.alert("Error", (err as Error).message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill in all password fields.")
      return
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New passwords do not match.")
      return
    }
    setPasswordLoading(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setPasswordModalVisible(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      Alert.alert("Success", "Password updated successfully.")
    } catch (err) {
      Alert.alert("Failed", (err as Error).message)
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Profile Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name ? user.name.slice(0, 2).toUpperCase() : "AG"}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user.role}</Text>
          </View>
          {user.verified && (
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="check-decagram" size={14} color={colors.primary} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Account Type Section with Change Request Button */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Type</Text>
        <View style={styles.accountTypeCard}>
          <View style={styles.accountTypeRow}>
            <View>
              <Text style={styles.accountTypeLabel}>Current Role</Text>
              <Text style={styles.accountTypeValue}>{user.role}</Text>
            </View>

            {user.role !== "Admin" && !pendingRequest && (
              <TouchableOpacity
                style={styles.changeRoleBtn}
                onPress={handleOpenRoleModal}
                activeOpacity={0.8}
              >
                <Text style={styles.changeRoleBtnText}>Request Role Change</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Pending Role Request Banner */}
          {pendingRequest && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingHeader}>
                <Ionicons name="time-outline" size={16} color={colors.accent} />
                <Text style={styles.pendingTitle}>Change Request Pending Review</Text>
              </View>
              <Text style={styles.pendingDetail}>
                Requested: <Text style={{ fontWeight: "700" }}>{pendingRequest.requestedRole}</Text>
              </Text>
              {pendingRequest.reason ? (
                <Text style={styles.pendingReason}>Reason: "{pendingRequest.reason}"</Text>
              ) : null}
              <TouchableOpacity style={styles.cancelRequestBtn} onPress={handleCancelRoleRequest}>
                <Text style={styles.cancelRequestText}>Cancel Request</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Contact Details & Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="082 123 4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Share Contact Info</Text>
              <Text style={styles.switchSub}>
                Allow hire partners to view phone and email upon booking
              </Text>
            </View>
            <Switch
              value={shareContact}
              onValueChange={setShareContact}
              trackColor={{ false: colors.bgInput, true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingProfile && { opacity: 0.6 }]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Security Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.formCard}>
          <TouchableOpacity
            style={styles.securityOption}
            onPress={() => setPasswordModalVisible(true)}
          >
            <View style={styles.securityOptionLeft}>
              <Ionicons name="key-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.securityTitle}>Change Password</Text>
                <Text style={styles.securitySub}>Update your login credentials</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Action */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Request Role Change Modal (Admins excluded) */}
      <Modal visible={roleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Account Type Change</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select the account type you would like to switch to. Your request will be reviewed and
              approved by an administrator. (Admin role cannot be requested).
            </Text>

            <Text style={styles.fieldLabel}>Select New Account Type</Text>
            <View style={styles.rolePickerRow}>
              {availableRoles.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleSelectChip, targetRole === r && styles.roleSelectChipActive]}
                  onPress={() => setTargetRole(r)}
                >
                  <Text
                    style={[styles.roleSelectText, targetRole === r && styles.roleSelectTextActive]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Reason for Request</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea]}
              placeholder="e.g. I recently purchased tractors and wish to list them for hire..."
              placeholderTextColor={colors.textMuted}
              value={requestReason}
              onChangeText={setRequestReason}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveBtn, roleRequestLoading && { opacity: 0.6 }]}
              onPress={handleSubmitRoleRequest}
              disabled={roleRequestLoading}
            >
              {roleRequestLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Submit Request to Admin</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current Password with Eye */}
            <Text style={styles.fieldLabel}>Current Password</Text>
            <View style={styles.passwordInputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.fieldInput, { flex: 1, borderWidth: 0 }]}
                placeholder="Current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Ionicons
                  name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* New Password with Eye */}
            <Text style={styles.fieldLabel}>New Password (min 8 characters)</Text>
            <View style={styles.passwordInputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.fieldInput, { flex: 1, borderWidth: 0 }]}
                placeholder="New password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons
                  name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm New Password with Eye */}
            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <View style={styles.passwordInputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.fieldInput, { flex: 1, borderWidth: 0 }]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirmNewPassword}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}>
                <Ionicons
                  name={showConfirmNewPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, passwordLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
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
  headerCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  accountTypeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountTypeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountTypeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  accountTypeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  changeRoleBtn: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  changeRoleBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  pendingBanner: {
    marginTop: 14,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  pendingDetail: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  pendingReason: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  cancelRequestBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  cancelRequestText: {
    fontSize: 11,
    color: colors.dangerLight,
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  switchSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  securityOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  securityOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  securitySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginTop: 10,
  },
  logoutBtnText: {
    color: colors.dangerLight,
    fontSize: 14,
    fontWeight: "700",
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
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  rolePickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  roleSelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
  },
  roleSelectChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: colors.primary,
  },
  roleSelectText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  roleSelectTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
})
