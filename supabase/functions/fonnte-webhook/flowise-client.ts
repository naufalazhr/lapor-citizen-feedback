// =============================================================================
// Flowise API Client
// Handles communication with Flowise Prediction API
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ERROR_MESSAGES,
  type FlowiseConfig,
  type FlowiseRequest,
  type FlowiseResponse,
  type Conversation,
  type AttachmentResult
} from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// -----------------------------------------------------------------------------
// Get Active Flowise Configuration
// -----------------------------------------------------------------------------
export async function getFlowiseConfig(): Promise<FlowiseConfig> {
  const { data, error } = await supabase
    .from('flowise_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(ERROR_MESSAGES.NO_FLOWISE_CONFIG);
  }

  return data as FlowiseConfig;
}

// -----------------------------------------------------------------------------
// Extract Session ID from Flowise Response
// CRITICAL: Flowise generates chatId on first API call
// We must extract and store it for subsequent calls
// Based on actual Flowise response, the session ID is in "chatId" field
// -----------------------------------------------------------------------------
export function extractSessionId(response: FlowiseResponse): string | null {
  // Priority order based on actual Flowise response structure
  return response.chatId ||           // Primary field (confirmed from response.json)
         response.sessionId ||         // Alternative field name
         response.chatMessageId ||     // Fallback
         null;
}

// -----------------------------------------------------------------------------
// Build Flowise Request
// -----------------------------------------------------------------------------
export function buildFlowiseRequest(params: {
  userMessage: string;
  conversation: Conversation;
  conversationHistory: Array<{ role: 'userMessage' | 'apiMessage'; content: string }>;
  attachment?: AttachmentResult | null;
  senderName?: string;
  phoneNumber: string;
}): FlowiseRequest {
  const {
    userMessage,
    conversation,
    conversationHistory,
    attachment,
    senderName,
    phoneNumber
  } = params;

  // Build overrideConfig
  const overrideConfig: Record<string, any> = {
    phoneNumber,
    userName: senderName || 'User'
  };

  // CRITICAL: Include sessionId for subsequent messages
  // Only include if this is NOT the first message (session_id doesn't start with "temp_")
  if (conversation.session_id && !conversation.session_id.startsWith('temp_')) {
    overrideConfig.sessionId = conversation.session_id;
  }

  // Build uploads array if attachment exists
  const uploads = attachment ? [{
    type: 'file' as const,
    name: attachment.filename,
    data: attachment.base64DataUri,
    mime: attachment.mimeType
  }] : undefined;

  return {
    question: userMessage,
    streaming: false, // Will be overridden by config
    overrideConfig,
    history: conversationHistory.length > 0 ? conversationHistory : undefined,
    uploads
  };
}

// -----------------------------------------------------------------------------
// Call Flowise API
// -----------------------------------------------------------------------------
async function callFlowiseAPI(
  request: FlowiseRequest,
  config: FlowiseConfig
): Promise<FlowiseResponse> {
  const url = `${config.api_url}/api/v1/prediction/${config.chatflow_id}`;

  // Merge session_variables from config with request overrideConfig
  const mergedOverrideConfig = {
    ...config.session_variables,
    ...request.overrideConfig
  };

  const requestBody = {
    ...request,
    streaming: config.streaming,
    overrideConfig: mergedOverrideConfig
  };

  console.log('Calling Flowise API:', {
    url,
    hasSessionId: !!mergedOverrideConfig.sessionId,
    hasHistory: !!request.history,
    hasUploads: !!request.uploads
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout_seconds * 1000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flowise API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data as FlowiseResponse;

  } catch (error) {
    clearTimeout(timeoutId);

    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'AbortError') {
      throw new Error(ERROR_MESSAGES.FLOWISE_TIMEOUT);
    }

    throw err;
  }
}

// -----------------------------------------------------------------------------
// Call Flowise API with Retry Logic
// Retries on network errors and 5xx errors, not on 4xx errors
// -----------------------------------------------------------------------------
export async function callFlowiseWithRetry(
  request: FlowiseRequest,
  maxRetries: number = 3
): Promise<{ response: FlowiseResponse; config: FlowiseConfig }> {
  const config = await getFlowiseConfig();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callFlowiseAPI(request, config);
      console.log('Flowise API success on attempt', attempt);
      return { response, config };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      console.error(`Flowise API attempt ${attempt} failed:`, err.message);
      console.error('Full error:', err);

      // Don't retry on 4xx errors (client errors - wrong API key, bad request, etc.)
      if (err.message.includes('400') ||
          err.message.includes('401') ||
          err.message.includes('403') ||
          err.message.includes('404')) {
        // Log the actual error before throwing generic message
        console.error('4xx error from Flowise API:', err.message);
        throw err; // Throw the actual error instead of generic message
      }

      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(`Flowise API failed after ${maxRetries} attempts`);
  console.error('Last error:', lastError);
  throw lastError || new Error('Unknown error in Flowise API'); // Throw the actual error instead of generic message
}

// -----------------------------------------------------------------------------
// Extract Response Text from Flowise Response
// Flowise response format may vary, try different fields
// -----------------------------------------------------------------------------
export function extractResponseText(response: FlowiseResponse): string {
  return response.text ||
         response.response ||
         response.answer ||
         JSON.stringify(response);
}