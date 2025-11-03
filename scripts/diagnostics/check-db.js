import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykaawgnggvwleiyzvilf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrYWF3Z25nZ3Z3bGVpeXp2aWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAwOTQ5OTEsImV4cCI6MjA0NTY3MDk5MX0.L1Eq5FCRpMsE6zzwA_pR4vjPexnV3B3Rt0Yw9VyHBuA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('📊 Checking Database Records...\n');

  // Check conversations
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (convError) {
    console.error('Error fetching conversations:', convError);
  } else {
    console.log(`✅ Found ${conversations.length} conversations:\n`);
    conversations.forEach(conv => {
      console.log(`  ID: ${conv.id}`);
      console.log(`  Phone: ${conv.phone_number}`);
      console.log(`  Session ID: ${conv.session_id}`);
      console.log(`  Status: ${conv.status}`);
      console.log(`  Created: ${new Date(conv.created_at).toLocaleString()}\n`);
    });
  }

  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*, conversations(phone_number)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (msgError) {
    console.error('Error fetching messages:', msgError);
  } else {
    console.log(`\n✅ Found ${messages.length} recent messages:\n`);
    messages.forEach(msg => {
      console.log(`  Role: ${msg.role}`);
      console.log(`  Content: ${msg.content.substring(0, 80)}...`);
      console.log(`  Created: ${new Date(msg.created_at).toLocaleString()}\n`);
    });
  }

  // Check errors
  const { data: errors, error: errError } = await supabase
    .from('webhook_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (errError) {
    console.error('Error fetching webhook errors:', errError);
  } else if (errors && errors.length > 0) {
    console.log(`\n⚠️  Found ${errors.length} recent errors:\n`);
    errors.forEach(err => {
      console.log(`  Source: ${err.source}`);
      console.log(`  Type: ${err.error_type}`);
      console.log(`  Message: ${err.error_message}`);
      console.log(`  Created: ${new Date(err.created_at).toLocaleString()}\n`);
    });
  } else {
    console.log('\n✅ No webhook errors found!\n');
  }
}

checkDatabase().catch(console.error);