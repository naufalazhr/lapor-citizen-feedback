// =============================================================================
// Fonnte API Client
// Handles sending messages to WhatsApp via Fonnte Send API
// =============================================================================

import type { FonnteSendResponse } from './types.ts';

const FONNTE_SEND_API = 'https://api.fonnte.com/send';
const SEND_TIMEOUT = 10000; // 10 seconds

// -----------------------------------------------------------------------------
// Send Message to WhatsApp via Fonnte
// -----------------------------------------------------------------------------
export async function sendFonnteMessage(params: {
  target: string;      // Phone number (e.g., "628123456789")
  message: string;     // Message text
  token: string;       // Fonnte API token
}): Promise<FonnteSendResponse> {
  const { target, message, token } = params;

  console.log('Sending message to WhatsApp:', {
    target: '***' + target.slice(-4), // Redact phone number for security
    messageLength: message.length,
    hasToken: !!token
  });

  // Validate inputs
  if (!target || !message || !token) {
    return {
      status: false,
      error: 'Missing required parameters: target, message, or token'
    };
  }

  // Construct FormData as per Fonnte API specification
  const formData = new FormData();
  formData.append('target', target);
  formData.append('message', message);
  formData.append('countryCode', '62'); // Indonesia country code

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT);

  try {
    const response = await fetch(FONNTE_SEND_API, {
      method: 'POST',
      headers: {
        'Authorization': token
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Parse response
    const responseText = await response.text();
    console.log('Fonnte send API response:', {
      status: response.status,
      statusText: response.statusText,
      response: responseText.substring(0, 200) // Truncate for logging
    });

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If not JSON, treat as text
      responseData = { text: responseText };
    }

    if (!response.ok) {
      return {
        status: false,
        error: `Fonnte API error ${response.status}: ${responseText}`
      };
    }

    // Fonnte API successful response
    return {
      status: true,
      message: responseData.message || 'Message sent successfully',
      detail: responseData.detail || responseData.text
    };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('Fonnte send API timeout');
      return {
        status: false,
        error: 'Fonnte send API timeout'
      };
    }

    console.error('Fonnte send API error:', error);
    return {
      status: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// -----------------------------------------------------------------------------
// Send Message with Retry
// Retries once on failure (network errors, timeouts)
// -----------------------------------------------------------------------------
export async function sendFonnteMessageWithRetry(params: {
  target: string;
  message: string;
  token: string;
}): Promise<FonnteSendResponse> {
  // First attempt
  const firstAttempt = await sendFonnteMessage(params);

  if (firstAttempt.status) {
    console.log('Fonnte send succeeded on first attempt');
    return firstAttempt;
  }

  // If first attempt failed, retry once
  console.log('Fonnte send failed, retrying...', firstAttempt.error);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

  const secondAttempt = await sendFonnteMessage(params);

  if (secondAttempt.status) {
    console.log('Fonnte send succeeded on retry');
  } else {
    console.error('Fonnte send failed after retry:', secondAttempt.error);
  }

  return secondAttempt;
}
