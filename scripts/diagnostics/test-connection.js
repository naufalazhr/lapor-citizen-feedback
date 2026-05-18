import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2].trim();
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase Connection...\n');

  try {
    console.log('1. Basic connection test...');
    const { error: healthError } = await supabase.from('conversations').select('count').limit(1);
    
    if (healthError) {
      console.error('FAILED:', healthError.message);
      console.error('Details:', healthError.details);
      console.error('Hint:', healthError.hint);
    } else {
      console.log('Connected successfully\n');
    }

    console.log('2. Table statistics...');
    const [convRes, msgRes, userRes] = await Promise.all([
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true })
    ]);

    console.log('   Conversations:', convRes.count ?? 0);
    console.log('   Messages:', msgRes.count ?? 0);
    console.log('   Users:', userRes.count ?? 0);

    console.log('\n3. Recent data sample...');
    const { data: recentConv, error: recentError } = await supabase
      .from('conversations')
      .select('id, phone_number, status, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentError) {
      console.error('Error fetching recent data:', recentError.message);
    } else if (!recentConv || recentConv.length === 0) {
      console.log('   No conversations found (database empty)');
    } else {
      console.log('   Recent conversations:');
      recentConv.forEach(conv => {
        console.log('   - ' + conv.id + ': ' + conv.phone_number + ' (' + conv.status + ')');
      });
    }

    console.log('\nDatabase connection is healthy!');
    process.exit(0);

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

testConnection();
