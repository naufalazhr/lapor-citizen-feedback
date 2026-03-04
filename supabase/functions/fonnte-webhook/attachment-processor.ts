// =============================================================================
// Attachment Processor
// Handles downloading, validating, storing, and converting attachments
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
  MIME_TYPE_MAP,
  ERROR_MESSAGES,
  type AttachmentResult
} from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Debug utility
const debugLog = (...args: any[]) => {
  if (Deno.env.get('DEBUG') === 'true') {
    console.log(...args);
  }
};

// -----------------------------------------------------------------------------
// Validate File Extension
// -----------------------------------------------------------------------------
export function validateFileExtension(extension: string): boolean {
  const ext = extension.toLowerCase().replace('.', '') as any;
  const allExtensions = [
    ...ALLOWED_FILE_EXTENSIONS.image,
    ...ALLOWED_FILE_EXTENSIONS.video,
    ...ALLOWED_FILE_EXTENSIONS.file,
    ...ALLOWED_FILE_EXTENSIONS.audio
  ];

  return allExtensions.includes(ext);
}

// -----------------------------------------------------------------------------
// Get MIME Type from Extension
// -----------------------------------------------------------------------------
export function getMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace('.', '');
  return MIME_TYPE_MAP[ext] || 'application/octet-stream';
}

// -----------------------------------------------------------------------------
// Get Attachment Type Category
// -----------------------------------------------------------------------------
export function getAttachmentType(extension: string): 'image' | 'video' | 'document' | 'audio' {
  const ext = extension.toLowerCase().replace('.', '') as any;

  if (ALLOWED_FILE_EXTENSIONS.image.includes(ext)) return 'image';
  if (ALLOWED_FILE_EXTENSIONS.video.includes(ext)) return 'video';
  if (ALLOWED_FILE_EXTENSIONS.audio.includes(ext)) return 'audio';
  return 'document';
}

// -----------------------------------------------------------------------------
// Download Attachment from Fonnte URL
// -----------------------------------------------------------------------------
async function downloadAttachment(url: string): Promise<{
  data: Uint8Array;
  contentType: string;
}> {
  debugLog('[Attachment] Downloading from Fonnte URL...');
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      console.error(`[Attachment] Download failed: HTTP ${response.status}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    debugLog(`[Attachment] Downloaded ${data.length} bytes`);
    return { data, contentType };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Attachment] Download error:', err.message);
    throw new Error(`Failed to download attachment: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Upload to Supabase Storage
// -----------------------------------------------------------------------------
export async function uploadToStorage(
  data: Uint8Array,
  filename: string,
  mimeType: string
): Promise<{ storagePath: string; storageUrl: string }> {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `whatsapp-attachments/${timestamp}_${sanitizedFilename}`;

  debugLog(`[Attachment] Uploading to storage: ${storagePath} (${data.length} bytes)`);

  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('report-photos')
    .upload(storagePath, data, {
      contentType: mimeType,
      upsert: false
    });

  if (uploadError) {
    console.error('[Attachment] Upload failed:', uploadError.message);
    throw new Error(`Failed to upload to storage: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase
    .storage
    .from('report-photos')
    .getPublicUrl(storagePath);

  // If a public-facing URL override is set (e.g., local Docker), rewrite the base
  let publicUrl = urlData.publicUrl;
  const supabasePublicUrl = Deno.env.get('SUPABASE_PUBLIC_URL');
  if (supabasePublicUrl && publicUrl.startsWith(supabaseUrl)) {
    publicUrl = publicUrl.replace(supabaseUrl, supabasePublicUrl);
  }

  console.log('[Attachment] Uploaded successfully');

  return {
    storagePath,
    storageUrl: publicUrl
  };
}

// -----------------------------------------------------------------------------
// Convert to Base64 Data URI
// -----------------------------------------------------------------------------
export function convertToBase64DataUri(data: Uint8Array, mimeType: string): string {
  // Convert Uint8Array to base64
  const binary = Array.from(data, byte => String.fromCharCode(byte)).join('');
  const base64 = btoa(binary);

  return `data:${mimeType};base64,${base64}`;
}

// -----------------------------------------------------------------------------
// Save Attachment Metadata
// -----------------------------------------------------------------------------
export async function saveAttachmentMetadata(params: {
  message_id: string;
  tenant_id?: string;
  original_url: string;
  filename: string;
  extension: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  storage_url: string;
  base64_data: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      message_id: params.message_id,
      tenant_id: params.tenant_id || null,
      original_url: params.original_url,
      filename: params.filename,
      extension: params.extension,
      mime_type: params.mime_type,
      file_size: params.file_size,
      storage_path: params.storage_path,
      storage_url: params.storage_url,
      base64_data: params.base64_data,
      download_status: 'downloaded',
      upload_status: 'uploaded',
      processed_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to save attachment metadata: ${error?.message}`);
  }

  return data.id;
}

// -----------------------------------------------------------------------------
// Log Failed Attachment
// -----------------------------------------------------------------------------
async function logFailedAttachment(params: {
  message_id: string;
  original_url: string;
  filename: string;
  extension: string;
  error_message: string;
}): Promise<void> {
  await supabase
    .from('attachments')
    .insert({
      message_id: params.message_id,
      original_url: params.original_url,
      filename: params.filename,
      extension: params.extension,
      mime_type: getMimeType(params.extension),
      download_status: 'failed',
      upload_status: 'failed',
      error_message: params.error_message
    });
}

// -----------------------------------------------------------------------------
// Process Attachment (Main Function)
// Downloads, validates, stores, and converts attachment for Flowise
// -----------------------------------------------------------------------------
export async function processAttachment(
  fonnteUrl: string,
  filename: string,
  extension: string,
  messageId: string,
  tenantId?: string
): Promise<AttachmentResult> {
  console.log('[Attachment] Processing:', filename);

  // 1. Validate file extension
  if (!validateFileExtension(extension)) {
    console.error(`[Attachment] Unsupported file type: ${extension}`);
    throw new Error(ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE);
  }

  const mimeType = getMimeType(extension);
  const attachmentType = getAttachmentType(extension);
  debugLog(`[Attachment] Valid file type: ${attachmentType} (${mimeType})`);

  try {
    // 2. Download from Fonnte
    const { data, contentType } = await downloadAttachment(fonnteUrl);

    // 3. Validate file size
    if (data.length > MAX_FILE_SIZE) {
      console.error(`[Attachment] File too large: ${data.length} bytes`);
      throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
    }

    // 4. Upload to Supabase Storage
    const { storagePath, storageUrl } = await uploadToStorage(data, filename, mimeType);

    // 5. Convert to base64 for Flowise
    debugLog('[Attachment] Converting to base64...');
    const base64DataUri = convertToBase64DataUri(data, mimeType);

    // 6. Save metadata
    const attachmentId = await saveAttachmentMetadata({
      message_id: messageId,
      tenant_id: tenantId,
      original_url: fonnteUrl,
      filename,
      extension: extension.replace('.', ''),
      mime_type: mimeType,
      file_size: data.length,
      storage_path: storagePath,
      storage_url: storageUrl,
      base64_data: base64DataUri
    });

    console.log('[Attachment] Processing complete:', attachmentId);

    return {
      attachmentId,
      base64DataUri,
      storageUrl,
      filename,
      mimeType,
      extension: extension.replace('.', '')
    };
  } catch (error) {
    // Log failed attachment
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Attachment] Processing failed:', err.message);

    await logFailedAttachment({
      message_id: messageId,
      original_url: fonnteUrl,
      filename,
      extension: extension.replace('.', ''),
      error_message: err.message
    });

    throw err;
  }
}

// -----------------------------------------------------------------------------
// Process Attachment Safe (with error handling)
// Returns null instead of throwing, allowing webhook to continue without attachment
// -----------------------------------------------------------------------------
export async function processAttachmentSafe(
  fonnteUrl: string,
  filename: string,
  extension: string,
  messageId: string,
  tenantId?: string
): Promise<AttachmentResult | null> {
  try {
    return await processAttachment(fonnteUrl, filename, extension, messageId, tenantId);
  } catch (error) {
    console.error('Attachment processing failed (continuing without attachment):', error);
    return null;
  }
}