// =============================================================================
// sync-notification-contact — Edge Function
// -----------------------------------------------------------------------------
// Marks one or more OPDs as synced/unsynced in the notification_contacts
// gate. This is a pure DB operation — it does NOT call Fonnte.
//
// History: originally intended to POST to Fonnte's /add-contact endpoint,
// but Fonnte does NOT provide a public API for adding contacts. Contacts
// must be imported manually via the Fonnte Dashboard (Phone Book → Import
// CSV). Our admin UI generates that CSV; this function merely records the
// admin's confirmation after they've done the manual import.
//
// Called from the admin UI:
//   - Mark one OPD         → { opd_id: "..." }                  // action default = "mark"
//   - Mark a list          → { opd_ids: ["...", "..."] }
//   - Mark all eligible    → { sync_all: true }
//   - Unmark one OPD       → { opd_id: "...", action: "unmark" }
//
// JWT required (admin/owner/superadmin). config.toml has verify_jwt=false
// so we verify the token ourselves inside this function.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeIndonesianPhone } from '../sla-notifications/notification-whatsapp.ts';

const ALLOWED_ROLES = ['superadmin', 'owner', 'admin'];

type SyncAction = 'mark' | 'unmark';

interface SyncRequestBody {
  opd_id?: string;
  opd_ids?: string[];
  sync_all?: boolean;
  action?: SyncAction;
}

interface SyncResult {
  opd_id: string;
  opd_name: string;
  opd_code: string | null;
  phone: string | null;
  status: 'synced' | 'unsynced' | 'skipped';
  skip_reason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Auth: verify JWT and check role ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, { error: 'Unauthorized — missing Authorization header' });
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !authData.user) {
      return jsonResponse(401, { error: 'Unauthorized — invalid token' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id);

    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const allowed = roles.some((r) => ALLOWED_ROLES.includes(r));
    if (!allowed) {
      return jsonResponse(403, {
        error: 'Forbidden — admin/owner/superadmin role required',
      });
    }

    // --- Parse request body ---
    let body: SyncRequestBody = {};
    try {
      body = (await req.json()) as SyncRequestBody;
    } catch {
      body = {};
    }

    const action: SyncAction = body.action === 'unmark' ? 'unmark' : 'mark';

    // --- Build the list of OPDs to process ---
    let targetOpdIds: string[] = [];

    if (body.sync_all) {
      const { data: opds } = await supabase
        .from('opds')
        .select('id')
        .eq('is_active', true)
        .not('contact_phone', 'is', null)
        .neq('contact_phone', '');
      targetOpdIds = (opds ?? []).map((o: { id: string }) => o.id);
    } else if (Array.isArray(body.opd_ids)) {
      targetOpdIds = body.opd_ids;
    } else if (body.opd_id) {
      targetOpdIds = [body.opd_id];
    } else {
      return jsonResponse(400, {
        error: 'Provide opd_id, opd_ids[], or sync_all=true',
      });
    }

    if (targetOpdIds.length === 0) {
      return jsonResponse(200, {
        success: true,
        results: [],
        summary: { total: 0, synced: 0, unsynced: 0, skipped: 0 },
      });
    }

    // --- Fetch OPD metadata in one query ---
    const { data: opdsData } = await supabase
      .from('opds')
      .select('id, name, code, contact_phone, is_active')
      .in('id', targetOpdIds);

    const opdMap = new Map<
      string,
      {
        name: string;
        code: string | null;
        contact_phone: string | null;
        is_active: boolean | null;
      }
    >();
    for (const o of (opdsData ?? []) as Array<{
      id: string;
      name: string;
      code: string | null;
      contact_phone: string | null;
      is_active: boolean | null;
    }>) {
      opdMap.set(o.id, {
        name: o.name,
        code: o.code,
        contact_phone: o.contact_phone,
        is_active: o.is_active,
      });
    }

    // --- Partition OPDs into eligible and skipped, then do one batched DB write ---
    const results: SyncResult[] = [];
    const nowIso = new Date().toISOString();
    const eligibleIds: string[] = [];
    const upsertRows: Array<Record<string, unknown>> = [];

    for (const opdId of targetOpdIds) {
      const opd = opdMap.get(opdId);

      if (!opd || opd.is_active === false) {
        results.push({
          opd_id: opdId,
          opd_name: opd?.name ?? 'Unknown',
          opd_code: opd?.code ?? null,
          phone: opd?.contact_phone ?? null,
          status: 'skipped',
          skip_reason: opd ? 'opd_inactive' : 'opd_not_found',
        });
        continue;
      }

      if (action === 'mark' && (!opd.contact_phone || !opd.contact_phone.trim())) {
        results.push({
          opd_id: opdId,
          opd_name: opd.name,
          opd_code: opd.code,
          phone: null,
          status: 'skipped',
          skip_reason: 'no_phone',
        });
        continue;
      }

      eligibleIds.push(opdId);

      if (action === 'mark') {
        const normalizedPhone = normalizeIndonesianPhone(opd.contact_phone as string);
        const displayName = opd.code ? `${opd.code} - ${opd.name}` : opd.name;
        upsertRows.push({
          opd_id: opdId,
          phone_number: normalizedPhone,
          display_name: displayName,
          sync_status: 'synced',
          sync_error: null,
          synced_at: nowIso,
        });
      }
    }

    // Execute the batched DB write for eligible rows
    let dbError: string | null = null;
    if (eligibleIds.length > 0) {
      if (action === 'mark' && upsertRows.length > 0) {
        const { error } = await supabase
          .from('notification_contacts')
          .upsert(upsertRows, { onConflict: 'opd_id' });
        if (error) dbError = error.message;
      } else if (action === 'unmark') {
        const { error } = await supabase
          .from('notification_contacts')
          .update({
            sync_status: 'pending',
            synced_at: null,
            sync_error: null,
          })
          .in('opd_id', eligibleIds);
        if (error) dbError = error.message;
      }
    }

    // Record per-OPD result for eligible rows based on batch outcome
    for (const opdId of eligibleIds) {
      const opd = opdMap.get(opdId)!;
      const phone =
        action === 'mark'
          ? normalizeIndonesianPhone(opd.contact_phone as string)
          : opd.contact_phone;

      if (dbError) {
        results.push({
          opd_id: opdId,
          opd_name: opd.name,
          opd_code: opd.code,
          phone,
          status: 'skipped',
          skip_reason: `db_error: ${dbError}`,
        });
      } else {
        results.push({
          opd_id: opdId,
          opd_name: opd.name,
          opd_code: opd.code,
          phone,
          status: action === 'mark' ? 'synced' : 'unsynced',
        });
      }
    }

    const summary = {
      total: results.length,
      synced: results.filter((r) => r.status === 'synced').length,
      unsynced: results.filter((r) => r.status === 'unsynced').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    };

    return jsonResponse(200, {
      success: true,
      action,
      results,
      summary,
    });
  } catch (err) {
    console.error('sync-notification-contact error:', err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
