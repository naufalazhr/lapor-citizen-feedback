// =============================================================================
// WhatsApp Cloud (Meta) Attachment Processor
// Handles image downloads from Meta Graph API (two-step process):
//   Step 1: GET graph.facebook.com/v19.0/{mediaId} with Bearer → { url }
//   Step 2: GET {url} with Authorization: Bearer {accessToken} → binary
// Scope: images only. Video, document, audio are skipped at the webhook level.
// =============================================================================

import {
  uploadToStorage,
  convertToBase64DataUri,
  saveAttachmentMetadata,
  getMimeType
} from '../fonnte-webhook/attachment-processor.ts';
import type { AttachmentResult } from '../fonnte-webhook/types.ts';

const GRAPH_API_VERSION = 'v19.0';
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds

// -----------------------------------------------------------------------------
// Step 1: Resolve the CDN URL from a Meta media ID
// Returns the download URL or throws on failure
// -----------------------------------------------------------------------------
async function resolveMetaMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  const metaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`;

  const response = await fetch(metaUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve Meta media URL: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.url) {
    throw new Error(`Meta media API returned no URL for mediaId: ${mediaId}`);
  }

  return data.url as string;
}

// -----------------------------------------------------------------------------
// Step 2: Download binary from Meta CDN (requires Bearer auth)
// Returns raw bytes and content type
// -----------------------------------------------------------------------------
async function downloadFromMeta(url: string, accessToken: string): Promise<{
  data: Uint8Array;
  contentType: string;
}> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Supabase-Edge-Function/1.0'
    },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`Failed to download from Meta CDN: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  console.log(`[Meta Attachment] Downloaded ${data.length} bytes`);
  return { data, contentType };
}

// -----------------------------------------------------------------------------
// Resolve file extension from MIME type (from webhook payload or Content-Type)
// -----------------------------------------------------------------------------
function resolveExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif'
  };
  const baseType = mimeType.split(';')[0].trim().toLowerCase();
  return mimeMap[baseType] || 'jpg';
}

// -----------------------------------------------------------------------------
// Process Meta image attachment (main entry point)
// Returns AttachmentResult on success, null on any failure (non-fatal)
// -----------------------------------------------------------------------------
export async function processMetaAttachment(
  mediaId: string,
  mimeType: string,
  accessToken: string,
  messageId: string,
  tenantId?: string
): Promise<AttachmentResult | null> {
  try {
    console.log('[Meta Attachment] Processing image, mediaId:', mediaId);

    // 1. Resolve CDN URL from Media ID
    const mediaUrl = await resolveMetaMediaUrl(mediaId, accessToken);

    // 2. Download binary from Meta CDN
    const { data, contentType } = await downloadFromMeta(mediaUrl, accessToken);

    // 3. Resolve extension — prefer mime_type from webhook payload (more reliable)
    const extension = resolveExtensionFromMimeType(mimeType || contentType);
    const resolvedMimeType = getMimeType(extension);

    // 4. Generate a filename
    const filename = `meta_${Date.now()}.${extension}`;

    // 5. Upload to Supabase Storage (shared utility)
    const { storagePath, storageUrl } = await uploadToStorage(data, filename, resolvedMimeType);

    // 6. Convert to base64 for Flowise (shared utility)
    const base64DataUri = convertToBase64DataUri(data, resolvedMimeType);

    // 7. Save metadata (shared utility)
    const attachmentId = await saveAttachmentMetadata({
      message_id: messageId,
      tenant_id: tenantId,
      original_url: mediaUrl,
      filename,
      extension,
      mime_type: resolvedMimeType,
      file_size: data.length,
      storage_path: storagePath,
      storage_url: storageUrl,
      base64_data: base64DataUri
    });

    console.log('[Meta Attachment] Processing complete:', attachmentId);

    return {
      attachmentId,
      base64DataUri,
      storageUrl,
      filename,
      mimeType: resolvedMimeType,
      extension
    };
  } catch (error) {
    console.error('[Meta Attachment] Processing failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
