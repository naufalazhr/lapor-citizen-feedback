# Flowise Image Processing Debug Guide

## ✅ Issues Fixed

### **Fix #1: Database Error - message_index 14.5** 🔴
**Problem:**
```
Error: "invalid input syntax for type integer: "14.5"
```

**Root Cause:**
- Line 153 in index.ts tried to save `message_index: messageIndex + 0.5`
- The `message_index` field in database is `INTEGER` type (not DECIMAL)
- Can't store 14.5 in an integer field

**Solution:** ✅ **REMOVED** the problematic system message entirely
```typescript
// OLD CODE (CAUSED ERROR):
await saveMessage({
  role: 'system',
  content: `Attachment processed: ${attachmentResult.filename}`,
  message_index: messageIndex + 0.5,  // ← 14.5 breaks database!
});

// NEW CODE (FIXED):
// Just log the success, don't create system message
console.log('✓ Attachment processed successfully');
```

**Result:** ✅ No more integer field errors

---

### **Fix #2: Enhanced Flowise Diagnostics** 🔍
**Added detailed logging to see EXACTLY what's sent to Flowise:**

**New Logs You'll See:**

```javascript
// 1. What's being sent TO Flowise
📎 Flowise Upload Details: {
  uploadCount: 1,
  uploads: [{
    type: "file",
    name: "webhook-089654126493-1761811231662968657.jpeg",
    mime: "image/jpeg",
    dataFormat: "data:image/jpeg;base64,/9j...",  // ← First 30 chars
    dataLength: 312756,                           // ← Total base64 string length
    isBase64DataUri: true,                        // ← Must be true
    hasBase64Marker: true                         // ← Must be true
  }]
}

// 2. What Flowise RETURNS
📥 Flowise API Response: {
  hasText: true,
  hasResponse: true,
  hasChatId: true,
  textPreview: "Based on the image you sent...",  // ← First 200 chars of response
  allFields: ["text", "chatId", "sessionId", ...]
}
```

**Result:** ✅ Now you can see if image is formatted correctly and what Flowise actually receives

---

## 🧪 Testing Instructions

### **1. Send WhatsApp Image Again**

```bash
# Watch logs in real-time
npx supabase functions logs fonnte-webhook --tail
```

### **2. Look for These Log Sections**

#### ✅ **Section A: Attachment Processing**
```
✓ Attachment processed successfully: {
  attachmentId: "uuid-here",
  storageUrl: "https://xxx.supabase.co/storage/...",
  hasBase64: true,
  base64Length: 312756,
  base64Preview: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."  // ← First 100 chars
}
```

**What to check:**
- ✅ `hasBase64: true` - Base64 was generated
- ✅ `base64Length > 1000` - Image data exists (not empty)
- ✅ `base64Preview` starts with `"data:image/jpeg;base64,"` - Correct format

**If you see issues here:** Image conversion to base64 failed, storage upload might have issue

---

#### ✅ **Section B: Flowise Request**
```
Calling Flowise API: {
  url: "https://your-flowise.com/api/v1/prediction/xxx",
  hasSessionId: true,
  hasHistory: false,
  hasUploads: true,
  question: "[Gambar]"  // ← For image-only messages
}

📎 Flowise Upload Details: {
  uploadCount: 1,
  uploads: [{
    type: "file",
    name: "webhook-089654126493-1761811231662968657.jpeg",
    mime: "image/jpeg",
    dataFormat: "data:image/jpeg;base64,/9j...",
    dataLength: 312756,
    isBase64DataUri: true,  // ← MUST BE TRUE
    hasBase64Marker: true   // ← MUST BE TRUE
  }]
}
```

**What to check:**
- ✅ `hasUploads: true` - Image is included in request
- ✅ `isBase64DataUri: true` - Data URI format is correct
- ✅ `hasBase64Marker: true` - Contains "base64," marker
- ✅ `dataFormat` starts with `"data:image/jpeg;base64,"` - Correct format

**If both are true BUT Flowise still doesn't work:** Problem is in Flowise chatflow configuration (see below)

---

#### ✅ **Section C: Flowise Response**
```
📥 Flowise API Response: {
  hasText: true,
  hasResponse: true,
  hasChatId: true,
  textPreview: "Based on the image you sent, I can see...",
  allFields: ["text", "chatId", "sessionId", "chatMessageId"]
}
```

**What to check:**
- ✅ `textPreview` - Does response mention the image content?
- ❌ If `textPreview: "Photo"` - Flowise is NOT processing the image, just sees metadata

**This tells you if Flowise is ACTUALLY using the image**

---

## 🔍 Diagnosing "Flowise Only Sees 'Photo'" Issue

### **Scenario: Logs show correct format BUT Flowise response is just "Photo"**

This means:
1. ✅ Image is being sent correctly (base64 format is valid)
2. ✅ Flowise receives the image
3. ❌ **Flowise chatflow is NOT configured to process images**

### **Flowise Configuration Checklist:**

#### **1. Check Flowise Chatflow Has Image Input**

Your Flowise chatflow MUST have one of these nodes:
- **Image/File Upload Input Node** - Accepts file uploads
- **Multimodal Chat Model** - Models like GPT-4 Vision, Claude with vision, Gemini Pro Vision
- **Document Loader with Image Support** - For image analysis

**How to verify:**
1. Open your Flowise dashboard
2. Go to your chatflow
3. Look for nodes that accept images

**If missing:** Your chatflow needs to be rebuilt to handle images

---

#### **2. Verify Chat Model Supports Vision**

Not all AI models can process images. You need:

**✅ Supported Models:**
- GPT-4 Vision / GPT-4o (OpenAI)
- Claude 3 (Sonnet/Opus) with vision (Anthropic)
- Gemini Pro Vision (Google)
- LLaVA (local models)

**❌ NOT Supported:**
- GPT-3.5-Turbo
- Claude Instant
- Text-only models

**How to check:**
1. Open your Flowise chatflow
2. Find the "Chat Model" node
3. Check the model name

**If using text-only model:** You need to upgrade to a vision-capable model

---

#### **3. Check Flowise Logs**

Flowise itself has logs that show if it's processing images:

```bash
# In your Flowise server
# Look for logs when message arrives
```

**What to look for:**
- "Processing upload: image/jpeg" - Good! Flowise sees the image
- "Received text: Photo" - Bad! Flowise only sees metadata
- Error messages about unsupported file types

---

## 🎯 Expected vs Actual Behavior

### **Scenario 1: Everything Working** ✅

**Logs:**
```
✓ Attachment processed successfully
📎 Flowise Upload Details: { isBase64DataUri: true, hasBase64Marker: true }
📥 Flowise API Response: { textPreview: "Based on the image, I can see a report about..." }
```

**Dashboard:** Image displays with AI response analyzing the image content

**Flowise Dashboard:** Shows conversation with image visible

---

### **Scenario 2: Image Sent But Flowise Can't Process** ⚠️

**Logs:**
```
✓ Attachment processed successfully  // ← Backend working
📎 Flowise Upload Details: { isBase64DataUri: true }  // ← Format correct
📥 Flowise API Response: { textPreview: "Photo" }  // ← Flowise not processing!
```

**Cause:** Flowise chatflow or model doesn't support images

**Solution:** Update Flowise chatflow to use vision-capable model

---

### **Scenario 3: Base64 Format Wrong** 🔴

**Logs:**
```
✓ Attachment processed successfully
📎 Flowise Upload Details: {
  isBase64DataUri: false,  // ← WRONG!
  hasBase64Marker: false   // ← WRONG!
}
```

**Cause:** Base64 conversion failed

**Solution:** Check attachment-processor.ts for conversion issues

---

## 🔧 Flowise Configuration Guide

### **Option 1: Update Existing Chatflow**

1. **Open Flowise Dashboard**
2. **Edit Your Chatflow**
3. **Add/Update Chat Model Node:**
   - Click on Chat Model node
   - Change model to: "gpt-4-vision-preview" or "claude-3-sonnet" or "gemini-pro-vision"
   - Enable vision/multimodal capabilities

4. **Add File Upload Handler (if missing):**
   - Search for "File Upload" node
   - Connect it to your chat model
   - Configure file types: `["image/jpeg", "image/png", "image/webp"]`

5. **Test in Flowise:**
   - Use Flowise's test interface
   - Upload an image manually
   - Verify the model can analyze it

---

### **Option 2: Create New Image-Capable Chatflow**

**Recommended Setup:**
```
[Chat Input] → [GPT-4 Vision] → [Chat Output]
      ↓
[File Upload Input]
```

**Steps:**
1. Create new chatflow in Flowise
2. Add GPT-4 Vision node (or Claude 3 with vision)
3. Add File Upload Input node
4. Connect nodes
5. Test with sample image
6. Update your Flowise config in database to use new chatflow ID

---

## 📊 Quick Diagnosis Decision Tree

```
Image sent from WhatsApp
  ↓
Check: base64Preview in logs
  ├─ Starts with "data:image/jpeg;base64," → ✅ Format correct
  │   ↓
  │   Check: Flowise response textPreview
  │   ├─ Mentions image content → ✅ Working!
  │   └─ Just says "Photo" → ❌ Flowise configuration issue
  │       → Fix Flowise chatflow (use vision model)
  │
  └─ Does NOT start correctly → ❌ Base64 conversion failed
      → Check attachment-processor logs
      → Verify download from Fonnte succeeded
```

---

## 🆘 Common Issues & Solutions

### **Issue: "Photo" Response from Flowise**

**Diagnosis:**
- Logs show: `isBase64DataUri: true` ✅
- Response: `textPreview: "Photo"` ❌

**Cause:** Flowise chatflow uses text-only model

**Solution:**
1. Check current model in Flowise chatflow
2. If GPT-3.5-Turbo or text-only → Upgrade to GPT-4 Vision
3. Test in Flowise dashboard directly
4. Re-test WhatsApp integration

---

### **Issue: Image Displays But Not Analyzed**

**Diagnosis:**
- Image shows in dashboard ✅
- Flowise responds but doesn't mention image content ❌

**Cause:** Model sees image but prompt doesn't ask about it

**Solution:**
Add system prompt in Flowise:
```
"When a user sends an image, analyze it and describe what you see.
For reports, extract key information from the image."
```

---

### **Issue: Large Images Timeout**

**Diagnosis:**
- Logs show: `base64Length: 5000000+` (5MB+)
- Timeout error

**Cause:** Image too large, base64 too long

**Solution:**
1. Check image size before conversion
2. Resize large images before base64 conversion
3. Increase Flowise timeout in config

---

## ✅ Action Items

1. **Deploy the fix (DONE)** ✅
   ```bash
   # Already deployed with fixes
   ```

2. **Send test image** ⏳
   ```bash
   # Watch logs
   npx supabase functions logs fonnte-webhook --tail
   ```

3. **Check Section A, B, C in logs** ⏳
   - Verify base64 format is correct
   - Verify Flowise receives it
   - Check Flowise response

4. **If Flowise returns "Photo"** ⏳
   - Open Flowise dashboard
   - Check chatflow model
   - Upgrade to vision-capable model
   - Test manually in Flowise first

5. **Share logs with me** ⏳
   - Copy the three log sections (A, B, C)
   - I'll help diagnose Flowise configuration

---

## 📝 Files Modified

1. [index.ts](supabase/functions/fonnte-webhook/index.ts#L150-L158) - Removed problematic system message
2. [flowise-client.ts](supabase/functions/fonnte-webhook/flowise-client.ts#L131-L145) - Added upload diagnostics
3. [flowise-client.ts](supabase/functions/fonnte-webhook/flowise-client.ts#L170-L178) - Added response diagnostics

---

**Status:** ✅ Fixes deployed
**Next:** Test with WhatsApp image and check the 3 log sections (A, B, C)
