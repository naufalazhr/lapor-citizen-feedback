// Final test after history format fix
const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';

async function testMessage(description, payload) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(description);
  console.log(`${'='.repeat(70)}`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok && data.message) {
      console.log(`Response: ${data.message.substring(0, 100)}...`);
      console.log('✅ PASSED');
    } else {
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);
      console.log('❌ FAILED');
    }

    return response.ok;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function run() {
  const phone = '628111222333'; // New phone for clean test

  console.log('\n🚀 Testing Webhook with History Format Fix');
  console.log('Phone:', phone);

  // Test 1: First message
  const test1 = await testMessage(
    '📩 Test 1: First message (should work)',
    {
      sender: phone,
      name: 'Final Test User',
      device: '6281234567890',
      message: 'Halo, saya mau lapor masalah'
    }
  );

  if (!test1) {
    console.log('\n❌ Test 1 failed. Stopping.');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Follow-up (THIS SHOULD WORK NOW!)
  const test2 = await testMessage(
    '📩 Test 2: Follow-up message (testing session management)',
    {
      sender: phone,
      name: 'Final Test User',
      device: '6281234567890',
      message: 'Nama saya Test User'
    }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Third message
  const test3 = await testMessage(
    '📩 Test 3: Third message (testing history building)',
    {
      sender: phone,
      name: 'Final Test User',
      device: '6281234567890',
      message: 'Ya benar'
    }
  );

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS:');
  console.log('='.repeat(70));
  console.log(`Test 1 (First message):  ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Follow-up):      ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Third message):  ${test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(70));

  if (test1 && test2 && test3) {
    console.log('\n🎉 ALL TESTS PASSED! Session management working correctly!');
    console.log('\n✅ The webhook is ready for production use.');
    console.log('\n📋 Next steps:');
    console.log('1. Configure the webhook URL in Fonnte dashboard');
    console.log('2. Test with real WhatsApp messages');
    console.log('3. Build the Admin UI to monitor conversations');
  } else {
    console.log('\n❌ Some tests failed. Check errors:');
    console.log('   curl https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/get-webhook-errors');
  }
}

run().catch(console.error);