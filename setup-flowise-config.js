// Setup Flowise Configuration
// Run with: node setup-flowise-config.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykaawgnggvwleiyzvilf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrYWF3Z25nZ3Z3bGVpeXp2aWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAwOTQ5OTEsImV4cCI6MjA0NTY3MDk5MX0.L1Eq5FCRpMsE6zzwA_pR4vjPexnV3B3Rt0Yw9VyHBuA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupFlowiseConfig() {
  console.log('🔧 Setting up Flowise configuration...\n');

  const config = {
    config_name: 'default',
    is_active: true,
    api_url: 'https://tanya-suhu.up.railway.app',
    api_key: '60JyzljIO4QbqNlwODZUYcXYKV8V-qOpCF59h3XPYBk',
    chatflow_id: '487749ef-c4cd-4e17-b7a2-ec6376e482ea',
    streaming: false,
    timeout_seconds: 30,
    session_variables: {}
  };

  // Check if config already exists
  const { data: existing, error: checkError } = await supabase
    .from('flowise_config')
    .select('*')
    .eq('config_name', 'default')
    .single();

  if (existing) {
    console.log('⚠️  Configuration already exists. Updating...\n');

    const { data, error } = await supabase
      .from('flowise_config')
      .update(config)
      .eq('config_name', 'default')
      .select();

    if (error) {
      console.error('❌ Error updating configuration:', error);
      process.exit(1);
    }

    console.log('✅ Configuration updated successfully!\n');
  } else {
    console.log('📝 Creating new configuration...\n');

    const { data, error } = await supabase
      .from('flowise_config')
      .insert(config)
      .select();

    if (error) {
      console.error('❌ Error creating configuration:', error);
      process.exit(1);
    }

    console.log('✅ Configuration created successfully!\n');
  }

  // Verify configuration
  const { data: verified, error: verifyError } = await supabase
    .from('flowise_config')
    .select('*')
    .eq('config_name', 'default')
    .single();

  if (verifyError) {
    console.error('❌ Error verifying configuration:', verifyError);
    process.exit(1);
  }

  console.log('📋 Current Configuration:');
  console.log('  ID:', verified.id);
  console.log('  Name:', verified.config_name);
  console.log('  Active:', verified.is_active ? '✅' : '❌');
  console.log('  API URL:', verified.api_url);
  console.log('  API Key:', verified.api_key.substring(0, 20) + '...');
  console.log('  Chatflow ID:', verified.chatflow_id);
  console.log('  Streaming:', verified.streaming);
  console.log('  Timeout:', verified.timeout_seconds + 's');
  console.log('  Created:', new Date(verified.created_at).toLocaleString());
  console.log('\n✅ Setup complete! Ready to test webhook.\n');
}

setupFlowiseConfig().catch(console.error);