// =============================================================================
// Infobip Attachment Processor
// Handles image downloads from Infobip (requires auth header) then delegates
// to shared storage/base64/metadata utilities from fonnte-webhook.
// Scope: images only. Video, document, audio are skipped at the webhook level.
// =============================================================================

import {
  uploadToStorage,
  convertToBase64DataUri,
  saveAttachmentMetadata,
  getMimeType,
  getAttachmentType
} from '../fonnte-webhook/attachment-processor.ts';
import type { AttachmentResult } from '../fonnte-webhook/types.ts';

// -----------------------------------------------------------------------------
// Download image from Infobip CDN (requires Authorization: App {apiKey})
// -----------------------------------------------------------------------------
async function downloadFromInfobip(url: string, apiKey: string): Promise<{
  data: Uint8Array;
  contentType: string;
}> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `App ${apiKey}`,
      'User-Agent': 'Supabase-Edge-Function/1.0'
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Failed to download from Infobip: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  console.log(`[Infobip Attachment] Downloaded ${data.length} bytes`);
  return { data, contentType };
}

// -----------------------------------------------------------------------------
// Resolve file extension from content-type, URL path, or default to jpg
// -----------------------------------------------------------------------------
function resolveExtension(contentType: string, url: string): string {
  // Priority 1: Content-Type header
  const ctMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif'
  };
  const baseType = contentType.split(';')[0].trim().toLowerCase();
  if (ctMap[baseType]) return ctMap[baseType];

  // Priority 2: URL path extension
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    if (match) return match[1].toLowerCase();
  } catch {
    // ignore invalid URL
  }

  // Default
  return 'jpg';
}

// -----------------------------------------------------------------------------
// Process Infobip image attachment (main entry point)
// Returns AttachmentResult on success, null on any failure (non-fatal)
// -----------------------------------------------------------------------------
export async function processInfobipAttachment(
  imageUrl: string,
  apiKey: string,
  messageId: string,
  tenantId?: string
): Promise<AttachmentResult | null> {
  try {
    console.log('[Infobip Attachment] Processing image...');

    // 1. Download from Infobip (requires auth header)
    const { data, contentType } = await downloadFromInfobip(imageUrl, apiKey);

    // 2. Resolve extension and mime type
    const extension = resolveExtension(contentType, imageUrl);
    const mimeType = getMimeType(extension);

    // 3. Generate a filename
    const filename = `infobip_${Date.now()}.${extension}`;

    // 4. Upload to Supabase Storage (shared utility)
    const { storagePath, storageUrl } = await uploadToStorage(data, filename, mimeType);

    // 5. Convert to base64 for Flowise (shared utility)
    const base64DataUri = convertToBase64DataUri(data, mimeType);

    // 6. Save metadata (shared utility)
    const attachmentId = await saveAttachmentMetadata({
      message_id: messageId,
      tenant_id: tenantId,
      original_url: imageUrl,
      filename,
      extension,
      mime_type: mimeType,
      file_size: data.length,
      storage_path: storagePath,
      storage_url: storageUrl,
      base64_data: base64DataUri
    });

    console.log('[Infobip Attachment] Processing complete:', attachmentId);

    return {
      attachmentId,
      base64DataUri,
      storageUrl,
      filename,
      mimeType,
      extension
    };
  } catch (error) {
    console.error('[Infobip Attachment] Processing failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
