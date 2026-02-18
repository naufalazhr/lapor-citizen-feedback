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

// Debug utility
const debugLog = (...args: any[]) => {
  if (Deno.env.get('DEBUG') === 'true') {
    console.log(...args);
  }
};

// -----------------------------------------------------------------------------
// Get Active Flowise Configuration
// -----------------------------------------------------------------------------
export async function getFlowiseConfig(tenantId?: string | null): Promise<FlowiseConfig> {
  let query = supabase
    .from('flowise_config')
    .select('*')
    .eq('is_active', true);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

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
  location?: { lat: number; lng: number };
}): FlowiseRequest {
  const {
    userMessage,
    conversation,
    conversationHistory,
    attachment,
    senderName,
    phoneNumber,
    location
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

  // Build question with image URL and location included as text
  // Flowise automatically detects URLs in question field and processes them as images
  let finalQuestion = userMessage;

  // Add attachment URL if present
  if (attachment) {
    // If there's text, append image URL after text
    // If no text (image-only), just use the URL as the question
    if (userMessage && userMessage.trim()) {
      finalQuestion = `${userMessage}\n\n${attachment.storageUrl}`;
    } else {
      finalQuestion = attachment.storageUrl;
    }
  }

  // Add location data as TEXT INPUT (not overrideConfig)
  // Flowise can read this from the question field
  // Format: "lat, lng" that Flowise geo_location input can parse
  if (location) {
    const locationText = `${location.lat}, ${location.lng}`;

    // If there's existing content (message or attachment), append location with label
    // If location-only message, send just the coordinates
    if (finalQuestion && finalQuestion.trim()) {
      finalQuestion = `${finalQuestion}\n\nLocation: ${locationText}`;
    } else {
      finalQuestion = locationText;
    }

    debugLog('📍 Adding location to question:', locationText);
  }

  return {
    question: finalQuestion,  // Image URL included directly in question
    streaming: false, // Will be overridden by config
    overrideConfig,
    history: conversationHistory.length > 0 ? conversationHistory : undefined
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

  debugLog('Flowise API request:', {
    hasSessionId: !!mergedOverrideConfig.sessionId,
    hasHistory: !!request.history,
    questionLength: request.question.length
  });

  // Debug: Log full request body only in DEBUG mode
  debugLog('📤 FLOWISE REQUEST BODY:', JSON.stringify(requestBody, null, 2));

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

    // DIAGNOSTIC: Log Flowise response
    console.log('📥 Flowise API Response:', {
      hasText: !!data.text,
      hasResponse: !!data.response,
      hasChatId: !!data.chatId,
      textPreview: (data.text || data.response || '').substring(0, 200),
      allFields: Object.keys(data)
    });

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
  maxRetries: number = 3,
  tenantId?: string | null
): Promise<{ response: FlowiseResponse; config: FlowiseConfig }> {
  const config = await getFlowiseConfig(tenantId);
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callFlowiseAPI(request, config);
      if (attempt > 1) {
        console.log('Flowise API success on retry attempt', attempt);
      }
      return { response, config };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      console.error(`Flowise API attempt ${attempt} failed:`, err.message);

      // Don't retry on 4xx errors (client errors - wrong API key, bad request, etc.)
      if (err.message.includes('400') ||
          err.message.includes('401') ||
          err.message.includes('403') ||
          err.message.includes('404')) {
        console.error('4xx error from Flowise API - not retrying');
        throw err;
      }

      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        debugLog(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(`Flowise API failed after ${maxRetries} attempts:`, lastError?.message);
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