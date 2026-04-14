// =============================================================================
// Compose Message — Build the Bahasa Indonesia digest WhatsApp message
// -----------------------------------------------------------------------------
// One message per OPD, containing all their pending/overdue reports.
//
// Anti-ban notes:
//   - Rotate greetings based on time-of-day so messages are not identical
//   - Include current timestamp to make each message unique
//   - Keep total length under ~1500 characters
//   - Truncate each report description to ~60 chars
// =============================================================================

import type { OpdDigest, ReportDigestItem } from './query-reports.ts';

const MAX_REPORTS_PER_MESSAGE = 10;
const MAX_DESCRIPTION_LENGTH = 60;
const MAX_TOTAL_LENGTH = 1500;

/**
 * Get a time-appropriate greeting in Bahasa Indonesia based on the tenant's
 * timezone (default Asia/Jakarta).
 */
function getGreeting(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);

  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Format the local date+time string for the footer.
 */
function formatTimestamp(timezone: string): string {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const timeStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return `${dateStr} pukul ${timeStr} WIB`;
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trim() + '…';
}

function ageLabel(hours: number): string {
  if (hours < 1) return '< 1 jam';
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari`;
  const weeks = Math.floor(days / 7);
  return `${weeks} minggu`;
}

function statusLabel(report: ReportDigestItem): string {
  if (report.is_overdue) return `Terlambat ${ageLabel(report.age_hours)}`;
  if (report.status === 'pending') return `Pending ${ageLabel(report.age_hours)}`;
  if (report.status === 'in_progress')
    return `Diproses ${ageLabel(report.age_hours)}`;
  return report.status;
}

export interface ComposedMessage {
  body: string;
  reportIds: string[];
  truncated: boolean;
}

/**
 * Compose a digest message for one OPD, listing all their pending/overdue
 * reports. The greeting addresses "Tim {opd_name}" (the team of the OPD),
 * not a specific person — because the notification goes to a shared line.
 */
export function composeDigestMessage(
  digest: OpdDigest,
  timezone = 'Asia/Jakarta'
): ComposedMessage {
  const greeting = getGreeting(timezone);
  const timestamp = formatTimestamp(timezone);

  const reports = digest.reports.slice(0, MAX_REPORTS_PER_MESSAGE);
  const truncated = digest.reports.length > MAX_REPORTS_PER_MESSAGE;
  const remaining = digest.reports.length - reports.length;

  const lines: string[] = [];
  lines.push('[LAPOR — Pengingat SLA]');
  lines.push('');
  lines.push(`${greeting}, Tim ${digest.opd_name}.`);
  lines.push(
    `Ada ${digest.reports.length} laporan yang perlu ditindaklanjuti:`
  );
  lines.push('');

  reports.forEach((r, idx) => {
    const ticket = r.ticket_id ? `#${r.ticket_id}` : `#${r.id.slice(0, 8)}`;
    const desc = truncate(r.description, MAX_DESCRIPTION_LENGTH);
    lines.push(`${idx + 1}. ${ticket} — ${desc} (${statusLabel(r)})`);
  });

  if (truncated && remaining > 0) {
    lines.push(`…dan ${remaining} laporan lainnya.`);
  }

  lines.push('');
  lines.push('Mohon buka dashboard untuk menindaklanjuti.');
  lines.push(`— ${timestamp}`);

  let body = lines.join('\n');

  // Hard safety cap
  if (body.length > MAX_TOTAL_LENGTH) {
    body = body.slice(0, MAX_TOTAL_LENGTH - 3) + '...';
  }

  return {
    body,
    reportIds: reports.map((r) => r.id),
    truncated,
  };
}
