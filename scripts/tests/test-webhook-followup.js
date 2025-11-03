// Test follow-up message to verify session management
const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';

const payload = {
  sender: '628123456789', // Same phone number as first test
  name: 'Test User',
  device: '6281234567890',
  message: 'Nama saya John Doe' // Responding with name
};

console.log('🚀 Testing follow-up message (session continuation)...');
console.log('Payload:', JSON.stringify(payload, null, 2));

try {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  console.log(`\nStatus: ${response.status} ${response.statusText}`);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('\n✅ Follow-up test PASSED');
    console.log('\n📌 Next step: Check the database via Supabase Dashboard');
    console.log('   Run the SQL queries in check-data-admin.sql to see:');
    console.log('   - Conversation with Flowise chatId (not temp_*)');
    console.log('   - Multiple messages in sequence');
    console.log('   - Message history building correctly');
  } else {
    console.log('\n❌ Follow-up test FAILED');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
}