-- =============================================================================
-- Seed: Demo Active Conversation for Human Takeover Testing
-- Run this in the Supabase Dashboard → SQL Editor (staging project)
-- URL: https://supabase.com/dashboard/project/cxauavfcyfscjnatxino/sql
--
-- Scenario: "Budi Santoso" reports a dangerous pothole on a school road.
-- Covers: 8-message thread, photo attachment, status=active, is_human_handled=false
-- =============================================================================

DO $$
DECLARE
  conv_id     UUID;
  msg7_id     UUID;
  v_tenant_id UUID;
BEGIN

  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM public.conversations WHERE session_id = 'demo-seed-jalan-berlubang-001') THEN
    RAISE NOTICE 'Demo conversation already seeded — skipping.';
    RETURN;
  END IF;

  -- Get the first available tenant
  SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found — cannot seed. Check that the tenants table has at least one row.';
  END IF;

  RAISE NOTICE 'Using tenant_id: %', v_tenant_id;

  -- 1. Insert conversation (status=active, is_human_handled=false)
  INSERT INTO public.conversations (
    session_id,
    phone_number,
    sender_name,
    status,
    channel,
    device_number,
    last_message_at,
    started_at,
    tenant_id,
    is_human_handled
  ) VALUES (
    'demo-seed-jalan-berlubang-001',
    '6281234567890',
    'Budi Santoso',
    'active',
    'whatsapp',
    '6281111111111',
    NOW() - INTERVAL '5 minutes',
    NOW() - INTERVAL '25 minutes',
    v_tenant_id,
    false
  )
  RETURNING id INTO conv_id;

  -- 2. Insert 8-message thread (citizen ↔ AI exchange)
  INSERT INTO public.messages
    (conversation_id, role, content, message_index, has_attachment, sent_by_human, tenant_id)
  VALUES
    (conv_id, 'user',
     'halo, saya mau lapor ada jalan berlubang besar banget di depan sekolah anak saya',
     0, false, false, v_tenant_id),

    (conv_id, 'assistant',
     'Halo! Terima kasih telah menghubungi layanan pengaduan kami 🙏 Saya siap membantu Bapak/Ibu. Bisakah Anda memberitahu lokasi tepatnya jalan berlubang tersebut?',
     1, false, false, v_tenant_id),

    (conv_id, 'user',
     'di Jl. KH. Ahmad Dahlan No. 15, Kelurahan Petogogan, Kebayoran Baru, Jakarta Selatan. Depan SDN Petogogan 01',
     2, false, false, v_tenant_id),

    (conv_id, 'assistant',
     'Baik, terima kasih informasi lokasinya. Boleh saya tahu nama lengkap Bapak/Ibu dan nomor HP yang bisa dihubungi?',
     3, false, false, v_tenant_id),

    (conv_id, 'user',
     'nama saya Budi Santoso, nomor HP 0812-3456-7890',
     4, false, false, v_tenant_id),

    (conv_id, 'assistant',
     'Terima kasih, Pak Budi 🙏 Bisa diceritakan lebih detail kondisi jalan berlubangnya? Misalnya ukuran, sudah berapa lama, apakah sudah ada kejadian kecelakaan?',
     5, false, false, v_tenant_id),

    (conv_id, 'user',
     'lubangnya besar banget, kira-kira 1 meter lebarnya dan dalam sekitar 20 cm. sudah ada 3 minggu tidak diperbaiki. kemarin ada ibu-ibu jatuh dari motor karena menghindari lubang itu. sangat berbahaya apalagi banyak anak sekolah yang lewat setiap hari pagi dan sore',
     6, false, false, v_tenant_id),

    (conv_id, 'user',
     'ini foto kondisi jalannya',
     7, true, false, v_tenant_id);

  -- 3. Get id of the photo message
  SELECT id INTO msg7_id
  FROM public.messages
  WHERE conversation_id = conv_id AND message_index = 7;

  -- 4. Insert photo attachment (original_url required by schema)
  INSERT INTO public.attachments (
    message_id,
    original_url,
    filename,
    extension,
    mime_type,
    storage_url,
    storage_path,
    download_status,
    upload_status
  ) VALUES (
    msg7_id,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Road_pothole.jpg/640px-Road_pothole.jpg',
    'foto-jalan-berlubang.jpg',
    'jpg',
    'image/jpeg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Road_pothole.jpg/640px-Road_pothole.jpg',
    'external/demo-pothole.jpg',
    'completed',
    'completed'
  );

  RAISE NOTICE 'Done! conversation_id=%, tenant_id=%', conv_id, v_tenant_id;

END $$;

-- Verify: run this SELECT after the DO block succeeds
SELECT
  c.id,
  c.session_id,
  c.sender_name,
  c.phone_number,
  c.status,
  c.is_human_handled,
  c.tenant_id,
  COUNT(m.id) AS message_count
FROM public.conversations c
LEFT JOIN public.messages m ON m.conversation_id = c.id
WHERE c.session_id = 'demo-seed-jalan-berlubang-001'
GROUP BY c.id, c.session_id, c.sender_name, c.phone_number, c.status, c.is_human_handled, c.tenant_id;