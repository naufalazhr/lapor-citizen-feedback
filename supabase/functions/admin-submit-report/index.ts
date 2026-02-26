// =============================================================================
// admin-submit-report — Edge Function
// JWT-authenticated endpoint for admin/member to submit a report on behalf
// of a citizen after a human-handled WhatsApp conversation.
// Mimics the submit-report edge function but uses JWT auth instead of API key.
// On success: creates the report, marks the conversation as completed,
// and links report_id to the conversation.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_ROLES = ['superadmin', 'owner', 'admin', 'member'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Check role and get tenant_id
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !ALLOWED_ROLES.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = roleData.tenant_id;

    // 3. Parse request body
    const {
      conversationId,
      reporter_name,
      phone,
      address,
      description,
      type,
      photo_url,
      geo_location
    } = await req.json();

    // 4. Validate required fields
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: conversationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reporter_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: reporter_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!address?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!description?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: description' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'lapor' && type !== 'aspirasi') {
      return new Response(
        JSON.stringify({ error: 'Invalid type: must be "lapor" or "aspirasi"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Fetch conversation to get session_id and validate it belongs to this tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, session_id, tenant_id, is_human_handled, status')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tenant ownership (if tenant_id is set on conversation)
    if (conversation.tenant_id && tenantId && conversation.tenant_id !== tenantId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Conversation belongs to different tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Insert report into database
    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .insert({
        reporter_name: reporter_name.trim(),
        phone: phone?.trim() || null,
        address: address.trim(),
        description: description.trim(),
        type,
        status: 'pending',
        tenant_id: tenantId || conversation.tenant_id || null,
        session_id: conversation.session_id || null,
        photo_url: photo_url || null,
        geo_location: geo_location || null
      })
      .select('id, ticket_id, status, created_at')
      .single();

    if (reportError || !reportData) {
      console.error('Failed to create report:', reportError);
      return new Response(
        JSON.stringify({ error: 'Failed to create report', details: reportError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Report created by admin:', reportData.id, reportData.ticket_id);

    // 7. Mark conversation as completed and link the report
    const { error: convUpdateError } = await supabase
      .from('conversations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        report_id: reportData.id
      })
      .eq('id', conversationId);

    if (convUpdateError) {
      console.error('Failed to mark conversation as completed:', convUpdateError);
      // Don't fail — report was created successfully
    } else {
      console.log('Conversation marked as completed and linked to report:', reportData.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Report submitted successfully',
        data: {
          ticket_id: reportData.ticket_id,
          report_id: reportData.id,
          status: reportData.status
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in admin-submit-report:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
