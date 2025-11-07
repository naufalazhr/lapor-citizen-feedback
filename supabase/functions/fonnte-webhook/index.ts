// =============================================================================
// Fonnte Webhook Handler
// Main entry point for WhatsApp messages from Fonnte
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
  getFonnteConfig
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
  sendFonnteMessageWithRetry
} from './fonnte-client.ts';

// =============================================================================
// Debug Utility
// =============================================================================
const isDebugMode = () => Deno.env.get('DEBUG') === 'true';
const debugLog = (...args: any[]) => {
  if (isDebugMode()) {
    console.log(...args);
  }
};

console.log('Fonnte Webhook Function Started');

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

    // 4. Find or create conversation
    const conversation = await findOrCreateConversation(
      normalized.sender,
      normalized.device,
      normalized.name
    );
    conversationId = conversation.id;

    console.log('Conversation:', {
      id: conversation.id,
      sessionId: conversation.session_id,
      isNew: conversation.session_id.startsWith('temp_')
    });

    // 5. Get next message index
    const messageIndex = await getNextMessageIndex(conversation.id);

    // 6. Prepare message content
    // For image-only messages, use placeholder for database storage
    // The actual image URL will be appended in buildFlowiseRequest
    const messageContent = normalized.message ||
      (normalized.hasAttachment ? '[Gambar]' : '');

    // 7. Save user message (without attachment details yet)
    const userMessage = await saveMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: messageContent,
      message_index: messageIndex,
      has_attachment: normalized.hasAttachment
    });

    console.log('User message saved:', {
      messageId: userMessage.id,
      index: messageIndex
    });

    // 8. Process attachment if present
    let attachmentResult = null;
    let attachmentError = null;

    if (normalized.url && normalized.filename && normalized.extension) {
      console.log('✓ Starting attachment processing:', normalized.filename);

      try {
        attachmentResult = await processAttachmentSafe(
          normalized.url,
          normalized.filename,
          normalized.extension,
          userMessage.id
        );

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
    } else {
      // Attachment fields missing - this is the most likely issue!
      console.warn('✗ Skipping attachment processing - missing required fields');
    }

    // 9. Get conversation history (excluding the just-saved user message)
    const history = await getConversationHistory(conversation.id);
    // Remove the last message (current user message) from history for Flowise
    const historyForFlowise = history.slice(0, -1);

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

    // 11. Call Flowise API with retry
    const { response: flowiseResponse } = await callFlowiseWithRetry(flowiseRequest);

    console.log('Flowise API response received');

    // 12. Extract session ID (CRITICAL for first message)
    const flowiseSessionId = extractSessionId(flowiseResponse);
    if (flowiseSessionId && conversation.session_id.startsWith('temp_')) {
      console.log('Updating conversation with Flowise sessionId:', flowiseSessionId);
      await updateConversationSessionId(conversation.id, flowiseSessionId);
    }

    // 13. Extract response text
    const responseText = extractResponseText(flowiseResponse);

    // 14. Save assistant response
    await saveMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: responseText,
      message_index: messageIndex + 1
    });

    console.log('Assistant response saved');

    // 15. Prepare response message
    let finalResponseText = responseText;

    // Add attachment error message if applicable
    if (attachmentError) {
      finalResponseText = `${responseText}\n\n_Catatan: ${attachmentError}_`;
    }

    // 16. Send response to WhatsApp via Fonnte API
    console.log('Sending message to WhatsApp via Fonnte...');

    try {
      const fonnteConfig = await getFonnteConfig();

      if (!fonnteConfig.api_token) {
        throw new Error('Fonnte API token not configured');
      }

      const sendResult = await sendFonnteMessageWithRetry({
        target: normalized.sender,
        message: finalResponseText,
        token: fonnteConfig.api_token
      });

      if (!sendResult.status) {
        console.error('Failed to send message to WhatsApp:', sendResult.error);

        // Log error but don't throw - message is already saved in DB
        await logWebhookError({
          source: 'fonnte-send',
          error_type: 'FonnteSendError',
          error_message: sendResult.error || 'Failed to send message to WhatsApp',
          payload: {
            target: '***' + normalized.sender.slice(-4),
            messageLength: finalResponseText.length
          },
          conversation_id: conversationId
        });
      } else {
        console.log('Message sent to WhatsApp successfully');
      }
    } catch (sendError) {
      console.error('Error sending message to WhatsApp:', sendError);

      // Log error but don't crash webhook
      await logWebhookError({
        source: 'fonnte-send',
        error_type: 'FonnteSendException',
        error_message: sendError instanceof Error ? sendError.message : 'Unknown error',
        error_stack: sendError instanceof Error ? sendError.stack : undefined,
        payload: { target: '***' + normalized.sender.slice(-4) },
        conversation_id: conversationId
      });
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
    console.error('Webhook processing error:', error);

    // Type-safe error handling
    const err = error instanceof Error ? error : new Error(String(error));

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