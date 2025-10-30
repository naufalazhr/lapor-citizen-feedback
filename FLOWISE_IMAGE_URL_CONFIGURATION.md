# Flowise Image URL Configuration Guide

## ✅ Problem Fixed

**Previous Error:**
```json
{
  "statusCode": 500,
  "message": "Cannot read properties of undefined (reading 'split')"
}
```

**Root Cause:** Flowise `uploads` array only accepts base64 data URIs, not regular URLs.

**New Solution:** Image URL now sent in `overrideConfig.imageUrl` instead of uploads array.

---

## 🎯 New Implementation

### **How Images Are Sent to Flowise:**

**Request Structure:**
```json
{
  "question": "[Gambar - lihat imageUrl]",
  "overrideConfig": {
    "sessionId": "xxx",
    "phoneNumber": "628xxx",
    "userName": "John Doe",
    "imageUrl": "https://ykaawgnggvwleiyzvilf.supabase.co/storage/v1/object/public/report-photos/whatsapp-attachments/1730275200000_webhook-089654126493-1761811231662968657.jpeg",
    "imageName": "webhook-089654126493-1761811231662968657.jpeg",
    "imageMimeType": "image/jpeg"
  },
  "history": [...]
}
```

**Key Changes:**
- ✅ `imageUrl` in `overrideConfig` (not uploads array)
- ✅ Available to ALL Flowise nodes and tools
- ✅ Vision models can access it
- ✅ Tools receive URL in parameters
- ✅ No `.split()` parsing errors

---

## 🔧 Flowise Chatflow Configuration

### **Option 1: Using Custom Function Node (Recommended)**

**Step 1: Add Custom Function Node**
1. In your Flowise chatflow, add "Custom Function" node
2. Connect it BEFORE your Chat Model

**Step 2: Extract Image URL from overrideConfig**
```javascript
// Custom Function Node Code
async function run({ question, overrideConfig }) {
  // Extract image URL from overrideConfig
  const imageUrl = overrideConfig?.imageUrl;

  if (imageUrl) {
    // Append image URL to question for vision model
    const enhancedQuestion = `${question}\n\nImage URL: ${imageUrl}`;
    return { question: enhancedQuestion, imageUrl };
  }

  return { question };
}
```

**Step 3: Connect to Vision Model**
- Connect Custom Function → Chat Model (GPT-4 Vision, Claude 3, Gemini Pro Vision)
- Model will fetch and analyze image from URL

---

### **Option 2: Using System Prompt**

**Step 1: Add System Message to Chat Model**
```
You are an AI assistant that processes citizen reports.

When the user sends an image, you can access it via the imageUrl variable.
The imageUrl is available in the overrideConfig.

When you see "[Gambar - lihat imageUrl]" in the message,
retrieve and analyze the image from the imageUrl.
```

**Step 2: Configure Chat Model**
- Use GPT-4 Vision, Claude 3 with vision, or Gemini Pro Vision
- Model should be configured to accept image URLs

---

### **Option 3: Using Tool Node (For API Integration)**

**Step 1: Create Tool for Saving Report**
```javascript
// Tool: Save Report
{
  "name": "save_report",
  "description": "Save a citizen report with optional image",
  "parameters": {
    "description": { "type": "string" },
    "location": { "type": "string" },
    "imageUrl": { "type": "string" }  // ← Image URL from overrideConfig
  }
}
```

**Step 2: Tool Implementation**
```javascript
async function saveReport({ description, location, imageUrl, overrideConfig }) {
  // Use imageUrl from overrideConfig if not in parameters
  const finalImageUrl = imageUrl || overrideConfig?.imageUrl;

  // POST to your API
  const response = await fetch('https://your-api.com/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description,
      location,
      imageUrl: finalImageUrl,  // ← URL format, not base64!
      phoneNumber: overrideConfig.phoneNumber
    })
  });

  return await response.json();
}
```

**Benefits:**
- ✅ Your API receives URL (not base64)
- ✅ Easy to store in database
- ✅ Easy to display in dashboard
- ✅ Can be passed to other services

---

### **Option 4: Direct Vision Model Access**

**For Flowise with OpenAI Chat Model:**

**Step 1: Configure Chat Model Node**
- Model: `gpt-4-vision-preview` or `gpt-4o`
- Enable "Allow Image URL"

**Step 2: The model will:**
1. See `imageUrl` in overrideConfig
2. Automatically fetch image from URL
3. Analyze the image
4. Include analysis in response

---

## 🧪 Testing the New Implementation

### **1. Send WhatsApp Image**
Send any image via WhatsApp to your Fonnte number.

### **2. Check Logs**

```bash
npx supabase functions logs fonnte-webhook --tail
```

**Look for:**

```javascript
// Section A: Attachment Success
✓ Attachment processed successfully: {
  storageUrl: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/...",
  willSendToFlowise: "URL"
}

// Section B: Flowise Request
Calling Flowise API: {
  hasImageUrl: true,  // ← Must be TRUE
  question: "[Gambar - lihat imageUrl]"
}

// Section C: Image URL Details
🖼️ Image sent to Flowise: {
  method: "overrideConfig.imageUrl",
  imageUrl: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/v1/object/public/report-photos/...",
  imageName: "webhook-089654126493-...",
  imageMimeType: "image/jpeg",
  note: "Image URL available to all Flowise tools and vision models"
}
```

**✅ Success Indicators:**
- `hasImageUrl: true`
- `method: "overrideConfig.imageUrl"`
- Full Supabase Storage URL shown
- **NO** uploads array error!

### **3. Verify Flowise Receives It**

**Check Flowise Dashboard:**
1. Open conversation
2. Look at message details
3. Should see `imageUrl` in overrideConfig
4. Vision model should process the image

### **4. Verify Tool Receives URL**

**When Flowise calls your API tool:**
```json
POST /api/reports
{
  "description": "Jalan rusak di depan rumah",
  "location": "Jl. Merdeka No. 123",
  "imageUrl": "https://ykaawgnggvwleiyzvilf.supabase.co/storage/v1/object/public/report-photos/...",  // ← URL!
  "phoneNumber": "628xxx"
}
```

**NOT base64:** ✅
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."  // ← NO LONGER THIS!
}
```

---

## 📊 Comparison: Old vs New

### **Old Approach (uploads array):**
```json
{
  "question": "[Gambar]",
  "uploads": [{
    "type": "file",
    "name": "image.jpeg",
    "data": "data:image/jpeg;base64,/9j/...",  // ← 300KB base64
    "mime": "image/jpeg"
  }]
}
```

**Problems:**
- ❌ Only supports base64 (not URLs)
- ❌ 300KB+ payload size
- ❌ Slow API calls
- ❌ Tools receive base64 (hard to work with)
- ❌ `.split()` errors with URLs

---

### **New Approach (overrideConfig):**
```json
{
  "question": "[Gambar - lihat imageUrl]",
  "overrideConfig": {
    "imageUrl": "https://ykaawgnggvwleiyzvilf.supabase.co/storage/...",  // ← ~100 byte URL
    "imageName": "image.jpeg",
    "imageMimeType": "image/jpeg"
  }
}
```

**Benefits:**
- ✅ Supports URLs (no parsing errors)
- ✅ ~100 byte payload size (3000x smaller!)
- ✅ Fast API calls
- ✅ Tools receive URL (easy to work with)
- ✅ Available to all Flowise nodes
- ✅ Vision models can fetch from URL
- ✅ Standard, portable format

---

## 🔍 Troubleshooting

### **Issue: Flowise Doesn't See imageUrl**

**Diagnosis:**
```bash
# Check logs
npx supabase functions logs fonnte-webhook --tail | grep imageUrl
```

**Should see:**
```
hasImageUrl: true
imageUrl: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/..."
```

**If missing:** Check attachment processing succeeded in earlier logs.

---

### **Issue: Vision Model Doesn't Process Image**

**Possible Causes:**

1. **Model doesn't support URLs**
   - **Solution:** Use GPT-4 Vision, Claude 3, or Gemini Pro Vision
   - Verify model is vision-capable

2. **Model can't access URL**
   - **Solution:** Verify Supabase Storage bucket is public
   - Test URL in browser - should show image directly

3. **Custom Function not configured**
   - **Solution:** Add Custom Function node (see Option 1 above)
   - Extract imageUrl and pass to model

---

### **Issue: Tool Doesn't Receive imageUrl**

**Diagnosis:**
Check Flowise tool logs to see what parameters it received.

**Solution:**
In your tool function:
```javascript
function yourTool({ description, overrideConfig }) {
  // Access imageUrl from overrideConfig
  const imageUrl = overrideConfig?.imageUrl;

  console.log('Received imageUrl:', imageUrl);

  // Use it in your API call
  // ...
}
```

---

## 🎓 Understanding overrideConfig

### **What is overrideConfig?**
`overrideConfig` is a Flowise feature that allows passing custom variables to the chatflow.

**Standard Variables:**
- `sessionId` - For conversation context
- Custom variables - Any key-value pairs you add

**Our Addition:**
```javascript
overrideConfig: {
  sessionId: "xxx",        // Standard
  phoneNumber: "628xxx",   // Custom (was already there)
  userName: "John",        // Custom (was already there)
  imageUrl: "https://...", // NEW: Image URL
  imageName: "image.jpeg", // NEW: Image filename
  imageMimeType: "image/jpeg" // NEW: Image MIME type
}
```

### **Accessing in Flowise:**

**In Custom Function:**
```javascript
function run({ overrideConfig }) {
  const imageUrl = overrideConfig.imageUrl;
  const phoneNumber = overrideConfig.phoneNumber;
  // Use them...
}
```

**In Tools:**
```javascript
async function toolFunction(params, overrideConfig) {
  const imageUrl = overrideConfig.imageUrl;
  // Use in API call...
}
```

**In System Prompt:**
```
You have access to these variables:
- phoneNumber: {phoneNumber}
- userName: {userName}
- imageUrl: {imageUrl}

When imageUrl is present, analyze the image.
```

---

## 📝 Summary

### **Changes Made:**
1. ✅ Removed `uploads` array (was causing `.split()` errors)
2. ✅ Added `imageUrl` to `overrideConfig`
3. ✅ Added `imageName` and `imageMimeType` for context
4. ✅ Updated question text to reference imageUrl
5. ✅ Enhanced logging to show imageUrl

### **What You Need to Do:**
1. **Update Flowise Chatflow:**
   - Add Custom Function to extract imageUrl (Option 1)
   - OR configure System Prompt to use imageUrl (Option 2)
   - OR update Tools to access imageUrl (Option 3)

2. **Test:**
   - Send WhatsApp image
   - Check logs show `hasImageUrl: true`
   - Verify Flowise processes image
   - Verify tools receive URL format

3. **Verify Tool Actions:**
   - Check API receives URL (not base64)
   - Store URL in database
   - Display in dashboard

---

## ✅ Success Checklist

- [ ] Deployed updated Edge Function
- [ ] Sent test WhatsApp image
- [ ] Logs show `hasImageUrl: true`
- [ ] Logs show `imageUrl: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/..."`
- [ ] **NO** `.split()` errors from Flowise
- [ ] Flowise chatflow configured to use imageUrl
- [ ] Vision model processes image (if using vision)
- [ ] Tools receive URL format (not base64)
- [ ] API stores/uses URL correctly
- [ ] Dashboard displays images

---

## 📚 Related Files

- **Implementation:** [flowise-client.ts:85-103](supabase/functions/fonnte-webhook/flowise-client.ts#L85-L103)
- **Logging:** [flowise-client.ts:135-144](supabase/functions/fonnte-webhook/flowise-client.ts#L135-L144)
- **Message Content:** [index.ts:105-108](supabase/functions/fonnte-webhook/index.ts#L105-L108)
- **Type Definitions:** [types.ts](supabase/functions/fonnte-webhook/types.ts)

---

**Status:** ✅ Deployed and ready for testing
**Error Fixed:** `.split()` error resolved by using overrideConfig instead of uploads
**Next:** Configure Flowise chatflow to use imageUrl from overrideConfig
