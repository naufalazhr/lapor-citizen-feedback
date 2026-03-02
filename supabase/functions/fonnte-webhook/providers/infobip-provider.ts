// =============================================================================
// Infobip Provider - WhatsApp messaging via Infobip Messages API
// Implements IWhatsAppProvider interface for provider abstraction
// =============================================================================

import type { IWhatsAppProvider, WhatsAppSendParams, WhatsAppSendResponse } from './types.ts';

const SEND_TIMEOUT = 15000; // 15 seconds
const RETRY_DELAY = 1500;   // 1.5 seconds between retries

// Debug utility
const debugLog = (...args: any[]) => {
  if (Deno.env.get('DEBUG') === 'true') {
    console.log(...args);
  }
};

/**
 * Infobip WhatsApp Provider
 * Uses Infobip Messages API to send WhatsApp messages
 * Auth: Authorization: App {apiKey}
 * Send: POST https://{baseUrl}/messages-api/1/messages
 */
export class InfobipProvider implements IWhatsAppProvider {
  readonly name = 'infobip' as const;

  constructor(
    private apiKey: string,
    private baseUrl: string,
    private senderNumber: string
  ) {}

  /**
   * Format phone number for Infobip WhatsApp API
   * Infobip requires plain E.164 without '+' (e.g. 628123456789)
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Handle Indonesian numbers — 0xxx → 62xxx
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if Infobip is properly configured
   */
  validateConfig(): boolean {
    return !!(
      this.apiKey &&
      this.apiKey.length > 0 &&
      this.baseUrl &&
      this.baseUrl.length > 0 &&
      this.senderNumber &&
      this.senderNumber.length > 0
    );
  }

  /**
   * Send a message via Infobip Messages API
   */
  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const toNumber = this.formatPhoneNumber(params.target);
    const url = `https://${this.baseUrl}/messages-api/1/messages`;

    debugLog('Sending message via Infobip:', {
      to: '***' + toNumber.slice(-4),
      from: this.senderNumber,
      messageLength: params.message.length
    });

    if (!params.target || !params.message) {
      return {
        status: false,
        error: 'Missing required parameters: target or message',
        provider: 'infobip'
      };
    }

    if (!this.validateConfig()) {
      return {
        status: false,
        error: 'Infobip credentials not properly configured',
        provider: 'infobip'
      };
    }

    const body = {
      messages: [{
        channel: 'WHATSAPP',
        sender: this.senderNumber,
        destinations: [{ to: toNumber }],
        content: {
          body: {
            type: 'TEXT',
            text: params.message
          }
        }
      }]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `App ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();
      debugLog('Infobip API response:', response.status, JSON.stringify(responseData).substring(0, 200));

      if (!response.ok) {
        // Infobip error response format
        const errorText =
          responseData?.requestError?.serviceException?.text ||
          responseData?.requestError?.serviceException?.messageId ||
          `HTTP ${response.status}`;

        console.error('Infobip API error:', {
          status: response.status,
          error: errorText
        });

        return {
          status: false,
          error: `Infobip API error: ${errorText}`,
          provider: 'infobip'
        };
      }

      // Infobip success — extract first message ID from response
      const messageId = responseData?.messages?.[0]?.messageId;

      return {
        status: true,
        message: 'Message sent successfully',
        messageId,
        provider: 'infobip'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Infobip API timeout');
        return {
          status: false,
          error: 'Infobip API timeout',
          provider: 'infobip'
        };
      }

      console.error('Infobip API error:', error);
      return {
        status: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'infobip'
      };
    }
  }

  /**
   * Send a message with retry logic
   * Retries once on failure (matching Twilio/Fonnte pattern)
   */
  async sendMessageWithRetry(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const firstAttempt = await this.sendMessage(params);

    if (firstAttempt.status) {
      return firstAttempt;
    }

    console.log('Infobip send failed, retrying...');
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

    const secondAttempt = await this.sendMessage(params);

    if (secondAttempt.status) {
      console.log('Infobip send succeeded on retry');
    } else {
      console.error('Infobip send failed after retry:', secondAttempt.error);
    }

    return secondAttempt;
  }
}
