// Test with new phone number to debug errors
const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';

async function testMessage(description, payload) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(description);
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
      console.log('\n✅ Test PASSED');
    } else {
      console.log('\n❌ Test FAILED');
    }

    return response.ok;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function run() {
  // Test 1: First message with NEW phone number
  const newPhone = '628987654321';
  const test1 = await testMessage(
    'Test 1: First message (new phone)',
    {
      sender: newPhone,
      name: 'Debug User',
      device: '6281234567890',
      message: 'Hello, test pesan pertama'
    }
  );

  if (!test1) {
    console.log('\n❌ First test failed, stopping...');
    return;
  }

  // Wait 3 seconds
  console.log('\n⏳ Waiting 3 seconds before follow-up...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Follow-up message
  const test2 = await testMessage(
    'Test 2: Follow-up message (same phone)',
    {
      sender: newPhone,
      name: 'Debug User',
      device: '6281234567890',
      message: 'Pesan kedua untuk test'
    }
  );

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log(`Test 1 (First message): ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Follow-up): ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  if (test2) {
    console.log('\n✅ Session management working correctly!');
  } else {
    console.log('\n❌ Session management failed.');
    console.log('\n📋 Next steps:');
    console.log('1. Check actual error by calling:');
    console.log('   curl https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/get-webhook-errors');
    console.log('2. Look for the detailed Flowise API error message');
  }
}

run().catch(console.error);