// Test script to verify WhatsApp reply is sent via Fonnte
// This test sends a message to the webhook and checks if Fonnte send is called

const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';

async function testWhatsAppReply() {
  console.log('🚀 Testing WhatsApp Reply Flow');
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('');

  const testPayload = {
    sender: '628999111222', // Test phone number
    name: 'Reply Test User',
    device: '6281234567890',
    message: 'Halo, test apakah saya dapat balasan di WhatsApp?'
  };

  console.log('📤 Sending test message...');
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  console.log('');

  try {
    const startTime = Date.now();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`📨 Webhook Response (${duration}ms):`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook processed successfully');
      console.log('');
      console.log('📱 IMPORTANT: Check your WhatsApp device!');
      console.log(`   Phone: ${testPayload.sender}`);
      console.log('   Expected: You should receive an AI reply on WhatsApp');
      console.log('');
      console.log('⏳ Waiting 5 seconds for message delivery...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('');
      console.log('❓ Did you receive the WhatsApp reply?');
      console.log('   ✅ YES - Implementation working correctly!');
      console.log('   ❌ NO  - Check logs below for errors');
      console.log('');
    } else {
      console.log('❌ Webhook failed');
      console.log('Error:', data);
      console.log('');
    }

    // Check for errors
    console.log('🔍 Checking for send errors...');
    console.log('Run this command to check for Fonnte send errors:');
    console.log('   curl https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/get-webhook-errors');
    console.log('');

    // Check edge function logs
    console.log('📋 To view detailed logs, run:');
    console.log('   npx supabase functions logs fonnte-webhook --tail');
    console.log('');
    console.log('Look for these log entries:');
    console.log('   - "Sending message to WhatsApp via Fonnte..."');
    console.log('   - "Message sent to WhatsApp successfully" (if successful)');
    console.log('   - "Failed to send message to WhatsApp" (if failed)');
    console.log('');

    // Provide troubleshooting steps
    console.log('🔧 Troubleshooting:');
    console.log('');
    console.log('1. Verify Fonnte configuration:');
    console.log('   - Navigate to: /admin/integration');
    console.log('   - Check API Token is configured');
    console.log('   - Token should be: XJcZd5ARToBoPgAtEyQp');
    console.log('');
    console.log('2. Check database configuration:');
    console.log('   Run in Supabase SQL Editor:');
    console.log('   SELECT api_token FROM fonnte_config WHERE is_active = true;');
    console.log('');
    console.log('3. Verify Fonnte API is accessible:');
    console.log('   Test directly: https://api.fonnte.com/send');
    console.log('');
    console.log('4. Check webhook_errors table:');
    console.log('   SELECT * FROM webhook_errors');
    console.log('   WHERE source = \'fonnte-send\'');
    console.log('   ORDER BY created_at DESC LIMIT 5;');
    console.log('');

    return response.ok;

  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
    console.error(error);
    return false;
  }
}

// Additional test: Follow-up message
async function testFollowUpReply() {
  console.log('');
  console.log('='.repeat(70));
  console.log('📨 Test 2: Follow-up Message (Context Maintenance)');
  console.log('='.repeat(70));
  console.log('');

  const testPayload = {
    sender: '628999111222', // Same phone number
    name: 'Reply Test User',
    device: '6281234567890',
    message: 'Nama saya Test User'
  };

  console.log('📤 Sending follow-up message...');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Follow-up webhook processed');
      console.log('');
      console.log('📱 Check WhatsApp for contextual reply');
      console.log('   Expected: AI should reference previous conversation');
      console.log('');
    }

    return response.ok;
  } catch (error) {
    console.error('❌ Follow-up test failed:', error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 WhatsApp Reply Flow Test');
  console.log('='.repeat(70));
  console.log('');

  const test1 = await testWhatsAppReply();

  if (test1) {
    console.log('⏳ Waiting 3 seconds before follow-up test...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const test2 = await testFollowUpReply();

    console.log('');
    console.log('='.repeat(70));
    console.log('📊 Test Results:');
    console.log('='.repeat(70));
    console.log(`Test 1 (First message):  ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 2 (Follow-up):      ${test2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (test1 && test2) {
      console.log('🎉 All webhook tests passed!');
      console.log('');
      console.log('⚠️  CRITICAL: Verify WhatsApp replies were actually received!');
      console.log('    The webhook returns success, but you must check WhatsApp device');
      console.log('    to confirm messages were delivered.');
    }
  }

  console.log('');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
