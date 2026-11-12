export type Role = "Farmer" | "Equipment Owner" | "Operator" | "Admin"

export type Profile = {
  id: number
  email: string
  name: string
  location: string
  province: string
  phone: string
  shareContact: boolean
  role: Role
  radius: number
  lat: number
  lng: number
  verified: boolean
  emailVerified: boolean
  totpEnabled: boolean
  needs2faSetup: boolean
  requireVerifiedEmail: boolean
  consentVersion: string | null
  demo: boolean
}

export type Place = { location: string; lat: number; lng: number; province?: string }
export type Town = { label: string; town: string; province: string; lat: number; lng: number }
export type Contact = { id: number; name: string; initials: string; role: Role | string; verified?: boolean; phone: string | null; email: string | null }
export type AppConfig = { demo: boolean; termsVersion: string }

export type OperatorCard = {
  id: number
  name: string
  initials: string
  location: string
  province: string
  verified: boolean
  km: number | null
  years: number
  certs: string
  skills: string[]
  dayRate: number
  available: boolean
  bio: string
  rating: string
  phone: string | null
  email: string | null
}

export type Operator = {
  id: number
  name: string
  initials: string
  verified: boolean
  years: number
  certs: string
  rating: string
  dayRate: number
  self: boolean
  phone: string | null
  email: string | null
}

export type Block = { id?: number; start: string; end: string; why: "blocked" | "booked"; note?: string }
export type Review = { rating: number; comment: string; at: string; name: string }

export type Equipment = {
  id: number
  name: string
  type: string
  place: string
  province: string
  km: number
  rate: number
  rating: string
  reviews: number
  img: string
  gallery: string[]
  operator: boolean
  mine: boolean
  active: boolean
  saved: boolean
  exactLocation: boolean
  owner: { id: number; name: string; initials: string; since: number; verified: boolean; phone: string | null; email: string | null }
  operatorInfo: Operator | null
  specs: [string, string][]
  description: string
  bookings?: number
  lat: number
  lng: number
  blocked?: Block[]
  recentReviews?: Review[]
}

export type Booking = {
  id: number
  ref: string
  equipment: { id: number; name: string; img: string; place: string; rate: number; owner: string }
  farmer: string
  rate: number
  startDate: string
  endDate: string
  days: number
  period: string
  estimate: number
  status: "Pending" | "Confirmed" | "Rejected" | "Cancelled" | "Completed" | "Expired"
  reviewed: boolean
  createdAt: string
  contact: Contact
}

export type Dashboard = {
  stats: { activeListings: number; pendingRequests: number; bookedDays: number; profileViews: number }
  requests: Booking[]
  equipment: Equipment[]
}

export type RoleChangeRequest = {
  id: number
  currentRole: Role
  requestedRole: Role
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  reviewNote: string
  createdAt: string
  decidedAt?: string | null
}

export type AdminRoleRequest = {
  id: number
  user_id: number
  name: string
  email: string
  location: string
  province: string
  current_role: Role
  requested_role: Role
  user_current_role: Role
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  review_note: string
  created_at: string
  decided_at?: string | null
}

export type AdminOverview = {
  users: { total: number; byRole: Record<string, number>; suspended: number }
  listings: { total: number; active: number }
  bookings: Record<string, number>
  openTickets: number
  openReports: number
  pendingVerifications: number
  pendingRoleRequests?: number
  byProvince: { province: string; users: number; listings: number }[]
}

export type AdminUser = {
  id: number
  name: string
  email: string
  role: Role
  status: string
  location: string
  province: string
  since: number
  verified: boolean
  emailVerified: boolean
  twoFactor: boolean
  listings: number
  bookings: number
  pendingRole?: Role | null
}

export type AdminListing = {
  id: number
  name: string
  type: string
  place: string
  province: string
  rate: number
  active: boolean
  owner: string
}

export type Notice = { id: number; title: string; body: string; time: string; read: boolean }
