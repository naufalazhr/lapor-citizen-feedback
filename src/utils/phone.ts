// =============================================================================
// Phone / Contact Name Helpers
// -----------------------------------------------------------------------------
// Browser-side mirrors of the Deno helpers in
// `supabase/functions/sla-notifications/notification-whatsapp.ts`.
// Used for generating Fonnte-compatible CSV exports from the admin UI.
// Keep these in sync with the Deno versions if the logic ever changes.
// =============================================================================

/**
 * Normalize an Indonesian phone number to the format Fonnte expects: "62...".
 * Accepts inputs like "08123...", "+628123...", "628123...", with optional
 * spaces, dashes, or parentheses.
 */
export function normalizeIndonesianPhone(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (!digits.startsWith("62")) {
    digits = "62" + digits;
  }
  return digits;
}

/**
 * Sanitize a contact name for Fonnte's Phone Book import.
 * Fonnte tolerates ASCII best — Unicode em-dashes and curly quotes have
 * been observed to cause "invalid contact" errors on import.
 */
export function sanitizeContactName(raw: string): string {
  return (raw || "")
    .replace(/[\u2012\u2013\u2014\u2015]/g, "-") // figure/en/em/horizontal dashes → hyphen
    .replace(/[\u2018\u2019]/g, "'")              // curly single quotes → ascii
    .replace(/[\u201C\u201D]/g, '"')              // curly double quotes → ascii
    .replace(/\s+/g, " ")                          // collapse whitespace
    .trim()
    .slice(0, 60);                                 // Fonnte-safe length cap
}
