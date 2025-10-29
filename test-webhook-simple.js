// Simple webhook test - single message
const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';

const payload = {
  sender: '628123456789',
  name: 'Test User',
  device: '6281234567890',
  message: 'Halo, saya mau lapor'
};

console.log('🚀 Testing webhook...');
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
    console.log('\n✅ Test PASSED');
  } else {
    console.log('\n❌ Test FAILED');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
}