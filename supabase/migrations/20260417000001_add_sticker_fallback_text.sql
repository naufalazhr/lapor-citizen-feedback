-- Add customizable sticker fallback reply text to whatsapp_cloud_config
-- Admins can edit this per-tenant in the WhatsApp Cloud config page.
-- Webhook falls back to a hardcoded default if this is null/empty.

ALTER TABLE public.whatsapp_cloud_config
  ADD COLUMN IF NOT EXISTS sticker_fallback_text TEXT
  DEFAULT 'Maaf, stiker belum didukung. Silakan kirim pesan teks atau foto laporan Anda agar kami dapat membantu. 🙏';
