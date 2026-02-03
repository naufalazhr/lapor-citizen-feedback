// =============================================================================
// Fonnte Provider - Wrapper around existing fonnte-client.ts
// Implements IWhatsAppProvider interface for provider abstraction
// =============================================================================

import type { IWhatsAppProvider, WhatsAppSendParams, WhatsAppSendResponse } from './types.ts';
import { sendFonnteMessage, sendFonnteMessageWithRetry } from '../fonnte-client.ts';

/**
 * Fonnte WhatsApp Provider
 * Wraps the existing Fonnte API client to match the provider interface
 */
export class FonnteProvider implements IWhatsAppProvider {
  readonly name = 'fonnte' as const;
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Format phone number for Fonnte API
   * Fonnte expects plain numbers: 628123456789
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

    return cleaned;
  }

  /**
   * Check if Fonnte is properly configured
   */
  validateConfig(): boolean {
    return !!this.apiToken && this.apiToken.length > 0;
  }

  /**
   * Send a message via Fonnte API
   */
  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const result = await sendFonnteMessage({
      target: this.formatPhoneNumber(params.target),
      message: params.message,
      token: this.apiToken
    });

    return {
      ...result,
      provider: 'fonnte'
    };
  }

  /**
   * Send a message with retry logic via Fonnte API
   */
  async sendMessageWithRetry(params: WhatsAppSendParams): Promise<WhatsAppSendResponse> {
    const result = await sendFonnteMessageWithRetry({
      target: this.formatPhoneNumber(params.target),
      message: params.message,
      token: this.apiToken
    });

    return {
      ...result,
      provider: 'fonnte'
    };
  }
}
