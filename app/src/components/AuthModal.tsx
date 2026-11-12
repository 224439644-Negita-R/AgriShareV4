import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { Ionicons, Feather } from "@expo/vector-icons"
import { colors } from "../theme"
import { api } from "../api"
import type { Role, Profile } from "../types"

interface AuthModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (user: Profile) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [location, setLocation] = useState("Paarl, Western Cape")
  const [role, setRole] = useState<Role>("Farmer")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [needs2fa, setNeeds2fa] = useState(false)

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setName("")
    setPhone("")
    setTwoFactorCode("")
    setNeeds2fa(false)
    setError("")
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    setError("")
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required")
      return
    }

    if (isRegister) {
      if (!name.trim()) {
        setError("Full name is required")
        return
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }
      if (role === "Admin") {
        setError("Cannot register as an Admin")
        return
      }
    }

    setLoading(true)
    try {
      if (isRegister) {
        const user = await api.register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          phone: phone.trim() || undefined,
          location,
          province: "Western Cape",
          lat: -33.72,
          lng: 18.96,
          acceptTerms: true,
        })
        onSuccess(user)
        handleClose()
      } else {
        const res = await api.login(
          email.trim().toLowerCase(),
          password,
          twoFactorCode.trim() || undefined
        )
        if (res === "needs2fa") {
          setNeeds2fa(true)
          setError("Enter the 6-digit 2FA code or recovery code from your authenticator")
        } else {
          onSuccess(res)
          handleClose()
        }
      }
    } catch (err) {
      setError((err as Error).message || "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {needs2fa ? "Two-Factor Verification" : isRegister ? "Create Account" : "Sign In to AgriShare"}
              </Text>
              <Text style={styles.subtitle}>
                {needs2fa
                  ? "Enter the code from your authenticator app"
                  : isRegister
                  ? "Join the agricultural equipment sharing network"
                  : "Welcome back! Enter your details to continue"}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {needs2fa ? (
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>2FA Security Code</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="shield" size={18} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 123456"
                    placeholderTextColor={colors.textMuted}
                    value={twoFactorCode}
                    onChangeText={setTwoFactorCode}
                    keyboardType="number-pad"
                    autoFocus
                  />
                </View>
              </View>
            ) : (
              <>
                {/* Full Name in Register Mode */}
                {isRegister && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="person-outline" size={18} color={colors.primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Thabo Mokoena"
                        placeholderTextColor={colors.textMuted}
                        value={name}
                        onChangeText={setName}
                      />
                    </View>
                  </View>
                )}

                {/* Email Address */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Phone Number in Register Mode */}
                {isRegister && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Phone Number</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="call-outline" size={18} color={colors.primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="082 123 4567"
                        placeholderTextColor={colors.textMuted}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                )}

                {/* Role Picker in Register Mode */}
                {isRegister && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.label}>I am joining as:</Text>
                    <View style={styles.roleRow}>
                      {(["Farmer", "Equipment Owner", "Operator"] as Role[]).map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleChip, role === r && styles.roleChipActive]}
                          onPress={() => setRole(r)}
                        >
                          <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Password Field with Show/Hide Button */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password Field (Register Mode Only) with Show/Hide Button */}
                {isRegister && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        confirmPassword.length > 0 &&
                          (password === confirmPassword ? styles.inputMatch : styles.inputMismatch),
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={18} color={colors.primary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Re-enter your password"
                        placeholderTextColor={colors.textMuted}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <Text style={styles.mismatchText}>Passwords do not match</Text>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {needs2fa ? "Verify Code" : isRegister ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Register / Login */}
            {!needs2fa && (
              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>
                  {isRegister ? "Already have an account?" : "Don't have an account yet?"}
                </Text>
                <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
                  <Text style={styles.toggleLink}>
                    {isRegister ? "Sign In" : "Register"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: colors.dangerLight,
    fontSize: 12,
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
  },
  inputMatch: {
    borderColor: colors.primary,
  },
  inputMismatch: {
    borderColor: colors.danger,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  eyeBtn: {
    padding: 4,
  },
  mismatchText: {
    color: colors.dangerLight,
    fontSize: 11,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
  },
  roleChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: colors.primary,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  roleTextActive: {
    color: colors.primary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  toggleText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  toggleLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "700",
  },
})
