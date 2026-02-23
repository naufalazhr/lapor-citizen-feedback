/**
 * PII Masking Utility — Reporter Data Privacy
 *
 * Implements role-based PII masking following the L0/L1/L2/L3 standard
 * defined in docs/pii-masking-implementation.md.
 *
 * This is a pure utility module — no React, no Supabase calls.
 * All functions are synchronous and side-effect free.
 *
 * Masking Levels:
 *   L0 — Full Access (admin, owner, superadmin)
 *   L1 — Partial Mask (member, opd_member)
 *   L2 — De-identified (viewer)
 *   L3 — Anonymous (public)
 */

export type MaskingLevel = 'L0' | 'L1' | 'L2' | 'L3';

export type UserRole =
  | 'superadmin'
  | 'owner'
  | 'admin'
  | 'member'
  | 'opd_member'
  | 'viewer'
  | null;

export const HIDDEN_VALUE = '—';

// ─── RBAC Engine ────────────────────────────────────────────────────────────

/**
 * Returns the default masking level for a given role.
 * This is the baseline RBAC mapping — no overrides, no async lookups.
 *
 * Role → Level:
 *   superadmin / owner / admin  → L0 (full access)
 *   member / opd_member         → L1 (partial mask)
 *   viewer                      → L2 (de-identified)
 *   null / unknown              → L3 (anonymous)
 */
export function getDefaultMaskingLevel(role: UserRole): MaskingLevel {
  switch (role) {
    case 'superadmin':
    case 'owner':
    case 'admin':
      return 'L0';
    case 'member':
    case 'opd_member':
      return 'L1';
    case 'viewer':
      return 'L2';
    default:
      return 'L3';
  }
}

// ─── Field-Level Masking Functions ──────────────────────────────────────────

/**
 * Mask a reporter's full name.
 *
 * L0: "Ahmad Fauzi Ramadhan"   (full)
 * L1: "Ahmad F."               (first name + last name initial)
 * L2: "A***"                   (first letter + stars)
 * L3: "—"                      (hidden)
 */
export function maskName(name: string, level: MaskingLevel): string {
  if (!name || !name.trim()) return HIDDEN_VALUE;
  if (level === 'L0') return name;

  const parts = name.trim().split(/\s+/);

  if (level === 'L1') {
    if (parts.length === 1) return parts[0]; // single name: show as-is
    const lastName = parts[parts.length - 1];
    return `${parts[0]} ${lastName.charAt(0).toUpperCase()}.`;
  }

  if (level === 'L2') {
    return `${name.charAt(0).toUpperCase()}***`;
  }

  // L3
  return HIDDEN_VALUE;
}

/**
 * Mask a phone number.
 *
 * L0: "08123456789"    (full)
 * L1: "0812****789"    (first 4 + stars + last 3)
 * L2: "—"             (hidden)
 * L3: "—"             (hidden)
 */
export function maskPhone(
  phone: string | null | undefined,
  level: MaskingLevel
): string {
  if (!phone || !phone.trim()) return HIDDEN_VALUE;
  if (level === 'L0') return phone;

  if (level === 'L1') {
    const cleaned = phone.trim();
    if (cleaned.length <= 7) {
      // Too short to mask meaningfully — show first char + stars
      return `${cleaned.charAt(0)}****`;
    }
    const prefix = cleaned.slice(0, 4);
    const suffix = cleaned.slice(-3);
    const stars = '*'.repeat(Math.min(4, cleaned.length - 7));
    return `${prefix}${stars}${suffix}`;
  }

  // L2, L3
  return HIDDEN_VALUE;
}

/**
 * Mask a physical address.
 * Works on free-text addresses (comma-separated segments).
 *
 * L0: "Jl. Sudirman No.5, Kel. Menteng, Kec. Menteng, Jakarta Pusat"
 * L1: "Kel. Menteng, Kec. Menteng, Jakarta Pusat"  (remove first segment = street + number)
 * L2: "Jakarta Pusat"                               (last segment only = city/kabupaten)
 * L3: "—"
 *
 * Fallback (no commas): L1 returns full string, L2 returns full string
 * (fail-safe: never over-mask to hide the entire address for opd_member).
 */
export function maskAddress(
  address: string | null | undefined,
  level: MaskingLevel
): string {
  if (!address || !address.trim()) return HIDDEN_VALUE;
  if (level === 'L0') return address;

  if (level === 'L3') return HIDDEN_VALUE;

  const segments = address.split(',').map((s) => s.trim()).filter(Boolean);

  if (level === 'L1') {
    if (segments.length <= 1) return address; // no commas — return full (fail safe)
    return segments.slice(1).join(', ');
  }

  if (level === 'L2') {
    if (segments.length <= 1) return address; // no commas — return full (fail safe)
    return segments[segments.length - 1];
  }

  return HIDDEN_VALUE;
}

/**
 * Mask GPS coordinates.
 *
 * L0: { lat: -6.175392, lng: 106.827153 }  (meter-level precision)
 * L1: { lat: -6.18, lng: 106.83 }          (2 decimal places ≈ ±500m neighborhood)
 * L2: null                                  (no location shown)
 * L3: null
 */
export function maskGeoLocation(
  geo: { lat: number; lng: number } | null | undefined,
  level: MaskingLevel
): { lat: number; lng: number } | null {
  if (!geo) return null;
  if (level === 'L0') return geo;

  if (level === 'L1') {
    return {
      lat: Math.round(geo.lat * 100) / 100,
      lng: Math.round(geo.lng * 100) / 100,
    };
  }

  // L2, L3
  return null;
}

// ─── Composite Masking ───────────────────────────────────────────────────────

/**
 * Minimum shape required for applyMasking to work.
 */
export interface PIIMaskable {
  reporter_name: string;
  phone: string;
  address: string;
  geo_location?: { lat: number; lng: number } | null;
}

/**
 * Apply masking to all PII fields of a report object at once.
 * Returns a shallow copy with PII fields transformed — the original is not mutated.
 *
 * Usage:
 *   const displayReport = applyMasking(report, level);
 *   // displayReport.reporter_name, .phone, .address, .geo_location are masked
 *   // all other fields (id, status, ticket_id, etc.) are untouched
 */
export function applyMasking<T extends PIIMaskable>(report: T, level: MaskingLevel): T {
  if (level === 'L0') return report; // No transformation needed for full access

  return {
    ...report,
    reporter_name: maskName(report.reporter_name, level),
    phone: maskPhone(report.phone, level),
    address: maskAddress(report.address, level),
    geo_location: maskGeoLocation(report.geo_location, level),
  };
}
