// Test script for Fonnte Webhook - Attachment Processing
// Tests various file types and error scenarios

const WEBHOOK_URL = 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook';
const TEST_PHONE = '628555444333'; // Unique phone for attachment tests

const testPayloads = {
  // Test 1: PNG Image Upload
  imagePNG: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Test upload gambar PNG',
    url: 'https://picsum.photos/800/600.png',
    filename: 'test-image.png',
    extension: 'png'
  },

  // Test 2: JPEG Image Upload
  imageJPEG: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Test upload foto JPEG',
    url: 'https://picsum.photos/1024/768.jpg',
    filename: 'photo.jpg',
    extension: 'jpg'
  },

  // Test 3: WEBP Image Upload
  imageWEBP: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Test upload gambar WEBP',
    url: 'https://picsum.photos/640/480.webp',
    filename: 'modern-image.webp',
    extension: 'webp'
  },

  // Test 4: PDF Document Upload
  documentPDF: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Test upload dokumen PDF',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    filename: 'document.pdf',
    extension: 'pdf'
  },

  // Test 5: Unsupported File Type (Should Fail Gracefully)
  unsupportedEXE: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Test file tidak didukung (.exe)',
    url: 'https://example.com/file.exe',
    filename: 'malware.exe',
    extension: 'exe'
  },

  // Test 6: Invalid URL (Should Fail Gracefully)
  invalidURL: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Test URL tidak valid',
    url: 'https://invalid-domain-that-does-not-exist-12345.com/file.jpg',
    filename: 'broken.jpg',
    extension: 'jpg'
  },

  // Test 7: Follow-up text message (no attachment, context maintained)
  followUpText: {
    sender: TEST_PHONE,
    name: 'Attachment Test User',
    device: '6281234567890',
    message: 'Terima kasih, sudah diterima'
  }
};

async function testWebhook(testName, payload) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(80)}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const startTime = Date.now();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`\nStatus: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);

    if (response.ok) {
      console.log(`\n✅ Test PASSED`);
      console.log('Response Message:');
      console.log(data.message ? data.message.substring(0, 150) + '...' : JSON.stringify(data, null, 2));

      // Show attachment status if present
      if (payload.url) {
        console.log('\n📎 Attachment Info:');
        console.log(`  URL: ${payload.url}`);
        console.log(`  Type: ${payload.extension}`);
        console.log(`  Expected: ${['png', 'jpg', 'jpeg', 'webp', 'mp4', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'mp3'].includes(payload.extension) ? 'Supported ✅' : 'Unsupported ❌'}`);
      }
    } else {
      console.log(`\n❌ Test FAILED`);
      console.log('Error Response:', JSON.stringify(data, null, 2));
    }

    return {
      testName,
      success: response.ok,
      status: response.status,
      duration,
      hasAttachment: !!payload.url,
      extension: payload.extension,
      response: data
    };
  } catch (error) {
    console.error(`\n❌ EXCEPTION: ${error.message}`);
    return {
      testName,
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🚀 Starting Fonnte Webhook Attachment Tests');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Test Phone: ${TEST_PHONE}`);
  console.log(`Total Tests: ${Object.keys(testPayloads).length}`);

  const results = [];

  // Test 1: PNG Image
  console.log('\n\n📋 Phase 1: Image File Tests');
  await new Promise(resolve => setTimeout(resolve, 1000));
  results.push(await testWebhook('1. PNG Image Upload', testPayloads.imagePNG));
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: JPEG Image
  results.push(await testWebhook('2. JPEG Image Upload', testPayloads.imageJPEG));
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: WEBP Image
  results.push(await testWebhook('3. WEBP Image Upload', testPayloads.imageWEBP));
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 4: PDF Document
  console.log('\n\n📋 Phase 2: Document File Tests');
  results.push(await testWebhook('4. PDF Document Upload', testPayloads.documentPDF));
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 5: Unsupported File Type
  console.log('\n\n📋 Phase 3: Error Handling Tests');
  results.push(await testWebhook('5. Unsupported File Type (.exe)', testPayloads.unsupportedEXE));
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 6: Invalid URL
  results.push(await testWebhook('6. Invalid/Unreachable URL', testPayloads.invalidURL));
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 7: Follow-up text (no attachment)
  console.log('\n\n📋 Phase 4: Context Maintenance Test');
  results.push(await testWebhook('7. Follow-up Text Message (No Attachment)', testPayloads.followUpText));

  // Print Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  console.log('\n📝 Detailed Results:');
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    const attachment = result.hasAttachment ? ` [${result.extension}]` : '';
    console.log(`  ${icon} ${result.testName}${attachment}${duration}`);
  });

  // Expected Results Analysis
  console.log('\n\n📋 Expected Behavior Analysis:');
  console.log('='.repeat(80));

  const expectedToPass = ['1. PNG Image Upload', '2. JPEG Image Upload', '3. WEBP Image Upload', '4. PDF Document Upload', '7. Follow-up Text Message (No Attachment)'];
  const expectedToFailOrDegrade = ['5. Unsupported File Type (.exe)', '6. Invalid/Unreachable URL'];

  console.log('\n✅ Expected to PASS (supported file types):');
  expectedToPass.forEach(testName => {
    const result = results.find(r => r.testName === testName);
    if (result) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${testName}`);
    }
  });

  console.log('\n⚠️  Expected to FAIL or DEGRADE GRACEFULLY:');
  expectedToFailOrDegrade.forEach(testName => {
    const result = results.find(r => r.testName === testName);
    if (result) {
      // These should either fail or return success with error message
      const status = result.success ? '⚠️  PASSED (check if error was communicated)' : '✅ FAILED AS EXPECTED';
      console.log(`  ${status} - ${testName}`);
    }
  });

  // Verification Steps
  console.log('\n\n✅ Next Steps for Verification:');
  console.log('='.repeat(80));
  console.log('\n1. Check Supabase Dashboard:');
  console.log('   - Navigate to: Conversations page in admin UI');
  console.log(`   - Search for phone: ${TEST_PHONE}`);
  console.log('   - Verify all messages are recorded');
  console.log('   - Check message history shows attachments');

  console.log('\n2. Check Supabase Storage:');
  console.log('   - Navigate to: Storage > conversation-attachments bucket');
  console.log('   - Verify uploaded files are present');
  console.log('   - Check file sizes and formats');

  console.log('\n3. Check Attachments Table:');
  console.log('   Run this SQL query in Supabase Dashboard:');
  console.log('   ```sql');
  console.log('   SELECT a.filename, a.extension, a.file_size,');
  console.log('          a.download_status, a.upload_status, a.error_message');
  console.log('   FROM public.attachments a');
  console.log('   JOIN public.messages m ON m.id = a.message_id');
  console.log('   JOIN public.conversations c ON c.id = m.conversation_id');
  console.log(`   WHERE c.phone_number = '${TEST_PHONE}'`);
  console.log('   ORDER BY a.created_at DESC;');
  console.log('   ```');

  console.log('\n4. Check for Errors:');
  console.log('   ```bash');
  console.log('   curl https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/get-webhook-errors');
  console.log('   ```');

  console.log('\n5. Review Flowise Responses:');
  console.log('   - Check if Flowise received and processed the attachments');
  console.log('   - Verify AI responses reference the uploaded files');

  console.log('\n\n' + '='.repeat(80));
  console.log('🎉 Attachment Testing Complete!');
  console.log('='.repeat(80));
}

// Run tests
runTests().catch(console.error);
