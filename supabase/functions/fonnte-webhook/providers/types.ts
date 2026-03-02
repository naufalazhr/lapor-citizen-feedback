// =============================================================================
// WhatsApp Provider Interface - Abstraction for Multiple Providers
// Supports Fonnte and Twilio (with easy extension for future providers)
// =============================================================================

/**
 * Supported WhatsApp messaging providers
 */
export type WhatsAppProviderType = 'fonnte' | 'twilio' | 'infobip' | 'whatsapp_cloud';

/**
 * Parameters for sending a WhatsApp message
 */
export interface WhatsAppSendParams {
  /** Phone number (will be normalized per provider) */
  target: string;
  /** Message text content */
  message: string;
}

/**
 * Response from sending a WhatsApp message
 */
export interface WhatsAppSendResponse {
  /** Whether the message was sent successfully */
  status: boolean;
  /** Success message or additional info */
  message?: string;
  /** Detailed response info */
  detail?: string;
  /** Error message if failed */
  error?: string;
  /** Which provider handled this message */
  provider: WhatsAppProviderType;
  /** Provider-specific message ID (Twilio SID, etc.) */
  messageId?: string;
}

/**
 * Provider configuration from database
 */
export interface WhatsAppProviderConfig {
  id: string;
  tenant_id: string;
  provider: WhatsAppProviderType;
  is_active: boolean;
  twilio_from_number?: string;
  config_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for WhatsApp messaging providers
 * All providers must implement this interface
 */
export interface IWhatsAppProvider {
  /** Provider identifier */
  readonly name: WhatsAppProviderType;

  /**
   * Send a message via this provider
   * @param params - Target phone and message content
   * @returns Response with status and details
   */
  sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResponse>;

  /**
   * Send a message with automatic retry on failure
   * @param params - Target phone and message content
   * @returns Response with status and details
   */
  sendMessageWithRetry(params: WhatsAppSendParams): Promise<WhatsAppSendResponse>;

  /**
   * Format phone number according to provider requirements
   * @param phoneNumber - Raw phone number
   * @returns Formatted phone number for this provider
   */
  formatPhoneNumber(phoneNumber: string): string;

  /**
   * Check if provider is properly configured
   * @returns true if all required credentials are available
   */
  validateConfig(): boolean;
}
