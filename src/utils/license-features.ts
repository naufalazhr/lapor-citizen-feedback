// License feature bitmap constants (must match Edge Function and admin-hub)
export const FEATURE_FLAGS = {
  BASIC:           1,    // bit 0
  ANALYTICS:       2,    // bit 1
  API_ACCESS:      4,    // bit 2
  EXPORT:          8,    // bit 3
  CUSTOM_BRANDING: 16,   // bit 4
  MULTI_TENANT:    32,   // bit 5
  AUDIT_LOG:       64,   // bit 6
  SSO:             128,  // bit 7
} as const

export const FEATURE_LABELS: Record<string, string> = {
  BASIC:           'Fitur Dasar',
  ANALYTICS:       'Analitik & Dashboard',
  API_ACCESS:      'Akses API',
  EXPORT:          'Ekspor Data',
  CUSTOM_BRANDING: 'Kustom Branding',
  MULTI_TENANT:    'Multi-Tenant',
  AUDIT_LOG:       'Audit Log',
  SSO:             'Single Sign-On (SSO)',
}

export const PLAN_TIER_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export const PLAN_TIER_COLORS: Record<string, string> = {
  starter:    'bg-slate-100 text-slate-700',
  pro:        'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
}

export function getEnabledFeatures(bitmap: number): string[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([, flag]) => (bitmap & flag) !== 0)
    .map(([name]) => FEATURE_LABELS[name] || name)
}

export function getPlanLabel(tier: string | null | undefined): string {
  if (!tier) return 'Tidak Diketahui'
  return PLAN_TIER_LABELS[tier] ?? tier
}

export function getPlanColorClass(tier: string | null | undefined): string {
  if (!tier) return 'bg-gray-100 text-gray-600'
  return PLAN_TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600'
}

export type LicenseStatus = 'unlicensed' | 'active' | 'grace_period' | 'expired'

export interface LicenseInfo {
  status: LicenseStatus
  plan: string | null
  max_users: number
  features_bitmap: number
  activated_at: string | null
  expires_at: string | null
}

export function computeLicenseStatus(expiresAt: string | null, dbStatus: string | null): LicenseStatus {
  if (!expiresAt || dbStatus === 'unlicensed' || !dbStatus) return 'unlicensed'

  const now = new Date()
  const expiry = new Date(expiresAt)
  const graceEnd = new Date(expiry)
  graceEnd.setDate(graceEnd.getDate() + 14)

  if (now <= expiry) return 'active'
  if (now <= graceEnd) return 'grace_period'
  return 'expired'
}

export function getDaysRemaining(expiresAt: string | null): number {
  if (!expiresAt) return 0
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diff = expiry.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// Format a long token string into 8-char groups with hyphens
export function formatTokenCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const groups = clean.match(/.{1,8}/g) || []
  return groups.join('-')
}

// Base32-Crockford encode (used in admin-hub for token generation)
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function base32CrockfordEncode(bytes: Uint8Array): string {
  const bits: number[] = []
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1)
    }
  }

  // Pad to multiple of 5
  while (bits.length % 5 !== 0) bits.push(0)

  let result = ''
  for (let i = 0; i < bits.length; i += 5) {
    let val = 0
    for (let j = 0; j < 5; j++) {
      val = (val << 1) | bits[i + j]
    }
    result += CROCKFORD_ALPHABET[val]
  }
  return result
}
