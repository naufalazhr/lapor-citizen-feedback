// Test script for Fonnte Webhook
// Run with: node test-webhook.js

const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';

// Test payloads
const testPayloads = {
  // Test 1: Simple text message (first message)
  simpleText: {
    sender: '628123456789',
    name: 'Test User',
    device: '6281234567890',
    message: 'Halo, saya mau lapor'
  },

  // Test 2: Message with attachment
  withAttachment: {
    sender: '628123456789',
    name: 'Test User',
    device: '6281234567890',
    message: 'Ini foto lokasinya',
    url: 'https://picsum.photos/400/300',
    filename: 'test-photo.jpg',
    extension: 'jpg'
  },

  // Test 3: Follow-up message (conversation continuation)
  followUp: {
    sender: '628123456789',
    name: 'Test User',
    device: '6281234567890',
    message: 'Sudah benar'
  },

  // Test 4: Unsupported file type
  unsupportedFile: {
    sender: '628123456789',
    name: 'Test User',
    device: '6281234567890',
    message: 'File tidak didukung',
    url: 'https://example.com/file.exe',
    filename: 'malware.exe',
    extension: 'exe'
  }
};

async function testWebhook(testName, payload) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testName}`);
  console.log(`${'='.repeat(60)}`);
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
      console.log('✅ Test PASSED');
    } else {
      console.log('❌ Test FAILED');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Fonnte Webhook Tests');
  console.log('Webhook URL:', WEBHOOK_URL);

  // Check if Flowise config exists first
  console.log('\n⚠️  IMPORTANT: Before running these tests, make sure you have:');
  console.log('1. Created a Flowise configuration in the database');
  console.log('2. Set up your Flowise API with a valid chatflow');
  console.log('3. The Flowise API is accessible from Supabase edge functions');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Run tests sequentially
  await testWebhook('Simple Text Message', testPayloads.simpleText);

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  await testWebhook('Message with Attachment', testPayloads.withAttachment);

  await new Promise(resolve => setTimeout(resolve, 2000));

  await testWebhook('Follow-up Message', testPayloads.followUp);

  await new Promise(resolve => setTimeout(resolve, 2000));

  await testWebhook('Unsupported File Type', testPayloads.unsupportedFile);

  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 All tests completed!');
  console.log(`${'='.repeat(60)}\n`);
}

// Run tests
runTests().catch(console.error);