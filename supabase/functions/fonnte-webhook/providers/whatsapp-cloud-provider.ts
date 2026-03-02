// =============================================================================
// WhatsApp Cloud Provider - WhatsApp messaging via Meta Graph API (Cloud API)
// Implements IWhatsAppProvider interface for provider abstraction
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
// =============================================================================

import type { IWhatsAppProvider, WhatsAppSendParams, WhatsAppSendResponse } from './types.ts';

const SEND_TIMEOUT = 15000; // 15 seconds
const RETRY_DELAY = 1500;   // 1.5 seconds between retries
const GRAPH_API_VERSION = 'v19.0';

// Debug utility
const debugLog = (...args: any[]) => {
  if (Deno.env.get('DEBUG') === 'true') {
    console.log(...args);
  }
};

/**
 * WhatsApp Cloud Provider (Meta Graph API)
 * Uses Meta Graph API to send WhatsApp messages via WhatsApp Business Cloud API
 * Auth: Authorization: Bearer {accessToken}
 * Send: POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages
 */
export class WhatsAppCloudProvider implements IWhatsAppProvider {
  readonly name = 'whatsapp_cloud' as const;

  constructor(
    private phoneNumberId: string,
    private accessToken: string
  ) {}

  /**
   * Format phone number for Meta WhatsApp Cloud API
   * Meta requires E.164 without '+' (e.g. 628123456789)
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
   * Check if WhatsApp Cloud is properly configured
   */
  validateConfig(): boolean {
    return !!(
      this.phoneNumberId &&
      this.phoneNumberId.length > 0 &&
      this.accessToken &&
      this.accessToken.length > 0
    );
  }

  /**
   * Send a message via Meta Graph API (WhatsApp Cloud)
   */
  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const toNumber = this.formatPhoneNumber(params.target);
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;

    debugLog('Sending message via WhatsApp Cloud:', {
      to: '***' + toNumber.slice(-4),
      phoneNumberId: this.phoneNumberId,
      messageLength: params.message.length
    });

    if (!params.target || !params.message) {
      return {
        status: false,
        error: 'Missing required parameters: target or message',
        provider: 'whatsapp_cloud'
      };
    }

    if (!this.validateConfig()) {
      return {
        status: false,
        error: 'WhatsApp Cloud credentials not properly configured',
        provider: 'whatsapp_cloud'
      };
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: params.message
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();
      debugLog('WhatsApp Cloud API response:', response.status, JSON.stringify(responseData).substring(0, 200));

      if (!response.ok) {
        // Meta error response format: { error: { message, type, code } }
        const errorText =
          responseData?.error?.message ||
          responseData?.error?.type ||
          `HTTP ${response.status}`;

        console.error('WhatsApp Cloud API error:', {
          status: response.status,
          error: errorText,
          code: responseData?.error?.code
        });

        return {
          status: false,
          error: `WhatsApp Cloud API error: ${errorText}`,
          provider: 'whatsapp_cloud'
        };
      }

      // Meta success — extract message ID: data.messages[0].id
      const messageId = responseData?.messages?.[0]?.id;

      return {
        status: true,
        message: 'Message sent successfully',
        messageId,
        provider: 'whatsapp_cloud'
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('WhatsApp Cloud API timeout');
        return {
          status: false,
          error: 'WhatsApp Cloud API timeout',
          provider: 'whatsapp_cloud'
        };
      }

      console.error('WhatsApp Cloud API error:', error);
      return {
        status: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'whatsapp_cloud'
      };
    }
  }

  /**
   * Send a message with retry logic
   * Retries once on failure after 1500ms
   */
  async sendMessageWithRetry(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const firstAttempt = await this.sendMessage(params);

    if (firstAttempt.status) {
      return firstAttempt;
    }

    console.log('WhatsApp Cloud send failed, retrying...');
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

    const secondAttempt = await this.sendMessage(params);

    if (secondAttempt.status) {
      console.log('WhatsApp Cloud send succeeded on retry');
    } else {
      console.error('WhatsApp Cloud send failed after retry:', secondAttempt.error);
    }

    return secondAttempt;
  }
}
