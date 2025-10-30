// =============================================================================
// Fonnte Webhook Handler
// Main entry point for WhatsApp messages from Fonnte
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import type { FonnteWebhookPayload } from './types.ts';
import { ERROR_MESSAGES } from './types.ts';

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
    payload = await req.json() as FonnteWebhookPayload;
    console.log('Received webhook from Fonnte:', {
      sender: payload.sender,
      device: payload.device,
      hasAttachment: !!payload.url,
      messageLength: payload.message?.length || 0
    });

    // 2. Validate required fields
    if (!payload.sender || !payload.message || !payload.device) {
      throw new Error('Missing required fields: sender, message, or device');
    }

    // 3. Find or create conversation
    const conversation = await findOrCreateConversation(
      payload.sender,
      payload.device,
      payload.name
    );
    conversationId = conversation.id;

    console.log('Conversation:', {
      id: conversation.id,
      sessionId: conversation.session_id,
      isNew: conversation.session_id.startsWith('temp_')
    });

    // 4. Get next message index
    const messageIndex = await getNextMessageIndex(conversation.id);

    // 5. Save user message (without attachment details yet)
    const userMessage = await saveMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: payload.message,
      message_index: messageIndex,
      has_attachment: !!payload.url
    });

    console.log('User message saved:', {
      messageId: userMessage.id,
      index: messageIndex
    });

    // 6. Process attachment if present
    let attachmentResult = null;
    let attachmentError = null;

    if (payload.url && payload.filename && payload.extension) {
      console.log('Processing attachment:', {
        filename: payload.filename,
        extension: payload.extension
      });

      try {
        attachmentResult = await processAttachmentSafe(
          payload.url,
          payload.filename,
          payload.extension,
          userMessage.id
        );

        if (attachmentResult) {
          // Update message with attachment details
          await saveMessage({
            conversation_id: conversation.id,
            role: 'system',
            content: `Attachment processed: ${attachmentResult.filename}`,
            message_index: messageIndex + 0.5, // Between user message and assistant response
            has_attachment: false
          });
          console.log('Attachment processed successfully');
        }
      } catch (error) {
        console.error('Attachment processing error:', error);
        attachmentError = error instanceof Error ? error.message : String(error);
        // Continue without attachment - will be logged
      }
    }

    // 7. Get conversation history (excluding the just-saved user message)
    const history = await getConversationHistory(conversation.id);
    // Remove the last message (current user message) from history for Flowise
    const historyForFlowise = history.slice(0, -1);

    // 8. Build Flowise request
    const flowiseRequest = buildFlowiseRequest({
      userMessage: payload.message,
      conversation,
      conversationHistory: historyForFlowise,
      attachment: attachmentResult,
      senderName: payload.name,
      phoneNumber: payload.sender
    });

    console.log('Calling Flowise API...', {
      hasHistory: historyForFlowise.length > 0,
      hasAttachment: !!attachmentResult,
      hasSessionId: !!flowiseRequest.overrideConfig?.sessionId
    });

    // 9. Call Flowise API with retry
    const { response: flowiseResponse } = await callFlowiseWithRetry(flowiseRequest);

    console.log('Flowise API response received');

    // 10. Extract session ID (CRITICAL for first message)
    const flowiseSessionId = extractSessionId(flowiseResponse);
    if (flowiseSessionId && conversation.session_id.startsWith('temp_')) {
      console.log('Updating conversation with Flowise sessionId:', flowiseSessionId);
      await updateConversationSessionId(conversation.id, flowiseSessionId);
    }

    // 11. Extract response text
    const responseText = extractResponseText(flowiseResponse);

    // 12. Save assistant response
    await saveMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: responseText,
      message_index: messageIndex + 1
    });

    console.log('Assistant response saved');

    // 13. Prepare response message
    let finalResponseText = responseText;

    // Add attachment error message if applicable
    if (attachmentError) {
      finalResponseText = `${responseText}\n\n_Catatan: ${attachmentError}_`;
    }

    // 14. Send response to WhatsApp via Fonnte API
    console.log('Sending message to WhatsApp via Fonnte...');

    try {
      const fonnteConfig = await getFonnteConfig();

      if (!fonnteConfig.api_token) {
        throw new Error('Fonnte API token not configured');
      }

      const sendResult = await sendFonnteMessageWithRetry({
        target: payload.sender,
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
            target: '***' + payload.sender.slice(-4),
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
        payload: { target: '***' + payload.sender.slice(-4) },
        conversation_id: conversationId
      });
    }

    // 15. Return webhook acknowledgment
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