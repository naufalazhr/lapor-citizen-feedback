import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=');
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key.trim()] = value;
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseWebhook() {
  console.log('🔍 Checking webhook test results...\n');

  // 1. Check recent conversations
  console.log('📋 1. Recent Conversations:');
  console.log('='.repeat(80));
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, phone_number, sender_name, session_id, status, device_number, started_at, last_message_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (convError) {
    console.error('❌ Error fetching conversations:', convError.message);
  } else {
    console.table(conversations);
  }

  // 2. Check messages
  console.log('\n💬 2. Recent Messages:');
  console.log('='.repeat(80));
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select(`
      conversation_id,
      role,
      message_index,
      content,
      created_at,
      conversations!inner(phone_number, session_id)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (msgError) {
    console.error('❌ Error fetching messages:', msgError.message);
  } else {
    const formatted = messages?.map(m => ({
      phone: m.conversations.phone_number,
      session_id: m.conversations.session_id?.substring(0, 20) + '...',
      role: m.role,
      index: m.message_index,
      content: m.content?.substring(0, 50) + '...',
      created_at: new Date(m.created_at).toLocaleString()
    }));
    console.table(formatted);
  }

  // 3. Check webhook errors
  console.log('\n❌ 3. Webhook Errors:');
  console.log('='.repeat(80));
  const { data: errors, error: errError } = await supabase
    .from('webhook_errors')
    .select('source, error_type, error_message, error_stack, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (errError) {
    console.error('❌ Error fetching webhook_errors:', errError.message);
  } else if (errors && errors.length > 0) {
    errors.forEach((err, idx) => {
      console.log(`\nError #${idx + 1}:`);
      console.log(`  Source: ${err.source}`);
      console.log(`  Type: ${err.error_type}`);
      console.log(`  Message: ${err.error_message}`);
      console.log(`  Stack: ${err.error_stack?.substring(0, 200)}`);
      console.log(`  Time: ${new Date(err.created_at).toLocaleString()}`);
    });
  } else {
    console.log('✅ No webhook errors found');
  }

  // 4. Check chatId extraction status
  console.log('\n🔑 4. Session ID Status:');
  console.log('='.repeat(80));
  const sessionStatus = conversations?.map(c => ({
    phone: c.phone_number,
    session_id: c.session_id,
    status: c.session_id?.startsWith('temp_')
      ? '❌ Temporary (chatId NOT extracted)'
      : c.session_id?.length > 30
        ? '✅ Real chatId from Flowise'
        : '⚠️  Unknown format',
    started_at: new Date(c.started_at).toLocaleString()
  }));
  console.table(sessionStatus);

  // 5. Message counts per conversation
  console.log('\n📊 5. Message Counts per Conversation:');
  console.log('='.repeat(80));
  const { data: counts, error: countError } = await supabase
    .from('conversations')
    .select('id, phone_number, session_id, status');

  if (countError) {
    console.error('❌ Error fetching conversation counts:', countError.message);
  } else {
    const countsWithMessages = await Promise.all(
      (counts || []).map(async (conv) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        return {
          phone: conv.phone_number,
          session_id: conv.session_id?.substring(0, 30),
          status: conv.status,
          message_count: count || 0
        };
      })
    );
    console.table(countsWithMessages);
  }

  console.log('\n✅ Diagnostic check complete!');
}

diagnoseWebhook().catch(console.error);