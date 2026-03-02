// =============================================================================
// Infobip Webhook Handler
// Receives inbound WhatsApp messages from Infobip and routes them through
// the AI pipeline (Flowise) or human handoff, then replies via Infobip API.
// Always returns HTTP 200 — Infobip retries on non-200.
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

import { InfobipProvider } from '../fonnte-webhook/providers/infobip-provider.ts';
import { processInfobipAttachment } from './attachment-processor.ts';

// =============================================================================
// Types
// =============================================================================
interface InfobipMessage {
  type: 'TEXT' | 'IMAGE' | 'LOCATION' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | string;
  text?: string;
  image?: { url: string; caption?: string };
  video?: { url: string; caption?: string };
  document?: { url: string; filename?: string; caption?: string };
  audio?: { url: string };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

interface InfobipResult {
  messageId: string;
  from: string;    // sender phone (citizen)
  to: string;      // recipient phone (business/sender_number)
  contact?: { name?: string };
  message: InfobipMessage;
}

interface InfobipWebhookPayload {
  results: InfobipResult[];
}

interface InfobipConfig {
  id: string;
  tenant_id: string;
  api_key: string;
  base_url: string;
  sender_number: string;
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
function normalizeMessage(msg: InfobipMessage): {
  messageContent: string;
  hasAttachment: boolean;
  imageUrl: string | null;
  location: { lat: number; lng: number } | undefined;
  skip: boolean;
} {
  switch (msg.type) {
    case 'TEXT':
      return {
        messageContent: msg.text || '',
        hasAttachment: false,
        imageUrl: null,
        location: undefined,
        skip: false
      };

    case 'IMAGE':
      return {
        messageContent: msg.image?.caption || '[Gambar]',
        hasAttachment: true,
        imageUrl: msg.image?.url || null,
        location: undefined,
        skip: false
      };

    case 'LOCATION': {
      const lat = msg.location?.latitude ?? 0;
      const lng = msg.location?.longitude ?? 0;
      const name = msg.location?.name ? ` (${msg.location.name})` : '';
      return {
        messageContent: `[Lokasi: ${lat}, ${lng}]${name}`,
        hasAttachment: false,
        imageUrl: null,
        location: { lat, lng },
        skip: false
      };
    }

    case 'VIDEO':
    case 'DOCUMENT':
    case 'AUDIO':
      console.log(`[Infobip] Skipping unsupported message type: ${msg.type}`);
      return {
        messageContent: '',
        hasAttachment: false,
        imageUrl: null,
        location: undefined,
        skip: true
      };

    default:
      console.log(`[Infobip] Skipping unknown message type: ${msg.type}`);
      return {
        messageContent: '',
        hasAttachment: false,
        imageUrl: null,
        location: undefined,
        skip: true
      };
  }
}

// =============================================================================
// Process a single Infobip message result
// =============================================================================
async function processResult(result: InfobipResult): Promise<void> {
  const sender = result.from;    // citizen's phone
  const recipient = result.to;   // business sender number
  const contactName = result.contact?.name;

  console.log('[Infobip] Processing message:', {
    from: '***' + sender.slice(-4),
    to: recipient,
    type: result.message.type
  });

  // 1. Normalize message — skip unsupported types
  const normalized = normalizeMessage(result.message);
  if (normalized.skip) return;

  if (!normalized.messageContent && !normalized.hasAttachment && !normalized.location) {
    console.log('[Infobip] Empty message content after normalization — skipping');
    return;
  }

  // 2. Load infobip_config by sender_number = result.to (tenant lookup)
  const { data: configData, error: configError } = await supabase
    .from('infobip_config')
    .select('*')
    .eq('sender_number', recipient)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (configError || !configData) {
    console.error('[Infobip] No active config found for sender_number:', recipient);
    await logWebhookError({
      source: 'infobip-webhook',
      error_type: 'ConfigNotFound',
      error_message: `No active infobip_config for sender_number: ${recipient}`,
      payload: { to: recipient, from: '***' + sender.slice(-4) }
    });
    return;
  }

  const config = configData as InfobipConfig;
  const provider = new InfobipProvider(config.api_key, config.base_url, config.sender_number);

  // 3. Find or create conversation (passing tenant context, no Fonnte config needed)
  const conversation = await findOrCreateConversation(
    sender,
    recipient,
    contactName,
    {
      tenantId: config.tenant_id,
      sessionTimeoutMinutes: config.session_timeout_minutes
    }
  );

  console.log('[Infobip] Conversation:', {
    id: conversation.id,
    isNew: conversation.session_id.startsWith('temp_'),
    isHumanHandled: conversation.is_human_handled
  });

  // 4. Human takeover — save message for admin, skip AI
  if (conversation.is_human_handled) {
    console.log('[Infobip] Human takeover active — saving message, skipping AI');

    const humanDuplicate = await isDuplicateMessage(conversation.id, normalized.messageContent);
    if (humanDuplicate) {
      console.log('[Infobip] Duplicate webhook (human mode) — skipping');
      return;
    }

    const humanMsgIdx = await getNextMessageIndex(conversation.id);
    await saveMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: normalized.messageContent,
      message_index: humanMsgIdx,
      has_attachment: normalized.hasAttachment
    });
    return;
  }

  // 5. Deduplication check
  const duplicate = await isDuplicateMessage(conversation.id, normalized.messageContent);
  if (duplicate) {
    console.log('[Infobip] Duplicate webhook — skipping');
    return;
  }

  // 6. Save user message
  const messageIndex = await getNextMessageIndex(conversation.id);
  const userMessage = await saveMessage({
    conversation_id: conversation.id,
    role: 'user',
    content: normalized.messageContent,
    message_index: messageIndex,
    has_attachment: normalized.hasAttachment
  });

  // 7. Process image attachment if present (null-safe, non-fatal)
  let attachmentResult = null;
  if (normalized.hasAttachment && normalized.imageUrl) {
    attachmentResult = await processInfobipAttachment(
      normalized.imageUrl,
      config.api_key,
      userMessage.id
    );
  }

  // 8. Check auto_reply and AI config
  if (!config.auto_reply_enabled) {
    console.log('[Infobip] Auto reply disabled — skipping AI');
    return;
  }

  const aiConfig = await getAIAssistantConfig();

  if (!aiConfig.is_ai_enabled) {
    console.log('[Infobip] AI disabled — sending preset reply');

    await saveMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: aiConfig.preset_reply_text,
      message_index: messageIndex + 1
    });

    const sendResult = await provider.sendMessageWithRetry({
      target: sender,
      message: aiConfig.preset_reply_text
    });

    if (!sendResult.status) {
      console.error('[Infobip] Failed to send preset reply:', sendResult.error);
      await logWebhookError({
        source: 'infobip-webhook-send',
        error_type: 'WhatsAppSendError',
        error_message: sendResult.error || 'Failed to send preset reply',
        conversation_id: conversation.id
      });
    }
    return;
  }

  // 9. Get conversation history and call Flowise
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

  console.log('[Infobip] Calling Flowise...');
  const { response: flowiseResponse } = await callFlowiseWithRetry(flowiseRequest, 3);

  // 10. Update session ID if temporary
  const flowiseSessionId = extractSessionId(flowiseResponse);
  if (flowiseSessionId && conversation.session_id.startsWith('temp_')) {
    await updateConversationSessionId(conversation.id, flowiseSessionId);
  }

  // 11. Extract response and save
  const responseText = extractResponseText(flowiseResponse);

  await saveMessage({
    conversation_id: conversation.id,
    role: 'assistant',
    content: responseText,
    message_index: messageIndex + 1,
    agent_flow_data: flowiseResponse.agentFlowExecutedData
  });

  // 12. Send response via Infobip
  console.log('[Infobip] Sending reply...');
  const sendResult = await provider.sendMessageWithRetry({
    target: sender,
    message: responseText
  });

  if (!sendResult.status) {
    console.error('[Infobip] Failed to send reply:', sendResult.error);
    await logWebhookError({
      source: 'infobip-webhook-send',
      error_type: 'WhatsAppSendError',
      error_message: sendResult.error || 'Failed to send reply',
      payload: { target: '***' + sender.slice(-4) },
      conversation_id: conversation.id
    });
  } else {
    console.log('[Infobip] Reply sent successfully', sendResult.messageId ? `(ID: ${sendResult.messageId})` : '');
  }
}

// =============================================================================
// Main Webhook Handler
// =============================================================================
console.log('Infobip Webhook Function Started');

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as InfobipWebhookPayload;

    if (!payload.results || !Array.isArray(payload.results) || payload.results.length === 0) {
      console.log('[Infobip] Empty or missing results — returning 200');
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Infobip] Received ${payload.results.length} message(s)`);

    // Process each result (Infobip batches messages)
    for (const result of payload.results) {
      try {
        await processResult(result);
      } catch (resultError) {
        const err = resultError instanceof Error ? resultError : new Error(String(resultError));
        console.error('[Infobip] Error processing result:', err.message);

        // Log but continue processing other results
        await logWebhookError({
          source: 'infobip-webhook',
          error_type: err.name || 'ProcessingError',
          error_message: err.message,
          error_stack: err.stack,
          payload: {
            from: '***' + (result.from || '').slice(-4),
            to: result.to,
            type: result.message?.type
          }
        });
      }
    }

    // Always return 200 — Infobip retries on non-200
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Infobip] Webhook error:', err.message);

    await logWebhookError({
      source: 'infobip-webhook',
      error_type: err.name || 'UnknownError',
      error_message: err.message,
      error_stack: err.stack
    });

    // Always return 200 to prevent Infobip retries on parse/unexpected errors
    return new Response(
      JSON.stringify({ success: false, error: 'Processing failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
