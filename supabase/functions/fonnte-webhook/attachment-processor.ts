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

// -----------------------------------------------------------------------------
// Validate File Extension
// -----------------------------------------------------------------------------
export function validateFileExtension(extension: string): boolean {
  const ext = extension.toLowerCase().replace('.', '');
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
  const ext = extension.toLowerCase().replace('.', '');

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
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { data, contentType };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to download attachment: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Upload to Supabase Storage
// -----------------------------------------------------------------------------
async function uploadToStorage(
  data: Uint8Array,
  filename: string,
  mimeType: string
): Promise<{ storagePath: string; storageUrl: string }> {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `whatsapp-attachments/${timestamp}_${sanitizedFilename}`;

  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('report-photos')
    .upload(storagePath, data, {
      contentType: mimeType,
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload to storage: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase
    .storage
    .from('report-photos')
    .getPublicUrl(storagePath);

  return {
    storagePath,
    storageUrl: urlData.publicUrl
  };
}

// -----------------------------------------------------------------------------
// Convert to Base64 Data URI
// -----------------------------------------------------------------------------
function convertToBase64DataUri(data: Uint8Array, mimeType: string): string {
  // Convert Uint8Array to base64
  const binary = Array.from(data, byte => String.fromCharCode(byte)).join('');
  const base64 = btoa(binary);

  return `data:${mimeType};base64,${base64}`;
}

// -----------------------------------------------------------------------------
// Save Attachment Metadata
// -----------------------------------------------------------------------------
async function saveAttachmentMetadata(params: {
  message_id: string;
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
  messageId: string
): Promise<AttachmentResult> {
  // 1. Validate file extension
  if (!validateFileExtension(extension)) {
    throw new Error(ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE);
  }

  const mimeType = getMimeType(extension);
  const attachmentType = getAttachmentType(extension);

  try {
    // 2. Download from Fonnte
    const { data, contentType } = await downloadAttachment(fonnteUrl);

    // 3. Validate file size
    if (data.length > MAX_FILE_SIZE) {
      throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
    }

    // 4. Upload to Supabase Storage
    const { storagePath, storageUrl } = await uploadToStorage(data, filename, mimeType);

    // 5. Convert to base64 for Flowise
    const base64DataUri = convertToBase64DataUri(data, mimeType);

    // 6. Save metadata
    const attachmentId = await saveAttachmentMetadata({
      message_id: messageId,
      original_url: fonnteUrl,
      filename,
      extension: extension.replace('.', ''),
      mime_type: mimeType,
      file_size: data.length,
      storage_path: storagePath,
      storage_url: storageUrl,
      base64_data: base64DataUri
    });

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
  messageId: string
): Promise<AttachmentResult | null> {
  try {
    return await processAttachment(fonnteUrl, filename, extension, messageId);
  } catch (error) {
    console.error('Attachment processing failed (continuing without attachment):', error);
    return null;
  }
}