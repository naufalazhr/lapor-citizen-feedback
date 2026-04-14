// =============================================================================
// sla-notifications — Edge Function
// -----------------------------------------------------------------------------
// Scheduled via pg_cron (see migration 20260413000001). For each OPD with
// pending/overdue reports:
//   1. Check contact sync gate (must be synced on Fonnte device)
//   2. Check per-OPD cooldown (from notification_log)
//   3. Check daily volume cap (anti-ban)
//   4. Compose digest message (one message per OPD, all their reports)
//   5. Send via Fonnte (dedicated notification device)
//   6. Log result to notification_log
//   7. Wait delay_between_sends_ms + jitter (anti-ban)
//
// Auth: expects the service role key (called by pg_cron) OR can be triggered
// manually by an admin via authenticated POST for testing.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { queryReportsForDigest } from './query-reports.ts';
import { composeDigestMessage } from './compose-message.ts';
import {
  sendNotificationWhatsApp,
  normalizeIndonesianPhone,
  antibanDelay,
} from './notification-whatsapp.ts';

interface NotificationSettings {
  id: string;
  tenant_id: string | null;
  notify_pending: boolean;
  notify_overdue: boolean;
  pending_threshold_hours: number;
  overdue_threshold_hours: number;
  channel_whatsapp: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
  max_daily_messages: number;
  delay_between_sends_ms: number;
  cooldown_hours: number;
  is_enabled: boolean;
}

interface RunSummary {
  batch_id: string;
  started_at: string;
  finished_at?: string;
  total_candidates: number;
  sent: number;
  failed: number;
  skipped_cooldown: number;
  skipped_unsynced: number;
  skipped_no_phone: number;
  stopped_reason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth: require service role key in Authorization header (pg_cron passes it).
  // Also allow a valid admin JWT for manual testing from the admin UI.
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.replace('Bearer ', '');

  if (!bearerToken) {
    return jsonResponse(401, { error: 'Unauthorized — missing token' });
  }

  // If it matches the service role key, accept directly. Otherwise, treat as
  // a user JWT and verify admin role.
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (bearerToken !== supabaseServiceKey) {
    const supabaseAnon = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: authData } = await supabaseAnon.auth.getUser(bearerToken);
    if (!authData?.user) {
      return jsonResponse(401, { error: 'Unauthorized — invalid token' });
    }
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const allowed = roles.some((r) =>
      ['superadmin', 'owner', 'admin'].includes(r)
    );
    if (!allowed) {
      return jsonResponse(403, { error: 'Forbidden — admin role required' });
    }
  }

  // --- Parse request body for mode flags (dry_run) ---
  let dryRun = false;
  try {
    const body = (await req.json()) as { dry_run?: boolean } | null;
    dryRun = body?.dry_run === true;
  } catch {
    // no body — treat as normal run
  }

  const batchId = crypto.randomUUID();
  const summary: RunSummary = {
    batch_id: batchId,
    started_at: new Date().toISOString(),
    total_candidates: 0,
    sent: 0,
    failed: 0,
    skipped_cooldown: 0,
    skipped_unsynced: 0,
    skipped_no_phone: 0,
  };

  try {
    // --- 1. Load settings ---
    const { data: settingsRow, error: settingsError } = await supabase
      .from('notification_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settingsRow) {
      return jsonResponse(200, {
        ...summary,
        dry_run: dryRun,
        blocked: true,
        stopped_reason: 'no_settings_row',
        finished_at: new Date().toISOString(),
      });
    }

    const settings = settingsRow as NotificationSettings;

    if (!settings.is_enabled) {
      return jsonResponse(200, {
        ...summary,
        dry_run: dryRun,
        blocked: true,
        stopped_reason: 'disabled',
        finished_at: new Date().toISOString(),
      });
    }

    if (!settings.channel_whatsapp) {
      return jsonResponse(200, {
        ...summary,
        dry_run: dryRun,
        blocked: true,
        stopped_reason: 'whatsapp_channel_off',
        finished_at: new Date().toISOString(),
      });
    }

    // --- 2. Quiet hours check ---
    if (
      settings.quiet_start &&
      settings.quiet_end &&
      isInQuietHours(
        new Date(),
        settings.quiet_start,
        settings.quiet_end,
        settings.timezone
      )
    ) {
      return jsonResponse(200, {
        ...summary,
        dry_run: dryRun,
        blocked: true,
        stopped_reason: 'quiet_hours',
        finished_at: new Date().toISOString(),
      });
    }

    // --- 3. Load WhatsApp config ---
    const { data: waConfig, error: waConfigError } = await supabase
      .from('notification_whatsapp_config')
      .select('api_token, device_number')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (waConfigError || !waConfig?.api_token) {
      return jsonResponse(200, {
        ...summary,
        dry_run: dryRun,
        blocked: true,
        stopped_reason: 'no_whatsapp_config',
        finished_at: new Date().toISOString(),
      });
    }

    // --- 4. Daily volume cap (pre-check) ---
    const dayStart = startOfDayIso(settings.timezone);
    const { count: sentToday } = await supabase
      .from('notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .eq('channel', 'whatsapp')
      .gte('created_at', dayStart);

    const sentTodayCount = sentToday ?? 0;
    const remainingQuota = Math.max(
      0,
      settings.max_daily_messages - sentTodayCount
    );

    if (remainingQuota === 0) {
      return jsonResponse(200, {
        ...summary,
        dry_run: dryRun,
        blocked: true,
        stopped_reason: 'daily_cap_reached',
        finished_at: new Date().toISOString(),
      });
    }

    // --- 5. Query candidate OPD digests ---
    const { digests, unsyncedOpds } = await queryReportsForDigest({
      supabase,
      pendingThresholdHours: settings.pending_threshold_hours,
      overdueThresholdHours: settings.overdue_threshold_hours,
      notifyPending: settings.notify_pending,
      notifyOverdue: settings.notify_overdue,
    });

    summary.total_candidates = digests.length + unsyncedOpds.length;

    // Count unsynced outcomes into summary regardless of mode (so dry-run response includes them)
    for (const u of unsyncedOpds) {
      if (u.skip_reason === 'no_phone') summary.skipped_no_phone++;
      if (u.skip_reason === 'contact_not_synced') summary.skipped_unsynced++;
    }

    // --- 6. Batch-insert skipped (unsynced/no_phone) OPDs up front (skip on dry run) ---
    if (!dryRun && unsyncedOpds.length > 0) {
      await supabase.from('notification_log').insert(
        unsyncedOpds.map((u) => ({
          recipient_opd_id: u.opd_id,
          recipient_user_id: null,
          channel: 'whatsapp',
          recipient_address: u.phone,
          report_ids: u.report_ids,
          report_count: u.report_ids.length,
          status: 'skipped',
          skip_reason: u.skip_reason,
          provider: 'fonnte',
          batch_id: batchId,
        }))
      );
    }

    // --- 7. Pre-fetch cooldown state for all candidate OPDs in one query ---
    const cooldownHours = settings.cooldown_hours ?? 6;
    const cooldownCutoff = new Date(
      Date.now() - cooldownHours * 60 * 60 * 1000
    ).toISOString();

    const cooledDownOpdIds = new Set<string>();
    if (digests.length > 0) {
      const { data: recentLogs } = await supabase
        .from('notification_log')
        .select('recipient_opd_id')
        .in(
          'recipient_opd_id',
          digests.map((d) => d.opd_id)
        )
        .eq('status', 'sent')
        .eq('channel', 'whatsapp')
        .gte('created_at', cooldownCutoff);

      for (const row of (recentLogs ?? []) as Array<{ recipient_opd_id: string | null }>) {
        if (row.recipient_opd_id) cooledDownOpdIds.add(row.recipient_opd_id);
      }
    }

    // --- DRY RUN: return analysis without sending or logging ---
    if (dryRun) {
      let wouldSend = 0;
      let wouldSkipCooldown = 0;
      for (const d of digests) {
        if (cooledDownOpdIds.has(d.opd_id)) wouldSkipCooldown++;
        else wouldSend++;
      }
      const wouldSendCapped = Math.min(wouldSend, remainingQuota);
      const totalReportsInSendQueue = digests
        .filter((d) => !cooledDownOpdIds.has(d.opd_id))
        .slice(0, remainingQuota)
        .reduce((acc, d) => acc + d.reports.length, 0);

      return jsonResponse(200, {
        ...summary,
        dry_run: true,
        blocked: false,
        would_send: wouldSendCapped,
        would_skip_cooldown: wouldSkipCooldown,
        would_skip_unsynced: summary.skipped_unsynced,
        would_skip_no_phone: summary.skipped_no_phone,
        would_cap_clip: Math.max(0, wouldSend - remainingQuota),
        total_reports_in_send_queue: totalReportsInSendQueue,
        daily_quota_remaining: remainingQuota,
        daily_quota_max: settings.max_daily_messages,
        estimated_duration_seconds: Math.ceil(
          wouldSendCapped *
            ((settings.delay_between_sends_ms ?? 4000) / 1000 + 2) // delay + avg send RTT
        ),
        finished_at: new Date().toISOString(),
      });
    }

    // --- 8. Iterate digests, apply cooldown gate, send, log ---
    let sentThisRun = 0;
    const cooldownSkipRows: Array<Record<string, unknown>> = [];

    for (const digest of digests) {
      if (sentThisRun >= remainingQuota) {
        summary.stopped_reason = 'daily_cap_reached_midrun';
        break;
      }

      if (cooledDownOpdIds.has(digest.opd_id)) {
        cooldownSkipRows.push({
          recipient_opd_id: digest.opd_id,
          recipient_user_id: null,
          channel: 'whatsapp',
          recipient_address: digest.phone,
          report_ids: digest.reports.map((r) => r.id),
          report_count: digest.reports.length,
          status: 'skipped',
          skip_reason: 'cooldown',
          provider: 'fonnte',
          batch_id: batchId,
        });
        summary.skipped_cooldown++;
        continue;
      }

      // Compose + send
      const composed = composeDigestMessage(digest, settings.timezone);
      const phone = normalizeIndonesianPhone(digest.phone);

      const result = await sendNotificationWhatsApp({
        target: phone,
        message: composed.body,
        token: waConfig.api_token,
      });

      if (result.success) {
        await supabase.from('notification_log').insert({
          recipient_opd_id: digest.opd_id,
          recipient_user_id: null,
          channel: 'whatsapp',
          recipient_address: phone,
          report_ids: composed.reportIds,
          report_count: composed.reportIds.length,
          message_body: composed.body,
          status: 'sent',
          provider: 'fonnte',
          batch_id: batchId,
          sent_at: new Date().toISOString(),
        });
        summary.sent++;
        sentThisRun++;
      } else {
        await supabase.from('notification_log').insert({
          recipient_opd_id: digest.opd_id,
          recipient_user_id: null,
          channel: 'whatsapp',
          recipient_address: phone,
          report_ids: composed.reportIds,
          report_count: composed.reportIds.length,
          message_body: composed.body,
          status: 'failed',
          error_message: result.error,
          provider: 'fonnte',
          batch_id: batchId,
        });
        summary.failed++;
      }

      // Anti-ban delay between sends
      await antibanDelay(settings.delay_between_sends_ms);
    }

    // Flush any cooldown-skip rows accumulated during the loop in one insert
    if (cooldownSkipRows.length > 0) {
      await supabase.from('notification_log').insert(cooldownSkipRows);
    }

    summary.finished_at = new Date().toISOString();
    return jsonResponse(200, summary);
  } catch (err) {
    console.error('sla-notifications error:', err);
    summary.finished_at = new Date().toISOString();
    summary.stopped_reason = `error: ${
      err instanceof Error ? err.message : 'unknown'
    }`;
    return jsonResponse(500, summary);
  }
});

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Compute the start-of-day timestamp in the given timezone, returned as an
 * ISO UTC string. Used to count today's sent messages.
 */
function startOfDayIso(timezone: string): string {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // e.g. "2026-04-13"

  const offsetStr = getTimezoneOffsetString(now, timezone);
  return new Date(`${dateStr}T00:00:00${offsetStr}`).toISOString();
}

function getTimezoneOffsetString(date: Date, timezone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const asUTC = Date.UTC(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );
  const offsetMinutes = (asUTC - date.getTime()) / 60000;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(Math.floor(abs % 60)).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Check whether `now` is within the quiet window [quietStart, quietEnd]
 * interpreted in the given timezone. Supports windows that wrap midnight
 * (e.g. 22:00–07:00).
 */
function isInQuietHours(
  now: Date,
  quietStartHHMM: string,
  quietEndHHMM: string,
  timezone: string
): boolean {
  const start = toMinutes(quietStartHHMM);
  const end = toMinutes(quietEndHHMM);
  if (start == null || end == null || start === end) return false;

  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now); // "HH:MM" in the target timezone
  const currentMinutes = toMinutes(hhmm) ?? 0;

  // Window wraps midnight when start > end
  return start < end
    ? currentMinutes >= start && currentMinutes < end
    : currentMinutes >= start || currentMinutes < end;
}

function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
