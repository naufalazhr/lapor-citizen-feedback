// =============================================================================
// Twilio Provider - WhatsApp messaging via Twilio API
// Implements IWhatsAppProvider interface for provider abstraction
// =============================================================================

import type { IWhatsAppProvider, WhatsAppSendParams, WhatsAppSendResponse } from './types.ts';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
const SEND_TIMEOUT = 15000; // 15 seconds (Twilio can be slower than Fonnte)
const RETRY_DELAY = 1500; // 1.5 seconds between retries

// Debug utility
const debugLog = (...args: any[]) => {
  if (Deno.env.get('DEBUG') === 'true') {
    console.log(...args);
  }
};

/**
 * Twilio WhatsApp Provider
 * Uses Twilio REST API to send WhatsApp messages
 */
export class TwilioProvider implements IWhatsAppProvider {
  readonly name = 'twilio' as const;
  private accountSid: string;
  private authToken: string;
  private fromNumber: string; // Format: whatsapp:+14155238886

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  /**
   * Format phone number for Twilio WhatsApp API
   * Twilio requires: whatsapp:+628123456789
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Handle Indonesian numbers - ensure starts with 62
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }

    // Twilio WhatsApp format: whatsapp:+{number}
    return `whatsapp:+${cleaned}`;
  }

  /**
   * Check if Twilio is properly configured
   */
  validateConfig(): boolean {
    return !!(
      this.accountSid &&
      this.accountSid.startsWith('AC') &&
      this.authToken &&
      this.authToken.length > 0 &&
      this.fromNumber &&
      this.fromNumber.startsWith('whatsapp:')
    );
  }

  /**
   * Send a message via Twilio API
   */
  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const url = `${TWILIO_API_BASE}/Accounts/${this.accountSid}/Messages.json`;
    const toNumber = this.formatPhoneNumber(params.target);

    debugLog('Sending message via Twilio:', {
      to: '***' + toNumber.slice(-4),
      from: this.fromNumber,
      messageLength: params.message.length
    });

    // Validate inputs
    if (!params.target || !params.message) {
      return {
        status: false,
        error: 'Missing required parameters: target or message',
        provider: 'twilio'
      };
    }

    if (!this.validateConfig()) {
      return {
        status: false,
        error: 'Twilio credentials not properly configured',
        provider: 'twilio'
      };
    }

    // Build form data (Twilio uses URL-encoded form data)
    const formData = new URLSearchParams();
    formData.append('To', toNumber);
    formData.append('From', this.fromNumber);
    formData.append('Body', params.message);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Parse response
      const responseData = await response.json();
      debugLog('Twilio API response:', response.status, JSON.stringify(responseData).substring(0, 200));

      if (!response.ok) {
        // Twilio error response format
        const errorMessage = responseData.message || responseData.error_message || 'Unknown Twilio error';
        const errorCode = responseData.code || responseData.error_code || response.status;

        console.error('Twilio API error:', {
          status: response.status,
          code: errorCode,
          message: errorMessage
        });

        return {
          status: false,
          error: `Twilio API error ${errorCode}: ${errorMessage}`,
          provider: 'twilio'
        };
      }

      // Twilio success response
      return {
        status: true,
        message: 'Message sent successfully',
        messageId: responseData.sid,
        detail: responseData.status, // 'queued', 'sending', 'sent', etc.
        provider: 'twilio'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Twilio API timeout');
        return {
          status: false,
          error: 'Twilio API timeout',
          provider: 'twilio'
        };
      }

      console.error('Twilio API error:', error);
      return {
        status: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'twilio'
      };
    }
  }

  /**
   * Send a message with retry logic
   * Retries once on failure (matching Fonnte behavior)
   */
  async sendMessageWithRetry(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    // First attempt
    const firstAttempt = await this.sendMessage(params);

    if (firstAttempt.status) {
      return firstAttempt;
    }

    // If first attempt failed, retry once
    console.log('Twilio send failed, retrying...');
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

    const secondAttempt = await this.sendMessage(params);

    if (secondAttempt.status) {
      console.log('Twilio send succeeded on retry');
    } else {
      console.error('Twilio send failed after retry:', secondAttempt.error);
    }

    return secondAttempt;
  }
}
