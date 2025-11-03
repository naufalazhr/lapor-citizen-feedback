// =============================================================================
// Conversation Manager
// Handles conversation session management, message storage, and history retrieval
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Conversation, Message, FonnteConfig } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// -----------------------------------------------------------------------------
// Get Active Fonnte Configuration
// -----------------------------------------------------------------------------
export async function getFonnteConfig(): Promise<FonnteConfig> {
  const { data, error } = await supabase
    .from('fonnte_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error('No active Fonnte configuration found');
  }

  return data as FonnteConfig;
}

// -----------------------------------------------------------------------------
// Find or Create Conversation
// -----------------------------------------------------------------------------
export async function findOrCreateConversation(
  phoneNumber: string,
  deviceNumber: string,
  senderName?: string
): Promise<Conversation> {
  const config = await getFonnteConfig();
  const timeoutMinutes = config.session_timeout_minutes;

  // Calculate cutoff time for active sessions
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60000).toISOString();

  // Find active session within timeout window
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('phone_number', phoneNumber)
    .eq('status', 'active')
    .gte('last_message_at', cutoffTime)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single();

  if (existing && !findError) {
    // Update last message time
    const { data: updated, error: updateError } = await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update conversation: ${updateError.message}`);
    }

    return updated as Conversation;
  }

  // CONDITION 1: No active conversation found within timeout
  // Before creating new session, mark any old active conversations as ABANDONED
  // This handles conversations that timed out without creating a report
  try {
    const { data: oldConversations, error: oldError } = await supabase
      .from('conversations')
      .select('id, report_id')
      .eq('phone_number', phoneNumber)
      .eq('status', 'active')
      .lt('last_message_at', cutoffTime); // Older than timeout

    if (oldConversations && oldConversations.length > 0 && !oldError) {
      for (const oldConv of oldConversations) {
        // If it has a report, it should be completed (defensive check)
        // Otherwise, it's abandoned
        const newStatus = oldConv.report_id ? 'completed' : 'abandoned';

        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            status: newStatus,
            completed_at: new Date().toISOString()
          })
          .eq('id', oldConv.id);

        if (updateError) {
          console.error(`Failed to mark conversation as ${newStatus}:`, updateError);
        } else {
          console.log(`✓ Marked old conversation as '${newStatus}':`, oldConv.id);
        }
      }
    }
  } catch (cleanupError) {
    // Don't fail the webhook if cleanup fails
    console.error('Error during conversation cleanup:', cleanupError);
  }

  // Create new session
  // Initial session_id is temporary - will be replaced with Flowise's sessionId after first API call
  const temporarySessionId = `temp_${phoneNumber}_${Date.now()}`;

  const { data: newConversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      session_id: temporarySessionId,
      phone_number: phoneNumber,
      sender_name: senderName,
      device_number: deviceNumber,
      status: 'active',
      channel: 'whatsapp',
      last_message_at: new Date().toISOString(),
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createError || !newConversation) {
    throw new Error(`Failed to create conversation: ${createError?.message}`);
  }

  return newConversation as Conversation;
}

// -----------------------------------------------------------------------------
// Update Conversation Flowise Session ID
// CRITICAL: Must be called after first Flowise API response
// -----------------------------------------------------------------------------
export async function updateConversationSessionId(
  conversationId: string,
  flowiseSessionId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ session_id: flowiseSessionId })
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to update session ID: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// Get Next Message Index
// -----------------------------------------------------------------------------
export async function getNextMessageIndex(conversationId: string): Promise<number> {
  const { data, error } = await supabase
    .from('messages')
    .select('message_index')
    .eq('conversation_id', conversationId)
    .order('message_index', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to get message index: ${error.message}`);
  }

  return data ? data.message_index + 1 : 0;
}

// -----------------------------------------------------------------------------
// Save Message
// -----------------------------------------------------------------------------
export async function saveMessage(params: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_index: number;
  has_attachment?: boolean;
  attachment_url?: string;
  attachment_type?: string;
  attachment_filename?: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversation_id,
      role: params.role,
      content: params.content,
      message_index: params.message_index,
      has_attachment: params.has_attachment || false,
      attachment_url: params.attachment_url,
      attachment_type: params.attachment_type,
      attachment_filename: params.attachment_filename
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save message: ${error?.message}`);
  }

  return data as Message;
}

// -----------------------------------------------------------------------------
// Get Conversation History
// Returns messages ordered by index for Flowise history parameter
// Maps roles to Flowise format: user -> userMessage, assistant -> apiMessage
// -----------------------------------------------------------------------------
export async function getConversationHistory(
  conversationId: string
): Promise<Array<{ role: 'userMessage' | 'apiMessage'; content: string }>> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, message_index')
    .eq('conversation_id', conversationId)
    .order('message_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to get conversation history: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Map roles to Flowise format
  return data
    .filter(msg => msg.role !== 'system') // Exclude system messages from history
    .map(msg => ({
      role: (msg.role === 'user' ? 'userMessage' : 'apiMessage') as 'userMessage' | 'apiMessage',
      content: msg.content
    }));
}

// -----------------------------------------------------------------------------
// Mark Conversation as Completed
// Called when report is successfully created
// -----------------------------------------------------------------------------
export async function markConversationCompleted(
  conversationId: string,
  reportId?: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      report_id: reportId
    })
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to mark conversation as completed: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// Mark Conversation as Abandoned
// Called when timeout is reached or error occurs
// -----------------------------------------------------------------------------
export async function markConversationAbandoned(
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString()
    })
    .eq('id', conversationId);

  if (error) {
    console.error(`Failed to mark conversation as abandoned: ${error.message}`);
    // Don't throw - this is not critical
  }
}

// -----------------------------------------------------------------------------
// Log Webhook Error
// Stores error details for debugging
// -----------------------------------------------------------------------------
export async function logWebhookError(params: {
  source: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  payload?: any;
  conversation_id?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('webhook_errors')
    .insert({
      source: params.source,
      error_type: params.error_type,
      error_message: params.error_message,
      error_stack: params.error_stack,
      payload: params.payload,
      conversation_id: params.conversation_id
    });

  if (error) {
    console.error(`Failed to log webhook error: ${error.message}`);
    // Don't throw - logging failure shouldn't break the flow
  }
}