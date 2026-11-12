export const colors = {
  // Backgrounds
  bgDark: "#0b0f19",
  bgCard: "#111827",
  bgCardHover: "#1f2937",
  bgInput: "#172033",
  bgSubtle: "#1e293b",

  // Brand / Accents
  primary: "#10b981", // Emerald 500
  primaryHover: "#059669",
  primaryDark: "#047857",
  accent: "#f59e0b", // Amber
  accentLight: "#fbbf24",
  danger: "#ef4444",
  dangerLight: "#f87171",
  info: "#3b82f6",

  // Text
  textPrimary: "#f9fafb",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  textDark: "#111827",

  // Borders
  border: "#1f2937",
  borderLight: "#374151",
  borderFocus: "#10b981",

  // Status badges
  statusPendingBg: "rgba(245, 158, 11, 0.15)",
  statusPendingText: "#fbbf24",
  statusConfirmedBg: "rgba(16, 185, 129, 0.15)",
  statusConfirmedText: "#34d399",
  statusRejectedBg: "rgba(239, 68, 68, 0.15)",
  statusRejectedText: "#f87171",
  statusCompletedBg: "rgba(59, 130, 246, 0.15)",
  statusCompletedText: "#60a5fa",
}

export const typography = {
  title: { fontSize: 24, fontWeight: "700" as const, color: colors.textPrimary },
  subtitle: { fontSize: 18, fontWeight: "600" as const, color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary },
  caption: { fontSize: 12, color: colors.textMuted },
}
