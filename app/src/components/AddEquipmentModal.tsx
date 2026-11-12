import React, { useState } from "react"
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { Ionicons, Feather } from "@expo/vector-icons"
import { colors } from "../theme"
import { api, type NewEquipment } from "../api"
import type { Equipment } from "../types"

const STANDARD_TYPES = [
  "Tractor",
  "Harvester",
  "Planter",
  "Trailer",
  "Irrigation",
  "Sprayer",
  "Baler",
  "Tillage",
  "Custom",
]

interface AddEquipmentModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (equipment: Equipment) => void
}

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState("")
  const [selectedType, setSelectedType] = useState("Tractor")
  const [customType, setCustomType] = useState("")
  const [rate, setRate] = useState("")
  const [location, setLocation] = useState("Paarl, Western Cape")
  const [operator, setOperator] = useState(false)
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const resetForm = () => {
    setName("")
    setSelectedType("Tractor")
    setCustomType("")
    setRate("")
    setOperator(false)
    setDescription("")
    setImageUrl("")
    setError("")
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    setError("")
    if (!name.trim()) {
      setError("Equipment name is required")
      return
    }
    const rateNum = Number(rate)
    if (!rateNum || rateNum < 100 || rateNum > 100000) {
      setError("Daily rate must be between R100 and R100,000")
      return
    }

    const finalType = selectedType === "Custom" ? customType.trim() : selectedType
    if (!finalType) {
      setError("Please specify the custom equipment type")
      return
    }

    setLoading(true)
    try {
      const payload: NewEquipment = {
        name: name.trim(),
        type: finalType,
        rate: rateNum,
        operator,
        description: description.trim(),
        location,
        province: "Western Cape",
        lat: -33.72,
        lng: 18.96,
        images: imageUrl.trim()
          ? [imageUrl.trim()]
          : ["https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=800"],
      }
      const created = await api.addEquipment(payload)
      onSuccess(created)
      handleClose()
    } catch (err) {
      setError((err as Error).message || "Failed to list equipment")
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
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>List Farm Equipment</Text>
              <Text style={styles.subtitle}>Rent out your idle machinery to neighboring farmers</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Equipment Name / Model</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John Deere 5075E 4WD"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Equipment Type Selection */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Equipment Type</Text>
              <View style={styles.typeChipsRow}>
                {STANDARD_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, selectedType === t && styles.typeChipActive]}
                    onPress={() => setSelectedType(t)}
                  >
                    <Text style={[styles.typeChipText, selectedType === t && styles.typeChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Type Field when 'Custom' option is chosen */}
            {selectedType === "Custom" && (
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Specify Custom Type</Text>
                <TextInput
                  style={[styles.input, styles.customInput]}
                  placeholder="e.g. Grain Auger, Silo Loader, Forestry Mulcher"
                  placeholderTextColor={colors.textMuted}
                  value={customType}
                  onChangeText={setCustomType}
                  autoFocus
                />
              </View>
            )}

            {/* Daily Rate */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Daily Hire Rate (ZAR)</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencyPrefix}>R</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="2450"
                  placeholderTextColor={colors.textMuted}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                />
                <Text style={styles.currencySuffix}>/ day</Text>
              </View>
            </View>

            {/* Town / Place */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Paarl, Western Cape"
                placeholderTextColor={colors.textMuted}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {/* Operator Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setOperator(!operator)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, operator && styles.checkboxActive]}>
                {operator && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkboxLabel}>Include certified operator</Text>
                <Text style={styles.checkboxSub}>Machine comes with an experienced driver</Text>
              </View>
            </TouchableOpacity>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Description & Condition</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe horsepower, working condition, implements included, fuel policy..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Image URL */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Photo URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://images.unsplash.com/..."
                placeholderTextColor={colors.textMuted}
                value={imageUrl}
                onChangeText={setImageUrl}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Publish Equipment Listing</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: "92%",
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
    paddingBottom: 24,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    gap: 8,
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
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  customInput: {
    borderColor: colors.primary,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  typeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  typeChipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    marginRight: 6,
  },
  currencySuffix: {
    fontSize: 13,
    color: colors.textMuted,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgInput,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  checkboxSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
})
