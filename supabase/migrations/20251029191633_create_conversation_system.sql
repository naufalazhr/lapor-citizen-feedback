-- =============================================================================
-- Migration: Create Conversation System for WhatsApp-Fonnte-Flowise Integration
-- Description: Creates tables for managing WhatsApp conversations, messages,
--              attachments, and integration configurations
-- Author: Claude Code
-- Date: 2025-10-29
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE ENUMS (Idempotent)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.session_status AS ENUM ('active', 'completed', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('whatsapp', 'telegram');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE public.session_status IS 'Status of a conversation session';
COMMENT ON TYPE public.channel_type IS 'Communication channel for conversations';
COMMENT ON TYPE public.message_role IS 'Role of message sender in conversation';

-- =============================================================================
-- STEP 2: CREATE TABLES (Idempotent)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  sender_name TEXT,
  status public.session_status NOT NULL DEFAULT 'active',
  channel public.channel_type NOT NULL DEFAULT 'whatsapp',
  device_number TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role public.message_role NOT NULL,
  content TEXT NOT NULL,
  has_attachment BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_filename TEXT,
  message_index INTEGER NOT NULL,
  token_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, message_index)
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  storage_path TEXT,
  storage_url TEXT,
  base64_data TEXT,
  processed_at TIMESTAMPTZ,
  download_status TEXT NOT NULL DEFAULT 'pending',
  upload_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_file_size CHECK (file_size IS NULL OR file_size <= 10485760)
);

CREATE TABLE IF NOT EXISTS public.flowise_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name TEXT NOT NULL UNIQUE DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  chatflow_id TEXT NOT NULL,
  streaming BOOLEAN NOT NULL DEFAULT false,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  session_variables JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_timeout_range CHECK (timeout_seconds >= 10 AND timeout_seconds <= 120)
);

CREATE TABLE IF NOT EXISTS public.fonnte_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name TEXT NOT NULL UNIQUE DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  device_numbers TEXT[] NOT NULL DEFAULT '{}',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_session_timeout_range CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 1440)
);

CREATE TABLE IF NOT EXISTS public.webhook_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  payload JSONB,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: CREATE INDEXES (Idempotent)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON public.conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON public.conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_report ON public.conversations(report_id) WHERE report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, message_index);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.messages(role);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON public.attachments(download_status, upload_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_flowise_active ON public.flowise_config(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fonnte_active ON public.fonnte_config(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_errors_source ON public.webhook_errors(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_conversation ON public.webhook_errors(conversation_id);

-- =============================================================================
-- STEP 4: CREATE UPDATE TRIGGERS (Idempotent)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_attachments_updated_at ON public.attachments;
CREATE TRIGGER update_attachments_updated_at
  BEFORE UPDATE ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_flowise_config_updated_at ON public.flowise_config;
CREATE TRIGGER update_flowise_config_updated_at
  BEFORE UPDATE ON public.flowise_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fonnte_config_updated_at ON public.fonnte_config;
CREATE TRIGGER update_fonnte_config_updated_at
  BEFORE UPDATE ON public.fonnte_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowise_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fonnte_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_errors ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 6: CREATE RLS POLICIES (Idempotent)
-- =============================================================================

-- Conversations Policies
DROP POLICY IF EXISTS "Admins can view conversations" ON public.conversations;
CREATE POLICY "Admins can view conversations" ON public.conversations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Admins can update conversations" ON public.conversations;
CREATE POLICY "Admins can update conversations" ON public.conversations FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Service role can manage conversations" ON public.conversations;
CREATE POLICY "Service role can manage conversations" ON public.conversations FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Messages Policies
DROP POLICY IF EXISTS "Admins can view messages" ON public.messages;
CREATE POLICY "Admins can view messages" ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Service role can manage messages" ON public.messages;
CREATE POLICY "Service role can manage messages" ON public.messages FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Attachments Policies
DROP POLICY IF EXISTS "Admins can view attachments" ON public.attachments;
CREATE POLICY "Admins can view attachments" ON public.attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Service role can manage attachments" ON public.attachments;
CREATE POLICY "Service role can manage attachments" ON public.attachments FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Flowise Config Policies
DROP POLICY IF EXISTS "Admins can view flowise config" ON public.flowise_config;
CREATE POLICY "Admins can view flowise config" ON public.flowise_config FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Admins can insert flowise config" ON public.flowise_config;
CREATE POLICY "Admins can insert flowise config" ON public.flowise_config FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Admins can update flowise config" ON public.flowise_config;
CREATE POLICY "Admins can update flowise config" ON public.flowise_config FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Service role can read flowise config" ON public.flowise_config;
CREATE POLICY "Service role can read flowise config" ON public.flowise_config FOR SELECT TO service_role
USING (true);

-- Fonnte Config Policies
DROP POLICY IF EXISTS "Admins can view fonnte config" ON public.fonnte_config;
CREATE POLICY "Admins can view fonnte config" ON public.fonnte_config FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Admins can insert fonnte config" ON public.fonnte_config;
CREATE POLICY "Admins can insert fonnte config" ON public.fonnte_config FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Admins can update fonnte config" ON public.fonnte_config;
CREATE POLICY "Admins can update fonnte config" ON public.fonnte_config FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Service role can read fonnte config" ON public.fonnte_config;
CREATE POLICY "Service role can read fonnte config" ON public.fonnte_config FOR SELECT TO service_role
USING (true);

-- Webhook Errors Policies
DROP POLICY IF EXISTS "Admins can view webhook errors" ON public.webhook_errors;
CREATE POLICY "Admins can view webhook errors" ON public.webhook_errors FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('owner', 'admin')));

DROP POLICY IF EXISTS "Service role can manage webhook errors" ON public.webhook_errors;
CREATE POLICY "Service role can manage webhook errors" ON public.webhook_errors FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =============================================================================
-- STEP 7: INSERT DEFAULT CONFIGURATIONS
-- =============================================================================

INSERT INTO public.fonnte_config (config_name, is_active, device_numbers, auto_reply_enabled, session_timeout_minutes)
VALUES ('default', true, '{}', true, 30)
ON CONFLICT (config_name) DO NOTHING;

-- =============================================================================
-- STEP 8: CREATE HELPFUL VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW public.active_conversations_summary AS
SELECT
  c.id,
  c.phone_number,
  c.sender_name,
  c.status,
  c.started_at,
  c.last_message_at,
  COUNT(m.id) as message_count,
  r.type as report_type,
  r.status as report_status
FROM public.conversations c
LEFT JOIN public.messages m ON m.conversation_id = c.id
LEFT JOIN public.reports r ON r.id = c.report_id
WHERE c.status = 'active'
GROUP BY c.id, r.type, r.status
ORDER BY c.last_message_at DESC;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================