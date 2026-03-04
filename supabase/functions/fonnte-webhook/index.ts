// =============================================================================
// Fonnte Webhook Handler - WITH PERFORMANCE MONITORING
// Main entry point for WhatsApp messages from Fonnte
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import type { FonnteWebhookPayload } from './types.ts';
import { ERROR_MESSAGES, normalizeFonntePayload } from './types.ts';

// Import helper modules
import {
  findOrCreateConversation,
  getNextMessageIndex,
  saveMessage,
  getConversationHistory,
  updateConversationSessionId,
  logWebhookError,
  getAIAssistantConfig,
  isDuplicateMessage
} from './conversation-manager.ts';

import {
  processAttachmentSafe
} from './attachment-processor.ts';

import {
  buildFlowiseRequest,
  callFlowiseWithRetry,
  extractSessionId,
  extractResponseText
} from './flowise-client.ts';

import {
  createWhatsAppProvider
} from './providers/provider-factory.ts';

// =============================================================================
// Debug Utility
// =============================================================================
const isDebugMode = () => Deno.env.get('DEBUG') === 'true';
const debugLog = (...args: any[]) => {
  if (isDebugMode()) {
    console.log(...args);
  }
};

console.log('Fonnte Webhook Function Started (Performance Monitoring Enabled)');

// =============================================================================
// Performance Tracking Helper
// =============================================================================
async function logPerformanceMetrics(
  tenantId: string | null,
  conversationId: string | null,
  metricType: string,
  durationMs: number,
  metadata: Record<string, any> = {}
) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from('performance_metrics').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      metric_type: metricType,
      duration_ms: Math.round(durationMs),
      metadata
    });
  } catch (error) {
    console.error('Failed to log performance metric:', error);
    // Don't throw - performance logging should not break webhook
  }
}

// -----------------------------------------------------------------------------
// Main Webhook Handler
// -----------------------------------------------------------------------------
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let conversationId: string | undefined;
  let payload: FonnteWebhookPayload | undefined;

  // ============================================================================
  // PERFORMANCE TRACKING - Start
  // ============================================================================
  const startTime = performance.now();
  const perfMetrics: Record<string, number> = {};
  let tenantId: string | null = null;
  let hasError = false;

  try {
    // 1. Parse request payload
    const rawPayload = await req.json() as FonnteWebhookPayload;

    // 2. Debug: Log raw payload (only in DEBUG mode)
    debugLog('🔍 RAW FONNTE PAYLOAD:', JSON.stringify(rawPayload, null, 2));

    // 3. Normalize Fonnte payload (handles different field name variations)
    const normalized = normalizeFonntePayload(rawPayload);
    payload = rawPayload; // Keep original for error logging

    console.log('Received webhook from Fonnte:', {
      sender: normalized.sender,
      device: normalized.device,
      hasAttachment: normalized.hasAttachment,
      hasLocation: !!normalized.location,
      messageLength: normalized.message.length
    });

    // Debug: Log detailed attachment and location data (only in DEBUG mode)
    debugLog('Attachment fields:', {
      url: normalized.url,
      filename: normalized.filename,
      extension: normalized.extension
    });

    if (normalized.location) {
      debugLog('📍 Location data:', {
        lat: normalized.location.lat,
        lng: normalized.location.lng,
        formatted: `${normalized.location.lat}, ${normalized.location.lng}`
      });
    }

    // 3. Validate required fields
    // IMPORTANT: Allow empty message if there's an attachment (image-only messages)
    if (!normalized.sender || !normalized.device) {
      throw new Error('Missing required fields: sender or device');
    }

    // Allow messages with: text OR attachment OR location
    if (!normalized.message && !normalized.hasAttachment && !normalized.location) {
      throw new Error('Message must contain either text, attachment, or location');
    }

    // ============================================================================
    // PERF: Find or create conversation
    // ============================================================================
    const dbStart = performance.now();
    const conversation = await findOrCreateConversation(
      normalized.sender,
      normalized.device,
      normalized.name
    );
    perfMetrics.db_find_conversation = performance.now() - dbStart;
    conversationId = conversation.id;
    tenantId = conversation.tenant_id;

    console.log('Conversation:', {
      id: conversation.id,
      sessionId: conversation.session_id,
      isNew: conversation.session_id.startsWith('temp_'),
      tenantId: tenantId,
      isHumanHandled: conversation.is_human_handled
    });

    // ============================================================================
    // PER-CONVERSATION HUMAN TAKEOVER CHECK
    // If this conversation has been taken over by a human admin/member,
    // save the incoming message for the admin to see — but skip ALL AI processing.
    // Admin handles replies manually via the send-human-reply edge function.
    // ============================================================================
    if (conversation.is_human_handled) {
      console.log('👤 Human takeover active — saving message for admin, skipping AI');

      // Strip Fonnte's internal type labels — they are not user-authored text.
      // "non-button message" = sent alongside button/list messages
      // "non-text message"   = sent when citizen shares GPS location or other non-text content
      const FONNTE_SYSTEM_LABELS = ['non-button message', 'non-text message'];
      const humanMsgText = FONNTE_SYSTEM_LABELS.includes((normalized.message || '').toLowerCase())
        ? ''
        : normalized.message;

      const humanModeContent = humanMsgText ||
        (normalized.hasAttachment ? '[Gambar]' :
        (normalized.location
          ? `[Lokasi: ${normalized.location.lat}, ${normalized.location.lng}]`
          : ''));

      // Deduplication guard — Fonnte retries on no-200 response
      const humanDuplicate = await isDuplicateMessage(conversation.id, humanModeContent);
      if (humanDuplicate) {
        console.log(`Duplicate webhook (human mode, device: ${normalized.device}) — skipping`);
        return new Response(
          JSON.stringify({ success: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const humanMsgIdx = await getNextMessageIndex(conversation.id);
      await saveMessage({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        role: 'user',
        content: humanModeContent,
        message_index: humanMsgIdx,
        has_attachment: normalized.hasAttachment
      });

      const totalDuration = performance.now() - startTime;
      await logPerformanceMetrics(
        tenantId,
        conversationId,
        'webhook_total_human_handled',
        totalDuration,
        { human_handled: true, message_length: humanModeContent.length }
      );

      return new Response(
        JSON.stringify({ success: true, human_handled: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // PERF: Get next message index
    // ============================================================================
    const indexStart = performance.now();
    const messageIndex = await getNextMessageIndex(conversation.id);
    perfMetrics.db_get_index = performance.now() - indexStart;

    // 6. Prepare message content
    // For image-only messages, use placeholder for database storage
    // The actual image URL will be appended in buildFlowiseRequest
    // Strip Fonnte's internal type labels — they are not user-authored text.
    // "non-button message" = sent alongside button/list messages
    // "non-text message"   = sent when citizen shares GPS location or other non-text content
    const FONNTE_SYSTEM_LABELS_AI = ['non-button message', 'non-text message'];
    const msgText = FONNTE_SYSTEM_LABELS_AI.includes((normalized.message || '').toLowerCase())
      ? ''
      : normalized.message;

    const messageContent = msgText ||
      (normalized.hasAttachment ? '[Gambar]' :
      (normalized.location
        ? `[Lokasi: ${normalized.location.lat}, ${normalized.location.lng}]`
        : ''));

    // ============================================================================
    // DEDUPLICATION CHECK - Fonnte multi-device / webhook retry guard
    // When multiple Fonnte devices share one webhook, the same message fires
    // simultaneously from each device. Also covers Fonnte retries (30s timeout).
    // Return 200 immediately so Fonnte does not retry.
    // ============================================================================
    const duplicate = await isDuplicateMessage(conversation.id, messageContent);
    if (duplicate) {
      console.log(`Duplicate webhook detected (device: ${normalized.device}) — already processed, skipping`);
      return new Response(
        JSON.stringify({ success: true, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // PERF: Save user message
    // ============================================================================
    const saveUserStart = performance.now();
    const userMessage = await saveMessage({
      conversation_id: conversation.id,
      tenant_id: tenantId,
      role: 'user',
      content: messageContent,
      message_index: messageIndex,
      has_attachment: normalized.hasAttachment
    });
    perfMetrics.db_save_user_message = performance.now() - saveUserStart;

    console.log('User message saved:', {
      messageId: userMessage.id,
      index: messageIndex
    });

    // ============================================================================
    // PERF: Process attachment if present
    // ============================================================================
    let attachmentResult = null;
    let attachmentError = null;

    if (normalized.url && normalized.filename && normalized.extension) {
      console.log('✓ Starting attachment processing:', normalized.filename);

      const attachmentStart = performance.now();
      try {
        attachmentResult = await processAttachmentSafe(
          normalized.url,
          normalized.filename,
          normalized.extension,
          userMessage.id
        );
        perfMetrics.attachment_processing = performance.now() - attachmentStart;

        if (attachmentResult) {
          console.log('✓ Attachment processed successfully:', attachmentResult.id);
        } else {
          // processAttachmentSafe returned null = silent failure
          console.error('✗ Attachment processing returned null (failed silently)');
          attachmentError = 'Attachment processing failed - check Edge Function logs for details';

          // Log this specific case to database
          await logWebhookError({
            source: 'attachment-processing',
            error_type: 'AttachmentSilentFailure',
            error_message: 'processAttachmentSafe returned null - check attachment-processor logs',
            payload: {
              url: normalized.url,
              filename: normalized.filename,
              extension: normalized.extension
            },
            conversation_id: conversationId
          });
        }
      } catch (error) {
        perfMetrics.attachment_processing = performance.now() - attachmentStart;
        console.error('✗ Attachment processing error:', error);
        attachmentError = error instanceof Error ? error.message : String(error);

        // Log detailed error to database
        await logWebhookError({
          source: 'attachment-processing',
          error_type: 'AttachmentProcessingError',
          error_message: attachmentError,
          error_stack: error instanceof Error ? error.stack : undefined,
          payload: {
            url: normalized.url,
            filename: normalized.filename,
            extension: normalized.extension
          },
          conversation_id: conversationId
        });
      }
    }

    // ============================================================================
    // PERF: Get conversation history
    // ============================================================================
    const historyStart = performance.now();
    const history = await getConversationHistory(conversation.id);
    perfMetrics.db_get_history = performance.now() - historyStart;

    // Remove the last message (current user message) from history for Flowise
    const historyForFlowise = history.slice(0, -1);

    // ============================================================================
    // AI GOVERNANCE CHECK - Human-in-the-Loop Control
    // Check if AI is enabled before calling Flowise
    // ============================================================================
    const aiConfig = await getAIAssistantConfig();

    if (!aiConfig.is_ai_enabled) {
      console.log('🤖 AI Assistant is DISABLED - using preset reply (Human-in-the-Loop)');

      const presetResponseText = aiConfig.preset_reply_text;

      // Save preset response as assistant message
      const savePresetStart = performance.now();
      await saveMessage({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        role: 'assistant',
        content: presetResponseText,
        message_index: messageIndex + 1,
        agent_flow_data: null // No AI flow data for preset response
      });
      perfMetrics.db_save_assistant_message = performance.now() - savePresetStart;

      console.log('Preset response saved, sending to WhatsApp...');

      // Send preset response via WhatsApp provider
      const whatsappSendPresetStart = performance.now();
      try {
        const whatsappProvider = await createWhatsAppProvider();

        const sendResult = await whatsappProvider.sendMessageWithRetry({
          target: normalized.sender,
          message: presetResponseText
        });
        perfMetrics.whatsapp_send = performance.now() - whatsappSendPresetStart;

        if (!sendResult.status) {
          console.error(`Failed to send preset message to WhatsApp via ${sendResult.provider}:`, sendResult.error);
          await logWebhookError({
            source: `whatsapp-send-preset-${sendResult.provider}`,
            error_type: 'WhatsAppSendError',
            error_message: sendResult.error || 'Failed to send preset message to WhatsApp',
            payload: { target: '***' + normalized.sender.slice(-4), provider: sendResult.provider },
            conversation_id: conversationId
          });
        } else {
          console.log(`Preset message sent to WhatsApp successfully via ${sendResult.provider}`);
        }
      } catch (sendError) {
        perfMetrics.whatsapp_send = performance.now() - whatsappSendPresetStart;
        console.error('Error sending preset message to WhatsApp:', sendError);
        await logWebhookError({
          source: 'whatsapp-send-preset',
          error_type: 'WhatsAppSendException',
          error_message: sendError instanceof Error ? sendError.message : 'Unknown error',
          payload: { target: '***' + normalized.sender.slice(-4) },
          conversation_id: conversationId
        });
      }

      // Log performance metrics for AI-bypassed request
      const totalDuration = performance.now() - startTime;
      console.log('📊 PERFORMANCE METRICS (AI Bypassed):', {
        total: `${totalDuration.toFixed(0)}ms`,
        whatsapp: `${perfMetrics.whatsapp_send?.toFixed(0) || 0}ms`,
        db: `${((perfMetrics.db_find_conversation || 0) + (perfMetrics.db_get_history || 0) + (perfMetrics.db_save_user_message || 0) + (perfMetrics.db_save_assistant_message || 0)).toFixed(0)}ms`
      });

      await logPerformanceMetrics(
        tenantId,
        conversationId,
        'webhook_total_ai_bypassed',
        totalDuration,
        {
          ai_enabled: false,
          message_length: messageContent.length
        }
      );

      // Return success response for AI-bypassed request
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook processed successfully (AI bypassed)',
          ai_bypassed: true
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // AI is enabled - continue with Flowise flow
    console.log('🤖 AI Assistant is ENABLED - processing with Flowise');

    // 10. Build Flowise request
    const flowiseRequest = buildFlowiseRequest({
      userMessage: messageContent, // Use prepared message content (handles image-only messages)
      conversation,
      conversationHistory: historyForFlowise,
      attachment: attachmentResult,
      senderName: normalized.name,
      phoneNumber: normalized.sender,
      location: normalized.location // Pass location data to Flowise
    });

    console.log('Calling Flowise API...', {
      hasHistory: historyForFlowise.length > 0,
      hasAttachment: !!attachmentResult
    });

    // ============================================================================
    // PERF: Call Flowise API with retry (PRIMARY BOTTLENECK)
    // ============================================================================
    const flowiseStart = performance.now();
    const { response: flowiseResponse, attempts, totalTime } = await callFlowiseWithRetry(flowiseRequest, 3);
    perfMetrics.flowise_api = performance.now() - flowiseStart;
    perfMetrics.flowise_attempts = attempts;

    console.log('Flowise API response received', {
      duration: perfMetrics.flowise_api + 'ms',
      attempts
    });

    // 12. Extract session ID (CRITICAL for first message)
    const flowiseSessionId = extractSessionId(flowiseResponse);
    if (flowiseSessionId && conversation.session_id.startsWith('temp_')) {
      console.log('Updating conversation with Flowise sessionId:', flowiseSessionId);

      const updateSessionStart = performance.now();
      await updateConversationSessionId(conversation.id, flowiseSessionId);
      perfMetrics.db_update_session = performance.now() - updateSessionStart;
    }

    // 13. Extract response text
    const responseText = extractResponseText(flowiseResponse);

    // ============================================================================
    // PERF: Save assistant response
    // ============================================================================
    const saveAssistantStart = performance.now();
    await saveMessage({
      conversation_id: conversation.id,
      tenant_id: tenantId,
      role: 'assistant',
      content: responseText,
      message_index: messageIndex + 1,
      agent_flow_data: flowiseResponse.agentFlowExecutedData // Store AI thinking data for governance
    });
    perfMetrics.db_save_assistant_message = performance.now() - saveAssistantStart;

    console.log('Assistant response saved');

    // 15. Prepare response message
    let finalResponseText = responseText;

    // Add attachment error message if applicable
    if (attachmentError) {
      finalResponseText = `${responseText}\n\n_Catatan: ${attachmentError}_`;
    }

    // ============================================================================
    // PERF: Send response to WhatsApp via Provider (Fonnte/Twilio)
    // ============================================================================
    console.log('Sending message to WhatsApp...');

    const whatsappSendStart = performance.now();
    try {
      const whatsappProvider = await createWhatsAppProvider();

      const sendResult = await whatsappProvider.sendMessageWithRetry({
        target: normalized.sender,
        message: finalResponseText
      });
      perfMetrics.whatsapp_send = performance.now() - whatsappSendStart;

      if (!sendResult.status) {
        console.error(`Failed to send message to WhatsApp via ${sendResult.provider}:`, sendResult.error);

        // Log error but don't throw - message is already saved in DB
        await logWebhookError({
          source: `whatsapp-send-${sendResult.provider}`,
          error_type: 'WhatsAppSendError',
          error_message: sendResult.error || 'Failed to send message to WhatsApp',
          payload: {
            target: '***' + normalized.sender.slice(-4),
            messageLength: finalResponseText.length,
            provider: sendResult.provider
          },
          conversation_id: conversationId
        });
      } else {
        console.log(`Message sent to WhatsApp successfully via ${sendResult.provider}`, sendResult.messageId ? `(ID: ${sendResult.messageId})` : '');
      }
    } catch (sendError) {
      perfMetrics.whatsapp_send = performance.now() - whatsappSendStart;
      console.error('Error sending message to WhatsApp:', sendError);

      // Log error but don't crash webhook
      await logWebhookError({
        source: 'whatsapp-send',
        error_type: 'WhatsAppSendException',
        error_message: sendError instanceof Error ? sendError.message : 'Unknown error',
        error_stack: sendError instanceof Error ? sendError.stack : undefined,
        payload: { target: '***' + normalized.sender.slice(-4) },
        conversation_id: conversationId
      });
    }

    // ============================================================================
    // PERFORMANCE TRACKING - Log Total Duration
    // ============================================================================
    const totalDuration = performance.now() - startTime;

    console.log('📊 PERFORMANCE METRICS:', {
      total: `${totalDuration.toFixed(0)}ms`,
      flowise: `${perfMetrics.flowise_api?.toFixed(0) || 0}ms (${((perfMetrics.flowise_api / totalDuration) * 100).toFixed(1)}%)`,
      whatsapp: `${perfMetrics.whatsapp_send?.toFixed(0) || 0}ms`,
      db: `${(
        (perfMetrics.db_find_conversation || 0) +
        (perfMetrics.db_get_history || 0) +
        (perfMetrics.db_save_user_message || 0) +
        (perfMetrics.db_save_assistant_message || 0)
      ).toFixed(0)}ms`,
      attachment: `${perfMetrics.attachment_processing?.toFixed(0) || 0}ms`
    });

    // ============================================================================
    // Calculate Component Breakdown for Simplified Monitoring
    // ============================================================================
    const dbDuration = (
      (perfMetrics.db_find_conversation || 0) +
      (perfMetrics.db_get_index || 0) +
      (perfMetrics.db_get_history || 0) +
      (perfMetrics.db_save_user_message || 0) +
      (perfMetrics.db_save_assistant_message || 0) +
      (perfMetrics.db_update_session || 0)
    );
    const flowiseDuration = perfMetrics.flowise_api || 0;
    const whatsappDuration = perfMetrics.whatsapp_send || 0;
    const attachmentDuration = perfMetrics.attachment_processing || 0;
    const otherDuration = totalDuration - dbDuration - flowiseDuration - whatsappDuration - attachmentDuration;

    // Log webhook_total metric with component breakdown
    await logPerformanceMetrics(
      tenantId,
      conversationId,
      'webhook_total',
      totalDuration,
      {
        has_attachment: normalized.hasAttachment,
        message_length: messageContent.length,
        history_count: historyForFlowise.length,
        flowise_attempts: perfMetrics.flowise_attempts || 1,
        // ========================================================================
        // COMPONENT BREAKDOWN - For simplified per-service monitoring
        // ========================================================================
        components: {
          flowise: Math.round(flowiseDuration),
          database: Math.round(dbDuration),
          whatsapp_send: Math.round(whatsappDuration),
          attachment: Math.round(attachmentDuration),
          other: Math.round(Math.max(0, otherDuration))
        },
        breakdown_pct: {
          flowise: parseFloat(((flowiseDuration / totalDuration) * 100).toFixed(1)),
          database: parseFloat(((dbDuration / totalDuration) * 100).toFixed(1)),
          whatsapp_send: parseFloat(((whatsappDuration / totalDuration) * 100).toFixed(1)),
          attachment: parseFloat(((attachmentDuration / totalDuration) * 100).toFixed(1)),
          other: parseFloat(((Math.max(0, otherDuration) / totalDuration) * 100).toFixed(1))
        }
      }
    );

    // Log individual component metrics
    if (perfMetrics.flowise_api) {
      await logPerformanceMetrics(
        tenantId,
        conversationId,
        'flowise_api',
        perfMetrics.flowise_api,
        {
          attempts: perfMetrics.flowise_attempts || 1,
          history_count: historyForFlowise.length
        }
      );
    }

    if (perfMetrics.whatsapp_send) {
      await logPerformanceMetrics(
        tenantId,
        conversationId,
        'whatsapp_send',
        perfMetrics.whatsapp_send,
        {
          message_length: finalResponseText.length
        }
      );
    }

    if (perfMetrics.db_get_history) {
      await logPerformanceMetrics(
        tenantId,
        conversationId,
        'db_query_get_history',
        perfMetrics.db_get_history,
        {
          message_count: history.length
        }
      );
    }

    if (perfMetrics.attachment_processing) {
      await logPerformanceMetrics(
        tenantId,
        conversationId,
        'attachment_processing',
        perfMetrics.attachment_processing,
        {
          filename: normalized.filename,
          extension: normalized.extension
        }
      );
    }

    // 17. Return webhook acknowledgment
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    hasError = true;

    // Type-safe error handling
    const err = error instanceof Error ? error : new Error(String(error));

    // ============================================================================
    // RACE CONDITION GUARD — concurrent duplicate webhook
    // If two webhook instances pass the dedup check simultaneously, only one
    // saves the message. The other hits a unique constraint error.
    // Return 200 so Fonnte does not retry this as a failed webhook.
    // ============================================================================
    if (err.message?.includes('duplicate key value')) {
      console.log('Concurrent duplicate webhook (race condition) — returning 200 to suppress retry');
      return new Response(
        JSON.stringify({ success: true, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('Webhook processing error:', error);

    // ============================================================================
    // PERFORMANCE TRACKING - Log Error Case
    // ============================================================================
    const totalDuration = performance.now() - startTime;
    await logPerformanceMetrics(
      tenantId,
      conversationId || null,
      'webhook_total',
      totalDuration,
      {
        error: err.message,
        error_type: err.name
      }
    );

    // Log error to database
    await logWebhookError({
      source: 'fonnte-webhook',
      error_type: err.name || 'UnknownError',
      error_message: err.message,
      error_stack: err.stack,
      payload: payload ? {
        ...payload,
        // Redact sensitive data
        sender: payload.sender ? '***' + payload.sender.slice(-4) : undefined
      } : undefined,
      conversation_id: conversationId
    });

    // Determine user-friendly error message
    let userMessage: string = ERROR_MESSAGES.GENERAL_ERROR;

    if (err.message.includes('No active Flowise configuration')) {
      userMessage = ERROR_MESSAGES.NO_FLOWISE_CONFIG;
    } else if (err.message === ERROR_MESSAGES.FLOWISE_TIMEOUT) {
      userMessage = ERROR_MESSAGES.FLOWISE_TIMEOUT;
    } else if (err.message === ERROR_MESSAGES.FILE_TOO_LARGE) {
      userMessage = ERROR_MESSAGES.FILE_TOO_LARGE;
    } else if (err.message === ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE) {
      userMessage = ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE;
    }

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Processing failed',
        message: userMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});