// src/utils/sla-timer.ts
//
// Pure utility for SLA timer calculations on conversation sessions.
// No React, no Supabase, no side effects. All functions are synchronous.
//
// SLA Model:
//   - Idle Time:    now - last_message_at  (citizen waiting time — primary SLA metric)
//   - Total Age:    now - started_at        (overall conversation duration)
//   - SLA Window:   session_timeout_minutes (from fonnte_config, default 30 min)
//
// Urgency bands based on idle time as % of the SLA window:
//   green:    idle < 50%  of SLA window
//   yellow:   idle 50–75% of SLA window
//   red:      idle 75–100% of SLA window
//   breached: idle >= 100% of SLA window

export type SLAUrgency = 'green' | 'yellow' | 'red' | 'breached';

export interface SLATimerState {
  // Time since citizen's last message (for reference / historical display)
  idleSeconds: number;
  idleFormatted: string;   // e.g. "4m 32d" | "1j 5m"

  // Time since conversation started
  totalSeconds: number;
  totalFormatted: string;

  // Countdown: time REMAINING before SLA window closes (clamped at 0)
  remainingSeconds: number;
  remainingFormatted: string;  // e.g. "12m 4d" — formatted remaining time

  // Urgency based on idle time vs SLA window
  urgency: SLAUrgency;

  // Idle as % of SLA window (0–100+, used for urgency thresholds)
  slaPercent: number;

  // Remaining as % of SLA window (0–100, for the draining bar)
  remainingPercent: number;

  // True when idle >= SLA window (countdown is at zero)
  isBreached: boolean;

  // True only for active conversations (timer should tick)
  isLive: boolean;
}

/**
 * Format a duration in seconds to a compact Indonesian-style string.
 *
 * Examples:
 *   45    → "45d"         (d = detik / seconds)
 *   90    → "1m 30d"      (m = menit / minutes)
 *   3660  → "1j 1m"       (j = jam / hours)
 *   3600  → "1j"
 */
export function formatSLADuration(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds));
  if (s < 60) {
    return `${s}d`;
  }
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}d` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}

/**
 * Compute urgency band from idle seconds and the SLA window.
 */
export function getSLAUrgency(
  idleSeconds: number,
  slaWindowMinutes: number
): SLAUrgency {
  const windowSeconds = slaWindowMinutes * 60;
  if (windowSeconds <= 0) return 'green';
  const pct = (idleSeconds / windowSeconds) * 100;
  if (pct >= 100) return 'breached';
  if (pct >= 75) return 'red';
  if (pct >= 50) return 'yellow';
  return 'green';
}

interface ConvForSLA {
  status: 'active' | 'completed' | 'abandoned';
  last_message_at: string;
  started_at: string;
  completed_at: string | null;
}

/**
 * Compute the full SLATimerState for a conversation.
 * For active conversations, reference = now (live ticking).
 * For completed/abandoned, reference = completed_at (frozen at terminal moment).
 */
export function computeSLAState(
  conv: ConvForSLA,
  slaWindowMinutes: number,
  now: Date = new Date()
): SLATimerState {
  const isLive = conv.status === 'active';

  // Reference point: for ended convs, freeze at completed_at (or last_message_at as fallback)
  const refPoint = isLive
    ? now
    : new Date(conv.completed_at ?? conv.last_message_at);

  const idleSeconds = Math.max(
    0,
    (refPoint.getTime() - new Date(conv.last_message_at).getTime()) / 1000
  );
  const totalSeconds = Math.max(
    0,
    (refPoint.getTime() - new Date(conv.started_at).getTime()) / 1000
  );

  const urgency = isLive
    ? getSLAUrgency(idleSeconds, slaWindowMinutes)
    : 'green'; // Closed conversations don't show urgency

  const windowSeconds = slaWindowMinutes * 60;
  const slaPercent = windowSeconds > 0
    ? (idleSeconds / windowSeconds) * 100
    : 0;

  const remainingSeconds = Math.max(0, windowSeconds - idleSeconds);
  const remainingPercent = Math.max(0, 100 - slaPercent);
  const isBreached = remainingSeconds === 0 && isLive;

  return {
    idleSeconds,
    idleFormatted: formatSLADuration(idleSeconds),
    totalSeconds,
    totalFormatted: formatSLADuration(totalSeconds),
    remainingSeconds,
    remainingFormatted: formatSLADuration(remainingSeconds),
    urgency,
    slaPercent,
    remainingPercent,
    isBreached,
    isLive,
  };
}

/**
 * Quick check: has idle time exceeded the SLA window?
 */
export function isSLABreached(
  lastMessageAt: string,
  slaWindowMinutes: number,
  now: Date = new Date()
): boolean {
  const idleSeconds =
    (now.getTime() - new Date(lastMessageAt).getTime()) / 1000;
  return idleSeconds >= slaWindowMinutes * 60;
}
