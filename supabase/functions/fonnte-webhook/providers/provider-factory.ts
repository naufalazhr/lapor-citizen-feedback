// =============================================================================
// WhatsApp Provider Factory
// Creates the appropriate provider based on database configuration
// Falls back to Fonnte for backward compatibility
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { IWhatsAppProvider, WhatsAppProviderType, WhatsAppProviderConfig } from './types.ts';
import { FonnteProvider } from './fonnte-provider.ts';
import { TwilioProvider } from './twilio-provider.ts';
import { InfobipProvider } from './infobip-provider.ts';
import { WhatsAppCloudProvider } from './whatsapp-cloud-provider.ts';

// Debug utility
const debugLog = (...args: any[]) => {
  if (Deno.env.get('DEBUG') === 'true') {
    console.log(...args);
  }
};

/**
 * Create a WhatsApp provider based on database configuration
 * Falls back to Fonnte if no configuration exists (backward compatibility)
 */
export async function createWhatsAppProvider(): Promise<IWhatsAppProvider> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get the single active provider configuration
  const { data: providerConfig, error } = await supabase
    .from('whatsapp_provider_config')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  // If no config found or error, fall back to Fonnte
  if (error || !providerConfig) {
    debugLog('No WhatsApp provider config found, falling back to Fonnte');
    return await createFonnteProvider(supabase);
  }

  const config = providerConfig as WhatsAppProviderConfig;
  debugLog('WhatsApp provider config:', { provider: config.provider });

  // Create appropriate provider
  switch (config.provider) {
    case 'twilio':
      return await createTwilioProvider(config);
    case 'infobip':
      return await createInfobipProvider(config, supabase);
    case 'whatsapp_cloud':
      return await createWhatsAppCloudProvider(config, supabase);
    case 'fonnte':
    default:
      return await createFonnteProvider(supabase);
  }
}

/**
 * Create Fonnte provider with credentials from database
 */
async function createFonnteProvider(supabase: ReturnType<typeof createClient>): Promise<FonnteProvider> {
  const { data, error } = await supabase
    .from('fonnte_config')
    .select('api_token')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data?.api_token) {
    throw new Error('No active Fonnte configuration found. Please configure Fonnte API token.');
  }

  const provider = new FonnteProvider(data.api_token);

  if (!provider.validateConfig()) {
    throw new Error('Fonnte API token is invalid or empty.');
  }

  console.log('Created Fonnte provider');
  return provider;
}

/**
 * Create Twilio provider with credentials from Supabase secrets
 */
async function createTwilioProvider(config: WhatsAppProviderConfig): Promise<TwilioProvider> {
  // Get Twilio credentials from environment (Supabase secrets)
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  // From number can be in config or env (config takes priority)
  const fromNumber = config.twilio_from_number || Deno.env.get('TWILIO_FROM_NUMBER');

  // Validate all required credentials
  if (!accountSid) {
    throw new Error('TWILIO_ACCOUNT_SID not configured. Add it to Supabase secrets.');
  }
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN not configured. Add it to Supabase secrets.');
  }
  if (!fromNumber) {
    throw new Error('Twilio from number not configured. Set TWILIO_FROM_NUMBER in secrets or twilio_from_number in config.');
  }

  const provider = new TwilioProvider(accountSid, authToken, fromNumber);

  if (!provider.validateConfig()) {
    throw new Error('Twilio credentials are invalid. Check Account SID format (should start with AC) and from number format (should start with whatsapp:).');
  }

  console.log('Created Twilio provider');
  return provider;
}

/**
 * Create Infobip provider with credentials from infobip_config table
 */
async function createInfobipProvider(
  config: WhatsAppProviderConfig,
  supabase: ReturnType<typeof createClient>
): Promise<InfobipProvider> {
  const { data, error } = await supabase
    .from('infobip_config')
    .select('api_key, base_url, sender_number')
    .eq('tenant_id', config.tenant_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No active Infobip configuration found. Please configure Infobip API settings.');
  }

  if (!data.api_key || !data.base_url || !data.sender_number) {
    throw new Error('Infobip configuration is incomplete. Please provide api_key, base_url, and sender_number.');
  }

  const provider = new InfobipProvider(data.api_key, data.base_url, data.sender_number);

  if (!provider.validateConfig()) {
    throw new Error('Infobip credentials are invalid.');
  }

  console.log('Created Infobip provider');
  return provider;
}

/**
 * Create WhatsApp Cloud provider with credentials from whatsapp_cloud_config table
 */
async function createWhatsAppCloudProvider(
  config: WhatsAppProviderConfig,
  supabase: ReturnType<typeof createClient>
): Promise<WhatsAppCloudProvider> {
  const { data, error } = await supabase
    .from('whatsapp_cloud_config')
    .select('phone_number_id, access_token')
    .eq('tenant_id', config.tenant_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No active WhatsApp Cloud configuration found. Please configure WhatsApp Cloud API settings.');
  }

  if (!data.phone_number_id || !data.access_token) {
    throw new Error('WhatsApp Cloud configuration is incomplete. Please provide phone_number_id and access_token.');
  }

  const provider = new WhatsAppCloudProvider(data.phone_number_id, data.access_token);

  if (!provider.validateConfig()) {
    throw new Error('WhatsApp Cloud credentials are invalid.');
  }

  console.log('Created WhatsApp Cloud provider');
  return provider;
}

// Re-export providers for direct use if needed
export { FonnteProvider, TwilioProvider, InfobipProvider, WhatsAppCloudProvider };
export type { IWhatsAppProvider, WhatsAppProviderType, WhatsAppProviderConfig };
