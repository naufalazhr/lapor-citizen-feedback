// =============================================================================
// Type Definitions for Fonnte-Flowise Integration
// =============================================================================

// -----------------------------------------------------------------------------
// Fonnte Webhook Payload
// Based on Fonnte webhook documentation and actual webhook data
// NOTE: Fonnte sends different field names based on language/mode
// -----------------------------------------------------------------------------
export interface FonnteWebhookPayload {
  // Basic fields
  submission?: string;      // Submission name
  sender: string;           // Phone number (e.g., "628123456789")
  pengirim?: string;        // Alternative sender field (Indonesian)
  senderlid?: string;       // Sender LID
  name?: string;            // Sender's name
  device: string;           // Device number

  // Message fields (Fonnte sends multiple variations)
  message?: string;         // Message text (English field)
  pesan?: string;           // Message text (Indonesian field)
  text?: string;            // Alternative message text field
  quick?: string;           // Quick reply

  // Group/member fields
  list?: string;            // Form submission data
  member?: string;          // Group member
  mode?: string;            // Message mode
  isgroup?: boolean;        // Is group message

  // Location data
  // Fonnte sends as STRING: "-6.123456,107.123456"
  // Or potentially as object: { latitude: number, longitude: number }
  location?: string | {
    latitude: number;
    longitude: number;
  };

  // Attachment fields
  url?: string;             // Attachment URL
  filename?: string;        // Attachment filename (may be empty)
  extension?: string;       // File extension
  type?: string;            // Attachment type (image/video/document/audio)

  // Poll fields
  pollname?: string;        // Poll name
  choices?: string;         // Poll choices

  // Metadata
  inboxid?: string;         // Inbox ID
  isforwarded?: boolean;    // Is forwarded message
  timestamp?: number;       // Message timestamp
}

// -----------------------------------------------------------------------------
// Flowise API Types
// Based on Flowise Prediction API documentation
// -----------------------------------------------------------------------------
export interface FlowiseRequest {
  question?: string;        // The user's message
  form?: object;            // Alternative for Agentflow V2
  streaming?: boolean;      // Enable streaming responses
  overrideConfig?: {        // Session variables
    sessionId?: string;     // CRITICAL: Flowise session ID for context
    [key: string]: any;
  };
  history?: Array<{         // Conversation history (Flowise format)
    role: 'userMessage' | 'apiMessage';
    content: string;
  }>;
  uploads?: Array<{         // File uploads
    type: 'file';
    name: string;
    data: string;           // Image URL (e.g., "https://xxx.supabase.co/storage/...") or Base64 data URI
    mime: string;
  }>;
}

export interface FlowiseResponse {
  text?: string;            // Response text (primary response field)
  question?: string;        // User's question
  chatId?: string;          // CRITICAL: Session ID (primary field, confirmed from actual response)
  chatMessageId?: string;   // Message identifier
  executionId?: string;     // Execution identifier
  sessionId?: string;       // Alternative session ID field (for compatibility)
  response?: string;        // Alternative response field
  answer?: string;          // Another alternative response field
  agentFlowExecutedData?: any[]; // Agent flow execution data
  [key: string]: any;       // Flexible for other fields
}

export interface FlowiseConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  api_url: string;
  api_key: string;
  chatflow_id: string;
  streaming: boolean;
  timeout_seconds: number;
  session_variables?: Record<string, any>;
}

// -----------------------------------------------------------------------------
// Fonnte Configuration
// -----------------------------------------------------------------------------
export interface FonnteConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  api_token: string | null;
  device_numbers: string[];
  auto_reply_enabled: boolean;
  session_timeout_minutes: number;
  tenant_id?: string | null;
}

// -----------------------------------------------------------------------------
// Fonnte Send API Response
// -----------------------------------------------------------------------------
export interface FonnteSendResponse {
  status: boolean;
  message?: string;
  detail?: string;
  error?: string;
}

// -----------------------------------------------------------------------------
// Database Types
// -----------------------------------------------------------------------------
export interface Conversation {
  id: string;
  session_id: string;       // Flowise session ID
  phone_number: string;
  sender_name?: string;
  status: 'active' | 'completed' | 'abandoned';
  channel: 'whatsapp' | 'telegram';
  device_number?: string;
  last_message_at: string;
  started_at: string;
  completed_at?: string;
  report_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  has_attachment: boolean;
  attachment_url?: string;
  attachment_type?: string;
  attachment_filename?: string;
  message_index: number;
  token_count?: number;
  created_at: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  original_url: string;
  filename: string;
  extension: string;
  mime_type: string;
  file_size?: number;
  storage_path?: string;
  storage_url?: string;
  base64_data?: string;
  processed_at?: string;
  download_status: 'pending' | 'downloaded' | 'failed';
  upload_status: 'pending' | 'uploaded' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Attachment Processing
// -----------------------------------------------------------------------------
export interface AttachmentResult {
  attachmentId: string;
  base64DataUri: string;    // Data URI for Flowise (e.g., "data:image/jpeg;base64,...")
  storageUrl: string;       // URL in Supabase Storage
  filename: string;
  mimeType: string;
  extension: string;
}

// -----------------------------------------------------------------------------
// Validation Constants
// -----------------------------------------------------------------------------
export const ALLOWED_FILE_EXTENSIONS = {
  image: ['png', 'jpg', 'jpeg', 'webp'],
  video: ['mp4'],
  file: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'],
  audio: ['mp3']
} as const;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes (increased for video support)

export const MIME_TYPE_MAP: Record<string, string> = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp',
  'mp4': 'video/mp4',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'csv': 'text/csv',
  'txt': 'text/plain',
  'mp3': 'audio/mpeg'
};

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------
export interface WebhookError {
  source: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  payload?: any;
  conversation_id?: string;
}

// -----------------------------------------------------------------------------
// User-Friendly Error Messages (Indonesian)
// -----------------------------------------------------------------------------
export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: 'Maaf, file terlalu besar. Maksimal 10MB.',
  UNSUPPORTED_FILE_TYPE: 'Maaf, tipe file tidak didukung. Gunakan: gambar (JPG/PNG/WEBP), video (MP4), dokumen (PDF/DOC/XLS/CSV/TXT), atau audio (MP3).',
  ATTACHMENT_DOWNLOAD_FAILED: 'Maaf, gagal mengunduh lampiran. Silakan coba lagi.',
  FLOWISE_TIMEOUT: 'Maaf, sistem sedang sibuk. Silakan coba lagi dalam beberapa saat.',
  FLOWISE_ERROR: 'Maaf, terjadi kesalahan saat memproses pesan Anda. Tim kami telah diberitahu.',
  GENERAL_ERROR: 'Maaf, terjadi kesalahan teknis. Tim kami telah diberitahu. Silakan coba lagi nanti.',
  NO_FLOWISE_CONFIG: 'Maaf, sistem belum dikonfigurasi. Silakan hubungi administrator.',
  SESSION_ERROR: 'Maaf, terjadi kesalahan pada sesi percakapan. Mari kita mulai lagi.'
} as const;

// -----------------------------------------------------------------------------
// Helper Functions for Fonnte Payload Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize Fonnte payload to handle different field name variations
 * Fonnte sends different field names (pesan vs message, pengirim vs sender)
 */
export function normalizeFonntePayload(payload: FonnteWebhookPayload): {
  sender: string;
  device: string;
  message: string;
  name?: string;
  url?: string;
  filename?: string;
  extension?: string;
  hasAttachment: boolean;
  location?: {
    lat: number;
    lng: number;
  };
} {
  // Get message text from multiple possible fields
  const messageText = payload.message || payload.pesan || payload.text || '';

  // Get sender from multiple possible fields
  const senderPhone = payload.sender || payload.pengirim || '';

  // Generate filename from URL if not provided by Fonnte
  let finalFilename = payload.filename;
  if (!finalFilename && payload.url) {
    // Extract filename from URL
    // Example: "https://api.fonnte.com/t/webhook-089654126493-1761811231662968657.jpeg"
    const urlParts = payload.url.split('/');
    const urlFilename = urlParts[urlParts.length - 1];
    finalFilename = urlFilename || `attachment_${Date.now()}.${payload.extension || 'file'}`;
  }

  // Extract and convert location data from Fonnte format to database format
  // Fonnte sends: STRING "-6.123456,107.123456" OR OBJECT { latitude, longitude }
  // Database expects: { lat, lng }
  let geoLocation: { lat: number; lng: number } | undefined;

  if (payload.location) {
    if (typeof payload.location === 'string') {
      // Parse string format: "lat,lng"
      // Example: "-6.932582378387451,107.66425323486328"
      const parts = payload.location.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        // Validate parsed numbers
        if (!isNaN(lat) && !isNaN(lng)) {
          geoLocation = { lat, lng };
        } else {
          console.warn('⚠️ Failed to parse location string - invalid numbers:', payload.location);
        }
      } else {
        console.warn('⚠️ Failed to parse location string - wrong format:', payload.location);
      }
    } else if (typeof payload.location === 'object' && 'latitude' in payload.location && 'longitude' in payload.location) {
      // Support object format (if Fonnte changes format in future)
      const lat = parseFloat(String(payload.location.latitude));
      const lng = parseFloat(String(payload.location.longitude));

      if (!isNaN(lat) && !isNaN(lng)) {
        geoLocation = { lat, lng };
      }
    }
  }

  return {
    sender: senderPhone,
    device: payload.device,
    message: messageText,
    name: payload.name,
    url: payload.url,
    filename: finalFilename,
    extension: payload.extension,
    hasAttachment: !!(payload.url && payload.extension),
    location: geoLocation
  };
}