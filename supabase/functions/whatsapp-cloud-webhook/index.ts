// =============================================================================
// WhatsApp Cloud (Meta) Webhook Handler
// Receives inbound WhatsApp messages from Meta Graph API (Cloud API) and routes
// them through the AI pipeline (Flowise) or human handoff, then replies via
// Meta Graph API.
//
// Meta-specific requirements:
//  - GET handler: echo hub.challenge if hub.verify_token matches stored config
//  - POST handler: nested payload via entry[].changes[].value.messages[]
//  - Ignore statuses[] (delivery/read receipts) — only process messages[]
//  - Image download: two-step (resolve URL from media ID, then download)
//  - Always return HTTP 200 — Meta retries on non-200
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

import {
  findOrCreateConversation,
  getNextMessageIndex,
  saveMessage,
  getConversationHistory,
  updateConversationSessionId,
  logWebhookError,
  getAIAssistantConfig,
  isDuplicateMessage
} from '../fonnte-webhook/conversation-manager.ts';

import {
  buildFlowiseRequest,
  callFlowiseWithRetry,
  extractSessionId,
  extractResponseText
} from '../fonnte-webhook/flowise-client.ts';

import { WhatsAppCloudProvider } from '../fonnte-webhook/providers/whatsapp-cloud-provider.ts';
import { processMetaAttachment } from './attachment-processor.ts';

// =============================================================================
// Types
// =============================================================================

interface MetaTextMessage {
  body: string;
}

interface MetaMediaMessage {
  id: string;          // media ID (use to resolve CDN URL)
  caption?: string;
  mime_type?: string;
  sha256?: string;
}

interface MetaLocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface MetaMessage {
  from: string;        // sender phone (citizen)
  id: string;          // message ID (wamid.xxx)
  timestamp: string;
  type: 'text' | 'image' | 'location' | 'audio' | 'video' | 'document' | 'sticker' | string;
  text?: MetaTextMessage;
  image?: MetaMediaMessage;
  video?: MetaMediaMessage;
  location?: MetaLocationMessage;
}

interface MetaContact {
  profile?: { name?: string };
  wa_id?: string;
}

interface MetaMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

interface MetaValue {
  messaging_product: string;
  metadata: MetaMetadata;
  messages?: MetaMessage[];
  contacts?: MetaContact[];
  statuses?: any[];
}

interface MetaChange {
  value: MetaValue;
  field: string;
}

interface MetaEntry {
  id: string;
  changes: MetaChange[];
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaEntry[];
}

interface WhatsAppCloudConfig {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  access_token: string;
  verify_token: string;
  auto_reply_enabled: boolean;
  session_timeout_minutes: number;
}

// =============================================================================
// Supabase client (service role)
// =============================================================================
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =============================================================================
// Normalize message content and determine if it should be skipped
// =============================================================================
function normalizeMessage(msg: MetaMessage): {
  messageContent: string;
  hasAttachment: boolean;
  mediaId: string | null;
  mimeType: string | null;
  location: { lat: number; lng: number } | undefined;
  skip: boolean;
} {
  switch (msg.type) {
    case 'text':
      return {
        messageContent: msg.text?.body || '',
        hasAttachment: false,
        mediaId: null,
        mimeType: null,
        location: undefined,
        skip: false
      };

    case 'image':
      return {
        messageContent: msg.image?.caption || '[Gambar]',
        hasAttachment: true,
        mediaId: msg.image?.id || null,
        mimeType: msg.image?.mime_type || null,
        location: undefined,
        skip: false
      };

    case 'video':
      return {
        messageContent: msg.video?.caption || '[Video]',
        hasAttachment: true,
        mediaId: msg.video?.id || null,
        mimeType: msg.video?.mime_type || null,
        location: undefined,
        skip: false
      };

    case 'location': {
      const lat = msg.location?.latitude ?? 0;
      const lng = msg.location?.longitude ?? 0;
      const name = msg.location?.name ? ` (${msg.location.name})` : '';
      return {
        messageContent: `[Lokasi: ${lat}, ${lng}]${name}`,
        hasAttachment: false,
        mediaId: null,
        mimeType: null,
        location: { lat, lng },
        skip: false
      };
    }

    case 'audio':
    case 'document':
    case 'sticker':
      console.log(`[WhatsApp Cloud] Skipping unsupported message type: ${msg.type}`);
      return {
        messageContent: '',
        hasAttachment: false,
        mediaId: null,
        mimeType: null,
        location: undefined,
        skip: true
      };

    default:
      console.log(`[WhatsApp Cloud] Skipping unknown message type: ${msg.type}`);
      return {
        messageContent: '',
        hasAttachment: false,
        mediaId: null,
        mimeType: null,
        location: undefined,
        skip: true
      };
  }
}

// =============================================================================
// Process a single message from Meta webhook value
// =============================================================================
async function processMessage(
  msg: MetaMessage,
  config: WhatsAppCloudConfig,
  contacts: MetaContact[]
): Promise<void> {
  const sender = msg.from;   // citizen's phone
  const recipient = config.phone_number_id;
  const contactName = contacts?.[0]?.profile?.name;

  console.log('[WhatsApp Cloud] Processing message:', {
    from: '***' + sender.slice(-4),
    phoneNumberId: recipient,
    type: msg.type
  });

  // 1. Normalize message — skip unsupported types
  const normalized = normalizeMessage(msg);
  if (normalized.skip) return;

  if (!normalized.messageContent && !normalized.hasAttachment && !normalized.location) {
    console.log('[WhatsApp Cloud] Empty message content after normalization — skipping');
    return;
  }

  const provider = new WhatsAppCloudProvider(config.phone_number_id, config.access_token);

  // 2. Find or create conversation
  const conversation = await findOrCreateConversation(
    sender,
    recipient,
    contactName,
    {
      tenantId: config.tenant_id,
      sessionTimeoutMinutes: config.session_timeout_minutes
    }
  );

  console.log('[WhatsApp Cloud] Conversation:', {
    id: conversation.id,
    isNew: conversation.session_id.startsWith('temp_'),
    isHumanHandled: conversation.is_human_handled
  });

  // 3. Human takeover — save message for admin, skip AI
  if (conversation.is_human_handled) {
    console.log('[WhatsApp Cloud] Human takeover active — saving message, skipping AI');

    const humanDuplicate = await isDuplicateMessage(conversation.id, normalized.messageContent);
    if (humanDuplicate) {
      console.log('[WhatsApp Cloud] Duplicate webhook (human mode) — skipping');
      return;
    }

    const humanMsgIdx = await getNextMessageIndex(conversation.id);
    await saveMessage({
      conversation_id: conversation.id,
      tenant_id: config.tenant_id,
      role: 'user',
      content: normalized.messageContent,
      message_index: humanMsgIdx,
      has_attachment: normalized.hasAttachment
    });
    return;
  }

  // 4. Deduplication check
  const duplicate = await isDuplicateMessage(conversation.id, normalized.messageContent);
  if (duplicate) {
    console.log('[WhatsApp Cloud] Duplicate webhook — skipping');
    return;
  }

  // 5. Save user message
  const messageIndex = await getNextMessageIndex(conversation.id);
  const userMessage = await saveMessage({
    conversation_id: conversation.id,
    tenant_id: config.tenant_id,
    role: 'user',
    content: normalized.messageContent,
    message_index: messageIndex,
    has_attachment: normalized.hasAttachment
  });

  // 6. Process attachment if present (image/video — two-step Meta download, non-fatal)
  let attachmentResult = null;
  if (normalized.hasAttachment && normalized.mediaId) {
    attachmentResult = await processMetaAttachment(
      normalized.mediaId,
      normalized.mimeType || 'image/jpeg',
      config.access_token,
      userMessage.id,
      config.tenant_id
    );
  }

  // 7. Check auto_reply and AI config
  if (!config.auto_reply_enabled) {
    console.log('[WhatsApp Cloud] Auto reply disabled — skipping AI');
    return;
  }

  const aiConfig = await getAIAssistantConfig();

  if (!aiConfig.is_ai_enabled) {
    console.log('[WhatsApp Cloud] AI disabled — sending preset reply');

    await saveMessage({
      conversation_id: conversation.id,
      tenant_id: config.tenant_id,
      role: 'assistant',
      content: aiConfig.preset_reply_text,
      message_index: messageIndex + 1
    });

    const sendResult = await provider.sendMessageWithRetry({
      target: sender,
      message: aiConfig.preset_reply_text
    });

    if (!sendResult.status) {
      console.error('[WhatsApp Cloud] Failed to send preset reply:', sendResult.error);
      await logWebhookError({
        source: 'whatsapp-cloud-webhook-send',
        error_type: 'WhatsAppSendError',
        error_message: sendResult.error || 'Failed to send preset reply',
        conversation_id: conversation.id
      });
    }
    return;
  }

  // 8. Get conversation history and call Flowise
  const history = await getConversationHistory(conversation.id);
  const historyForFlowise = history.slice(0, -1);

  const flowiseRequest = buildFlowiseRequest({
    userMessage: normalized.messageContent,
    conversation,
    conversationHistory: historyForFlowise,
    attachment: attachmentResult,
    senderName: contactName,
    phoneNumber: sender,
    location: normalized.location
  });

  console.log('[WhatsApp Cloud] Calling Flowise...');
  const { response: flowiseResponse } = await callFlowiseWithRetry(flowiseRequest, 3);

  // 9. Update session ID if temporary
  const flowiseSessionId = extractSessionId(flowiseResponse);
  if (flowiseSessionId && conversation.session_id.startsWith('temp_')) {
    await updateConversationSessionId(conversation.id, flowiseSessionId);
  }

  // 10. Extract response and save
  const responseText = extractResponseText(flowiseResponse);

  await saveMessage({
    conversation_id: conversation.id,
    tenant_id: config.tenant_id,
    role: 'assistant',
    content: responseText,
    message_index: messageIndex + 1,
    agent_flow_data: flowiseResponse.agentFlowExecutedData
  });

  // 11. Send response via WhatsApp Cloud
  console.log('[WhatsApp Cloud] Sending reply...');
  const sendResult = await provider.sendMessageWithRetry({
    target: sender,
    message: responseText
  });

  if (!sendResult.status) {
    console.error('[WhatsApp Cloud] Failed to send reply:', sendResult.error);
    await logWebhookError({
      source: 'whatsapp-cloud-webhook-send',
      error_type: 'WhatsAppSendError',
      error_message: sendResult.error || 'Failed to send reply',
      payload: { target: '***' + sender.slice(-4) },
      conversation_id: conversation.id
    });
  } else {
    console.log('[WhatsApp Cloud] Reply sent successfully', sendResult.messageId ? `(ID: ${sendResult.messageId})` : '');
  }
}

// =============================================================================
// Main Webhook Handler
// =============================================================================
console.log('WhatsApp Cloud Webhook Function Started');

serve(async (req: Request) => {
  // -------------------------------------------------------------------
  // GET: Meta webhook verification (hub.challenge echo)
  // -------------------------------------------------------------------
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = url.searchParams.get('hub.verify_token');

    console.log('[WhatsApp Cloud] GET verification request:', { mode, hasChallenge: !!challenge });

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      console.log('[WhatsApp Cloud] Missing required verification params');
      return new Response('Bad Request', { status: 400 });
    }

    // Look up the verify_token in our config table
    const { data: configData, error } = await supabase
      .from('whatsapp_cloud_config')
      .select('id')
      .eq('verify_token', verifyToken)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !configData) {
      console.log('[WhatsApp Cloud] Verification failed — token not found');
      return new Response('Forbidden', { status: 403 });
    }

    console.log('[WhatsApp Cloud] Verification succeeded — echoing challenge');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // -------------------------------------------------------------------
  // Handle CORS preflight
  // -------------------------------------------------------------------
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // -------------------------------------------------------------------
  // POST: Inbound messages from Meta
  // -------------------------------------------------------------------
  try {
    const payload = await req.json() as MetaWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      console.log('[WhatsApp Cloud] Unexpected object type:', payload.object);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
      console.log('[WhatsApp Cloud] Empty entry array — returning 200');
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each entry (usually one, but Meta can batch)
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Skip if no messages (e.g. statuses-only payload)
        if (!value.messages || value.messages.length === 0) {
          console.log('[WhatsApp Cloud] No messages in change (likely statuses only) — skipping');
          continue;
        }

        // Get phone_number_id from metadata to find tenant config
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) {
          console.log('[WhatsApp Cloud] Missing phone_number_id in metadata — skipping');
          continue;
        }

        // Load whatsapp_cloud_config by phone_number_id (tenant lookup)
        const { data: configData, error: configError } = await supabase
          .from('whatsapp_cloud_config')
          .select('*')
          .eq('phone_number_id', phoneNumberId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (configError || !configData) {
          if (configError) {
            // DB-level error (e.g. table not found, connection error)
            console.error('[WhatsApp Cloud] Config DB error:', {
              code: configError.code,
              message: configError.message,
              details: configError.details,
            });
          } else {
            // No matching row — query all active configs to surface the mismatch
            const { data: allConfigs } = await supabase
              .from('whatsapp_cloud_config')
              .select('phone_number_id, is_active');
            const stored = allConfigs?.map(c => `${c.phone_number_id}(active=${c.is_active})`) ?? [];
            console.error(
              '[WhatsApp Cloud] No active config found.',
              `Received phone_number_id: "${phoneNumberId}"`,
              `| Stored configs: [${stored.join(', ') || 'none'}]`
            );
          }
          await logWebhookError({
            source: 'whatsapp-cloud-webhook',
            error_type: configError ? 'ConfigDBError' : 'ConfigNotFound',
            error_message: configError
              ? `DB error ${configError.code}: ${configError.message}`
              : `No active whatsapp_cloud_config for phone_number_id: ${phoneNumberId}`,
            payload: { phone_number_id: phoneNumberId }
          });
          continue;
        }

        const config = configData as WhatsAppCloudConfig;
        const contacts = value.contacts || [];

        console.log(`[WhatsApp Cloud] Processing ${value.messages.length} message(s) for phoneNumberId: ${phoneNumberId}`);

        // Process each message in this change
        for (const msg of value.messages) {
          try {
            await processMessage(msg, config, contacts);
          } catch (msgError) {
            const err = msgError instanceof Error ? msgError : new Error(String(msgError));
            console.error('[WhatsApp Cloud] Error processing message:', err.message);

            await logWebhookError({
              source: 'whatsapp-cloud-webhook',
              error_type: err.name || 'ProcessingError',
              error_message: err.message,
              error_stack: err.stack,
              payload: {
                from: '***' + (msg.from || '').slice(-4),
                type: msg.type,
                phone_number_id: phoneNumberId
              }
            });
          }
        }
      }
    }

    // Always return 200 — Meta retries on non-200
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[WhatsApp Cloud] Webhook error:', err.message);

    await logWebhookError({
      source: 'whatsapp-cloud-webhook',
      error_type: err.name || 'UnknownError',
      error_message: err.message,
      error_stack: err.stack
    });

    // Always return 200 to prevent Meta retries on parse/unexpected errors
    return new Response(
      JSON.stringify({ success: false, error: 'Processing failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
