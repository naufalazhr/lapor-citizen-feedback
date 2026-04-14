// =============================================================================
// Notification WhatsApp Sender
// -----------------------------------------------------------------------------
// Sends messages via Fonnte using the DEDICATED notification device (separate
// from the conversation Fonnte device). This isolation is critical: if the
// notification number gets banned, the conversation number is unaffected.
//
// Reads credentials from `notification_whatsapp_config` table — NEVER from
// `fonnte_config` (which is used for citizen conversations).
// =============================================================================

const FONNTE_SEND_API = 'https://api.fonnte.com/send';
const SEND_TIMEOUT_MS = 15000;

export interface NotificationSendParams {
  target: string;       // normalized E.164-ish (e.g. "628123456789")
  message: string;
  token: string;        // Fonnte API token from notification_whatsapp_config
}

export interface NotificationSendResult {
  success: boolean;
  messageId?: string;
  detail?: string;
  error?: string;
}

/**
 * Normalize an Indonesian phone number to the format Fonnte expects: "62..."
 * Accepts inputs like "08123...", "+628123...", "628123...", with optional
 * spaces/dashes.
 */
export function normalizeIndonesianPhone(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (!digits.startsWith('62')) {
    digits = '62' + digits;
  }
  return digits;
}

/**
 * Send a single WhatsApp message via the notification Fonnte device.
 * Does NOT retry — the caller (sla-notifications) handles retries at a
 * higher level if needed, and retries can increase ban risk.
 */
export async function sendNotificationWhatsApp(
  params: NotificationSendParams
): Promise<NotificationSendResult> {
  const { target, message, token } = params;

  if (!target || !message || !token) {
    return {
      success: false,
      error: 'Missing required parameter (target, message, or token)',
    };
  }

  const formData = new FormData();
  formData.append('target', target);
  formData.append('message', message);
  formData.append('countryCode', '62');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch(FONNTE_SEND_API, {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Fonnte ${response.status}: ${text.slice(0, 300)}`,
      };
    }

    // Fonnte response often has { status: true, id: [...], detail: ... }
    const fonnteStatus = data['status'];
    if (fonnteStatus === false) {
      return {
        success: false,
        error:
          (data['reason'] as string) ||
          (data['message'] as string) ||
          'Fonnte returned status=false',
      };
    }

    const messageId = Array.isArray(data['id'])
      ? String((data['id'] as unknown[])[0] ?? '')
      : typeof data['id'] === 'string' || typeof data['id'] === 'number'
      ? String(data['id'])
      : undefined;

    return {
      success: true,
      messageId,
      detail: (data['detail'] as string) ?? (data['message'] as string),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Fonnte send timeout' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown send error',
    };
  }
}

/**
 * Sleep for N milliseconds — used between sends as anti-ban delay.
 * Adds a small jitter so bursts look more natural.
 */
export async function antibanDelay(baseMs: number): Promise<void> {
  if (baseMs <= 0) return;
  const jitter = Math.floor(Math.random() * 1500); // 0-1500ms jitter
  const ms = baseMs + jitter;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
