// =============================================================================
// License Token Generator Utility
// Generates Ed25519-signed license tokens (superadmin only).
//
// The private key is read from VITE_LICENSE_PRIVATE_KEY env var.
// Only set this env var on self-hosted/client deployments where the superadmin
// needs to generate tokens locally. Never set it on staging/production.
// =============================================================================

import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2'
import { base32CrockfordEncode, formatTokenCode, FEATURE_FLAGS } from './license-features'

// @noble/ed25519 v3: set hashes.sha512 to enable synchronous operations
ed.hashes.sha512 = sha512

export interface TokenPayload {
  version: 1
  token_id: number    // uint32 (1–4294967295)
  customer_id: number // uint16 (0–65535)
  plan_tier: 1 | 2 | 3  // 1=Starter, 2=Pro, 3=Enterprise
  max_users: number   // uint16 (0=unlimited)
  duration_days: number // uint16
  issued_at: number   // uint32 Unix timestamp (seconds)
  features_bitmap: number // uint32
}

export const PLAN_TIER_MAP = {
  starter:    1 as const,
  pro:        2 as const,
  enterprise: 3 as const,
}

export function buildPayloadBytes(payload: TokenPayload): Uint8Array {
  const buf = new ArrayBuffer(20)
  const view = new DataView(buf)
  view.setUint8(0, payload.version)
  view.setUint32(1, payload.token_id, false)    // big-endian
  view.setUint16(5, payload.customer_id, false)
  view.setUint8(7, payload.plan_tier)
  view.setUint16(8, payload.max_users, false)
  view.setUint16(10, payload.duration_days, false)
  view.setUint32(12, payload.issued_at, false)
  view.setUint32(16, payload.features_bitmap, false)
  return new Uint8Array(buf)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Generate a complete signed license token.
 * Returns the formatted token string (ready to deliver to customer).
 */
export async function generateLicenseToken(
  payload: TokenPayload,
  privateKeyHex: string
): Promise<string> {
  const payloadBytes = buildPayloadBytes(payload)
  const privateKeyBytes = hexToBytes(privateKeyHex)

  const signature = ed.sign(payloadBytes, privateKeyBytes)

  const tokenBytes = new Uint8Array(84)
  tokenBytes.set(payloadBytes, 0)
  tokenBytes.set(signature, 20)

  const encoded = base32CrockfordEncode(tokenBytes)
  return formatTokenCode(encoded)
}

export function getDefaultFeaturesForPlan(planTier: keyof typeof PLAN_TIER_MAP): number {
  switch (planTier) {
    case 'starter':
      return FEATURE_FLAGS.BASIC
    case 'pro':
      return FEATURE_FLAGS.BASIC | FEATURE_FLAGS.ANALYTICS | FEATURE_FLAGS.API_ACCESS | FEATURE_FLAGS.EXPORT
    case 'enterprise':
      return (
        FEATURE_FLAGS.BASIC |
        FEATURE_FLAGS.ANALYTICS |
        FEATURE_FLAGS.API_ACCESS |
        FEATURE_FLAGS.EXPORT |
        FEATURE_FLAGS.CUSTOM_BRANDING |
        FEATURE_FLAGS.MULTI_TENANT |
        FEATURE_FLAGS.AUDIT_LOG |
        FEATURE_FLAGS.SSO
      )
  }
}
