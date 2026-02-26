// =============================================================================
// send-human-reply — Edge Function
// Allows admin/member to send a WhatsApp reply on behalf of a human agent
// to a conversation that has been taken over from the AI chatbot.
// JWT authentication required. OPD members and viewers are rejected.
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

    // 2. Check user role — only owner/admin/member allowed
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !ALLOWED_ROLES.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body
    const { conversationId, message } = await req.json();

    if (!conversationId || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: conversationId, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch conversation — get phone_number, device_number, tenant_id
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, phone_number, device_number, tenant_id, is_human_handled, status')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversation.is_human_handled) {
      return new Response(
        JSON.stringify({ error: 'Conversation is not in human takeover mode' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (conversation.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Conversation is no longer active' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Fetch Fonnte config for this tenant
    let fonnteQuery = supabase
      .from('fonnte_config')
      .select('api_key, device_number')
      .eq('is_active', true);

    if (conversation.tenant_id) {
      fonnteQuery = fonnteQuery.eq('tenant_id', conversation.tenant_id);
    }

    const { data: fonnteConfig, error: fonnteError } = await fonnteQuery
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fonnteError || !fonnteConfig) {
      console.error('Fonnte config error:', fonnteError);
      return new Response(
        JSON.stringify({ error: 'No active Fonnte configuration found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Send message via Fonnte API
    const sendResponse = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': fonnteConfig.api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: conversation.phone_number,
        message: message.trim(),
        countryCode: '62'
      })
    });

    const sendResult = await sendResponse.json();
    console.log('Fonnte send result:', sendResult);

    if (!sendResult.status) {
      console.error('Fonnte API failed:', sendResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: sendResult }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Save message to messages table
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('message_index')
      .eq('conversation_id', conversationId)
      .order('message_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextIndex = lastMsg ? lastMsg.message_index + 1 : 0;

    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: message.trim(),
        message_index: nextIndex,
        has_attachment: false,
        sent_by_human: true,
        human_sender_id: user.id
      });

    if (insertError) {
      console.error('Failed to save human reply message:', insertError);
      // Don't fail the request — message was sent to WA, just not saved
    }

    // 8. Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({ success: true, message: 'Reply sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in send-human-reply:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
