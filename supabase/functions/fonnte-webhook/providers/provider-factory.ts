// =============================================================================
// WhatsApp Provider Factory
// Creates the appropriate provider based on database configuration
// Falls back to Fonnte for backward compatibility
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { IWhatsAppProvider, WhatsAppProviderType, WhatsAppProviderConfig } from './types.ts';
import { FonnteProvider } from './fonnte-provider.ts';
import { TwilioProvider } from './twilio-provider.ts';

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
export async function createWhatsAppProvider(tenantId?: string | null): Promise<IWhatsAppProvider> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Try to get provider configuration scoped to tenant
  let providerQuery = supabase
    .from('whatsapp_provider_config')
    .select('*')
    .eq('is_active', true);

  if (tenantId) {
    providerQuery = providerQuery.eq('tenant_id', tenantId);
  }

  const { data: providerConfig, error } = await providerQuery.limit(1).maybeSingle();

  // If no config found or error, fall back to Fonnte
  if (error || !providerConfig) {
    debugLog('No WhatsApp provider config found, falling back to Fonnte');
    return await createFonnteProvider(supabase, tenantId);
  }

  const config = providerConfig as WhatsAppProviderConfig;
  debugLog('WhatsApp provider config:', { provider: config.provider });

  // Create appropriate provider
  switch (config.provider) {
    case 'twilio':
      return await createTwilioProvider(config);
    case 'fonnte':
    default:
      return await createFonnteProvider(supabase, tenantId);
  }
}

/**
 * Create Fonnte provider with credentials from database
 */
async function createFonnteProvider(supabase: ReturnType<typeof createClient>, tenantId?: string | null): Promise<FonnteProvider> {
  let query = supabase
    .from('fonnte_config')
    .select('api_token')
    .eq('is_active', true);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

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

// Re-export providers for direct use if needed
export { FonnteProvider, TwilioProvider };
export type { IWhatsAppProvider, WhatsAppProviderType, WhatsAppProviderConfig };
