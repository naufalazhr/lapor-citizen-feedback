// =============================================================================
// Query Reports — Build the list of pending/overdue reports per OPD
// -----------------------------------------------------------------------------
// Returns one digest per OPD (not per user). Each OPD gets ONE WhatsApp
// message at its `opds.contact_phone`. This matches Indonesian government
// office practice where departments share one contact line.
//
// Returns two lists:
//   - digests: OPDs that are ready to receive a notification (contact synced)
//   - unsyncedOpds: OPDs that should be skipped (no phone, or not synced)
// =============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ReportDigestItem {
  id: string;
  ticket_id: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  age_hours: number;
  is_overdue: boolean;
}

export interface OpdDigest {
  opd_id: string;
  opd_name: string;
  opd_code: string | null;
  phone: string;
  reports: ReportDigestItem[];
}

export interface UnsyncedOpd {
  opd_id: string;
  opd_name: string;
  phone: string | null;
  skip_reason: 'no_phone' | 'contact_not_synced';
  report_ids: string[];
}

export interface QueryReportsParams {
  supabase: SupabaseClient;
  pendingThresholdHours: number;
  overdueThresholdHours: number;
  notifyPending: boolean;
  notifyOverdue: boolean;
}

/**
 * Fetch all pending/overdue reports, group by assigned OPD, and determine
 * which OPDs are ready to receive notifications.
 *
 * An OPD is ready only if:
 *   1. It has a `contact_phone` set
 *   2. Its `notification_contacts` row has `sync_status = 'synced'`
 *
 * OPDs that have matching reports but fail either check are returned in
 * `unsyncedOpds` so the caller can log them as skipped.
 */
export async function queryReportsForDigest(
  params: QueryReportsParams
): Promise<{ digests: OpdDigest[]; unsyncedOpds: UnsyncedOpd[] }> {
  const {
    supabase,
    pendingThresholdHours,
    overdueThresholdHours,
    notifyPending,
    notifyOverdue,
  } = params;

  const now = Date.now();
  const pendingCutoffIso = new Date(
    now - pendingThresholdHours * 60 * 60 * 1000
  ).toISOString();
  const overdueCutoffIso = new Date(
    now - overdueThresholdHours * 60 * 60 * 1000
  ).toISOString();

  // --- 1. Fetch candidate reports ---
  const statusesToInclude: string[] = [];
  if (notifyPending) statusesToInclude.push('pending');
  if (notifyOverdue) statusesToInclude.push('in_progress');

  if (statusesToInclude.length === 0) {
    return { digests: [], unsyncedOpds: [] };
  }

  const { data: reports, error: reportsError } = await supabase
    .from('reports')
    .select(
      `
      id,
      ticket_id,
      description,
      status,
      created_at,
      updated_at,
      assigned_opd_id
    `
    )
    .in('status', statusesToInclude)
    .not('assigned_opd_id', 'is', null);

  if (reportsError) {
    console.error('Error querying reports:', reportsError);
    return { digests: [], unsyncedOpds: [] };
  }

  if (!reports || reports.length === 0) {
    return { digests: [], unsyncedOpds: [] };
  }

  // --- 2. Filter by threshold ---
  const relevantReports = reports.filter((r) => {
    if (r.status === 'pending' && notifyPending) {
      return new Date(r.created_at).toISOString() <= pendingCutoffIso;
    }
    if (r.status === 'in_progress' && notifyOverdue) {
      return new Date(r.updated_at).toISOString() <= overdueCutoffIso;
    }
    return false;
  });

  if (relevantReports.length === 0) {
    return { digests: [], unsyncedOpds: [] };
  }

  // --- 3. Group reports by OPD ---
  const reportsByOpd = new Map<string, ReportDigestItem[]>();
  for (const r of relevantReports) {
    const opdId = r.assigned_opd_id as string;
    if (!opdId) continue;

    const ageHours = Math.max(
      0,
      Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60))
    );
    const isOverdue =
      r.status === 'in_progress' &&
      new Date(r.updated_at).toISOString() <= overdueCutoffIso;

    const item: ReportDigestItem = {
      id: r.id,
      ticket_id: r.ticket_id ?? r.id.slice(0, 8),
      description: r.description ?? '',
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      age_hours: ageHours,
      is_overdue: isOverdue,
    };

    if (!reportsByOpd.has(opdId)) reportsByOpd.set(opdId, []);
    reportsByOpd.get(opdId)!.push(item);
  }

  const opdIds = Array.from(reportsByOpd.keys());
  if (opdIds.length === 0) {
    return { digests: [], unsyncedOpds: [] };
  }

  // --- 4. Fetch OPD metadata + notification_contacts sync state in parallel ---
  const [opdsRes, contactsRes] = await Promise.all([
    supabase
      .from('opds')
      .select('id, name, code, contact_phone, is_active')
      .in('id', opdIds),
    supabase
      .from('notification_contacts')
      .select('opd_id, sync_status')
      .in('opd_id', opdIds),
  ]);
  const opds = opdsRes.data;
  const contactsRaw = contactsRes.data;

  const contactStatusMap = new Map<string, string>();
  for (const c of (contactsRaw ?? []) as Array<{
    opd_id: string;
    sync_status: string;
  }>) {
    contactStatusMap.set(c.opd_id, c.sync_status);
  }

  // --- 6. Build digests and unsynced lists ---
  const digests: OpdDigest[] = [];
  const unsyncedOpds: UnsyncedOpd[] = [];

  for (const opd of (opds ?? []) as Array<{
    id: string;
    name: string;
    code: string | null;
    contact_phone: string | null;
    is_active: boolean | null;
  }>) {
    if (opd.is_active === false) continue;

    const reportsForOpd = reportsByOpd.get(opd.id) ?? [];
    if (reportsForOpd.length === 0) continue;

    const phone = opd.contact_phone?.trim() ?? '';

    if (!phone) {
      unsyncedOpds.push({
        opd_id: opd.id,
        opd_name: opd.name,
        phone: null,
        skip_reason: 'no_phone',
        report_ids: reportsForOpd.map((r) => r.id),
      });
      continue;
    }

    const contactStatus = contactStatusMap.get(opd.id);
    if (contactStatus !== 'synced') {
      unsyncedOpds.push({
        opd_id: opd.id,
        opd_name: opd.name,
        phone,
        skip_reason: 'contact_not_synced',
        report_ids: reportsForOpd.map((r) => r.id),
      });
      continue;
    }

    digests.push({
      opd_id: opd.id,
      opd_name: opd.name,
      opd_code: opd.code,
      phone,
      reports: reportsForOpd,
    });
  }

  return { digests, unsyncedOpds };
}
