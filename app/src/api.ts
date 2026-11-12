import { getApiBase, getNativeToken, isNative, setNativeToken } from "./platform"
export * from "./types"
import type {
  Role,
  Profile,
  Place,
  Town,
  AppConfig,
  OperatorCard,
  Equipment,
  Booking,
  Dashboard,
  RoleChangeRequest,
  AdminRoleRequest,
  AdminOverview,
  AdminUser,
  AdminListing,
  Notice,
} from "./types"

export type AdminTicket = { id: number; ref: string; message: string; status: string; created_at: string; name: string; email: string; role: Role }
export type AdminVerification = { id: number; note: string; status: string; reason: string; created_at: string; has_doc: boolean; name: string; email: string; role: Role; location: string }
export type AdminReport = { id: number; target_type: string; target_id: number; reason: string; detail: string; status: string; created_at: string; reporter: string; target_name: string | null }
export type AuditEntry = { id: number; action: string; target: string; detail: string; ip: string; created_at: string; actor: string | null }

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn)
export const hasNativeToken = () => !!getNativeToken()

export class ApiError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const native = isNative()
  let res: Response
  try {
    res = await fetch(getApiBase() + url, {
      method,
      credentials: native ? "omit" : "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "AgriShare",
        ...(native ? { "X-Client": "native", ...(getNativeToken() ? { Authorization: "Bearer " + getNativeToken() } : {}) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0, "offline")
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !url.startsWith("/auth/login") && !url.startsWith("/profile")) {
    await setNativeToken(null)
    onUnauthorized()
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code)
  return data as T
}

const qs = (o: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== "" && v !== false && p.set(k, String(v)))
  const s = p.toString()
  return s ? "?" + s : ""
}
type Q = Record<string, string | number | boolean | undefined>
type Session = { token?: string; user: Profile; needs2fa?: undefined } | { needs2fa: true; user?: undefined; token?: undefined }
export type NewEquipment = { name: string; type: string; rate: number; operator: boolean; operatorId?: number; description: string; images: string[] } & Partial<Place>
export type RegisterInput = { name: string; email: string; password: string; role: Role; phone?: string; acceptTerms: boolean } & Partial<Place>

async function finishLogin(r: Session): Promise<Profile | "needs2fa"> {
  if (r.needs2fa) return "needs2fa"
  if (r.token) await setNativeToken(r.token)
  return r.user
}

export const api = {
  config: () => call<AppConfig>("GET", "/config"),
  login: async (email: string, password: string, code?: string) => finishLogin(await call<Session>("POST", "/auth/login", { email, password, code })),
  register: async (b: RegisterInput) => finishLogin(await call<Session>("POST", "/auth/register", b)) as Promise<Profile>,
  logout: async () => {
    await call("POST", "/auth/logout").catch(() => {})
    await setNativeToken(null)
  },
  logoutAll: async () => {
    await call("POST", "/auth/logout-all")
    await setNativeToken(null)
  },
  verifyEmail: (token: string) => call<{ ok: true }>("POST", "/auth/verify", { token }),
  resendVerification: () => call<{ ok: true }>("POST", "/auth/resend-verification"),
  forgot: (email: string) => call<{ ok: true }>("POST", "/auth/forgot", { email }),
  resetPassword: (token: string, password: string) => call<{ ok: true }>("POST", "/auth/reset", { token, password }),
  changePassword: (current: string, password: string) => call<{ ok: true }>("POST", "/auth/change-password", { current, password }),
  twoFactorSetup: () => call<{ secret: string; otpauth: string }>("POST", "/auth/2fa/setup"),
  twoFactorEnable: (code: string) => call<{ ok: true; recoveryCodes: string[] }>("POST", "/auth/2fa/enable", { code }),
  twoFactorDisable: (password: string, code: string) => call<{ ok: true }>("POST", "/auth/2fa/disable", { password, code }),
  profile: () => call<Profile>("GET", "/profile"),
  updateProfile: (b: Partial<Profile> & Partial<Place>) => call<Profile>("PUT", "/profile", b),
  exportData: () => call<Record<string, unknown>>("GET", "/account/export"),
  deleteAccount: async (password: string) => {
    await call("DELETE", "/account", { password })
    await setNativeToken(null)
  },
  registerDevice: (token: string, platform: "ios" | "android") => call<{ ok: true }>("POST", "/devices", { token, platform }),

  provinces: () => call<string[]>("GET", "/geo/provinces"),
  towns: (q: string, limit = 8) => call<Town[]>("GET", "/geo/towns" + qs({ q, limit })),
  popularTowns: (province?: string) => call<Town[]>("GET", "/geo/popular" + qs({ province })),
  reverse: (lat: number, lng: number) => call<{ label: string; town: string; province: string; distanceKm: number; lat: number; lng: number }>("GET", "/geo/reverse" + qs({ lat, lng })),

  categories: () => call<{ type: string; count: number }[]>("GET", "/categories"),
  equipment: (q: Q = {}) => call<Equipment[]>("GET", "/equipment" + qs(q)),
  equipmentById: (id: number) => call<Equipment>("GET", `/equipment/${id}`),
  addEquipment: (b: NewEquipment) => call<Equipment>("POST", "/equipment", b),
  updateEquipment: (id: number, b: { active?: boolean; rate?: number }) => call<Equipment>("PATCH", `/equipment/${id}`, b),
  deleteEquipment: (id: number) => call<{ ok: true; hidden?: boolean }>("DELETE", `/equipment/${id}`),
  favorite: (id: number) => call<{ id: number; saved: boolean }>("POST", `/equipment/${id}/favorite`),
  addBlock: (id: number, start: string, end: string, note = "") => call<{ id: number }>("POST", `/equipment/${id}/blocks`, { start, end, note }),
  removeBlock: (id: number, blockId: number) => call<{ ok: true }>("DELETE", `/equipment/${id}/blocks/${blockId}`),

  bookings: () => call<Booking[]>("GET", "/bookings"),
  book: (equipmentId: number, startDate: string, endDate: string) => call<Booking>("POST", "/bookings", { equipmentId, startDate, endDate }),
  cancel: (id: number) => call<Booking>("POST", `/bookings/${id}/cancel`),
  review: (id: number, rating: number, comment: string) => call<{ ok: true }>("POST", `/bookings/${id}/review`, { rating, comment }),
  dashboard: () => call<Dashboard>("GET", "/owner/dashboard"),
  decide: (id: number, action: "approve" | "decline" | "cancel") => call<Booking>("POST", `/owner/requests/${id}/${action}`),
  simulate: () => call<Booking>("POST", "/owner/simulate-request"),

  operators: (q: Q = {}) => call<OperatorCard[]>("GET", "/operators" + qs(q)),
  operatorProfile: () => call<OperatorCard>("GET", "/operator/profile"),
  updateOperatorProfile: (b: Partial<Pick<OperatorCard, "years" | "certs" | "bio" | "dayRate" | "available">> & { skills?: string[] | string }) => call<OperatorCard>("PUT", "/operator/profile", b),

  notifications: () => call<{ unread: number; items: Notice[] }>("GET", "/notifications"),
  markRead: () => call<{ ok: true }>("POST", "/notifications/read"),
  support: (message: string) => call<{ ticket: string }>("POST", "/support", { message }),
  report: (targetType: "listing" | "user", targetId: number, reason: string, detail = "") => call<{ ok: true }>("POST", "/reports", { targetType, targetId, reason, detail }),
  blocks: () => call<{ id: number; name: string }[]>("GET", "/blocks"),
  toggleBlock: (userId: number) => call<{ blocked: boolean }>("POST", `/blocks/${userId}`),
  verificationStatus: () => call<{ verified: boolean; latest: { status: string; reason: string; at: string } | null }>("GET", "/verification/mine"),
  submitVerification: (note: string, document: string) => call<{ ok: true }>("POST", "/verification", { note, document }),
  accountTypeRequest: () => call<{ request: RoleChangeRequest | null }>("GET", "/account-type/request"),
  requestAccountTypeChange: (requestedRole: Role, reason = "") => call<{ ok: true; id: number }>("POST", "/account-type/request", { requestedRole, reason }),
  cancelAccountTypeRequest: () => call<{ ok: true }>("POST", "/account-type/request/cancel"),

  adminOverview: () => call<AdminOverview>("GET", "/admin/overview"),
  adminUsers: (q: Q = {}) => call<AdminUser[]>("GET", "/admin/users" + qs(q)),
  adminUpdateUser: (id: number, b: { role?: Role; status?: string; verified?: boolean }) => call<{ ok: true }>("PATCH", `/admin/users/${id}`, b),
  adminDeleteUser: (id: number) => call<{ ok: true }>("DELETE", `/admin/users/${id}`),
  adminListings: (q: Q = {}) => call<AdminListing[]>("GET", "/admin/equipment" + qs(q)),
  adminSetListing: (id: number, active: boolean) => call<{ ok: true }>("PATCH", `/admin/equipment/${id}`, { active }),
  adminDeleteListing: (id: number) => call<{ ok: true; hidden?: boolean }>("DELETE", `/admin/equipment/${id}`),
  adminBookings: () => call<Booking[]>("GET", "/admin/bookings"),
  adminRoleRequests: () => call<AdminRoleRequest[]>("GET", "/admin/role-requests"),
  adminDecideRoleRequest: (id: number, approve: boolean, note = "") => call<{ ok: true }>("POST", `/admin/role-requests/${id}/decide`, { approve, note }),
  adminVerifications: () => call<AdminVerification[]>("GET", "/admin/verifications"),
  adminDecideVerification: (id: number, approve: boolean, reason = "") => call<{ ok: true }>("POST", `/admin/verifications/${id}/decide`, { approve, reason }),
  adminReports: () => call<AdminReport[]>("GET", "/admin/reports"),
  adminSetReport: (id: number, status: string) => call<{ ok: true }>("PATCH", `/admin/reports/${id}`, { status }),
  adminTickets: () => call<AdminTicket[]>("GET", "/admin/tickets"),
  adminSetTicket: (id: number, status: string) => call<{ ok: true }>("PATCH", `/admin/tickets/${id}`, { status }),
  adminAudit: () => call<AuditEntry[]>("GET", "/admin/audit"),
  reset: async () => {
    await call<{ ok: true }>("POST", "/reset")
    await setNativeToken(null)
  },
}
