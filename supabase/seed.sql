-- =============================================================================
-- LAPOR CITIZEN FEEDBACK — STAGING SEED DATA
-- =============================================================================
-- Purpose: Populate staging database with representative, anonymized test data
--          mirroring the production data structure (tenants, OPDs, reports,
--          configuration tables).
--
-- Usage:
--   Runs automatically on `supabase db reset` (local or branch).
--   Can be re-run safely — all inserts use ON CONFLICT DO NOTHING.
--
-- What is NOT seeded here:
--   - auth.users          → create test users manually in Supabase dashboard
--   - profiles            → see POST-SEED SETUP at bottom of this file
--   - user_roles          → see POST-SEED SETUP at bottom of this file
--   - conversations/messages → not needed for admin UI testing
--   - api_keys            → generate via the admin dashboard
--   - api_field_configs   → already seeded by migrations
--
-- ⚠️  All data is FAKE. No real PII, no real credentials, no real API keys.
-- =============================================================================


-- =============================================================================
-- TENANTS
-- =============================================================================

INSERT INTO tenants (
  id,
  name,
  slug,
  status,
  subscription_tier,
  contact_email,
  contact_phone,
  created_at,
  updated_at,
  metadata
) VALUES (
  '00000000-0000-0000-0001-000000000001',
  'Kota Uji Coba',
  'kota-uji-coba',
  'active',
  'enterprise',
  'admin@staging.lapor.test',
  '02100000000',
  NOW(),
  NOW(),
  '{"environment": "staging", "note": "Seed data — not real"}'
) ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- OPDs (Organisasi Perangkat Daerah)
-- =============================================================================
-- Mirrors the 4 OPDs present in production under the Default Organization tenant.

INSERT INTO opds (id, tenant_id, name, code, description, is_active, created_at, updated_at) VALUES
  (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000001',
    'Dinas Pendidikan',
    'DISDIK',
    'Dinas terkait pendidikan dan kebudayaan kota',
    true, NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0001-000000000001',
    'Dinas Lingkungan Hidup',
    'DISLHK',
    'Dinas lingkungan hidup dan tata kota',
    true, NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0002-000000000003',
    '00000000-0000-0000-0001-000000000001',
    'Dinas Pekerjaan Umum',
    'DISPU',
    'Menangani infrastruktur, jalan, dan drainase',
    true, NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0002-000000000004',
    '00000000-0000-0000-0001-000000000001',
    'Dinas Perumahan dan Kawasan Permukiman',
    'DPKP',
    'Dinas yang menangani perumahan dan pemukiman warga',
    true, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- REPORTS (LAPORAN)
-- =============================================================================
-- 20 laporan: ~12 pending, 5 in_progress, 2 resolved, 1 rejected
-- All names, phones, addresses are fictional.
-- Ticket IDs use STG- prefix to distinguish clearly from prod.

INSERT INTO reports (
  id, tenant_id, reporter_name, phone, address, description,
  type, status, ticket_id, assigned_opd_id, created_at, updated_at
) VALUES

  -- PENDING
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001',
   'Warga Test 01', '08100000001', 'Jl. Merdeka No. 1, Kota Uji Coba',
   'Jalan di depan rumah saya berlubang cukup dalam dan berbahaya bagi pengendara motor. Sudah terjadi beberapa kali kecelakaan kecil di sini. Mohon segera diperbaiki.',
   'lapor', 'pending', 'STG-00001', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001',
   'Warga Test 02', '08100000002', 'Jl. Pahlawan No. 5, Kota Uji Coba',
   'Lampu penerangan jalan di RT 03 RW 02 sudah mati selama 2 minggu. Warga sangat kesulitan beraktivitas di malam hari dan merasa tidak aman.',
   'lapor', 'pending', 'STG-00002', NULL,
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),

  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000001',
   'Warga Test 03', '08100000003', 'Jl. Sudirman No. 12, Kota Uji Coba',
   'Tumpukan sampah di pinggir jalan tidak diangkut selama 5 hari. Bau menyengat dan mengganggu kesehatan warga sekitar.',
   'lapor', 'pending', 'STG-00003', '00000000-0000-0000-0002-000000000002',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),

  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000001',
   'Warga Test 04', '08100000004', 'Jl. Diponegoro No. 8, Kota Uji Coba',
   'Saluran drainase di depan pasar tersumbat dan menyebabkan banjir kecil setiap kali hujan. Sudah berlangsung 3 bulan.',
   'lapor', 'pending', 'STG-00004', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),

  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0001-000000000001',
   'Warga Test 05', '08100000005', 'Jl. Ahmad Yani No. 22, Kota Uji Coba',
   'Pohon besar di pinggir jalan kondisinya miring dan hampir tumbang. Berpotensi menimpa kabel listrik dan kendaraan yang parkir.',
   'lapor', 'pending', 'STG-00005', '00000000-0000-0000-0002-000000000002',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),

  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0001-000000000001',
   'Warga Test 06', '08100000006', 'Jl. Gatot Subroto No. 3, Kota Uji Coba',
   'Trotoar di sepanjang jalan ini banyak yang rusak dan membahayakan pejalan kaki, terutama lansia dan anak-anak.',
   'lapor', 'pending', 'STG-00006', NULL,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

  ('00000000-0000-0000-0003-000000000007', '00000000-0000-0000-0001-000000000001',
   'Warga Test 07', '08100000007', 'Jl. Veteran No. 17, Kota Uji Coba',
   'Ada bangunan liar yang berdiri di atas saluran irigasi sehingga menghambat aliran air dan menyebabkan genangan di area persawahan.',
   'lapor', 'pending', 'STG-00007', '00000000-0000-0000-0002-000000000004',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

  ('00000000-0000-0000-0003-000000000008', '00000000-0000-0000-0001-000000000001',
   'Warga Test 08', '08100000008', 'Jl. Imam Bonjol No. 9, Kota Uji Coba',
   'Fasilitas bermain anak di taman kota sudah banyak yang rusak. Ayunan besinya berkarat dan beberapa papan perosotan sudah patah.',
   'lapor', 'pending', 'STG-00008', NULL,
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),

  ('00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0001-000000000001',
   'Warga Test 09', '08100000009', 'Jl. Wahidin No. 14, Kota Uji Coba',
   'Angkutan umum trayek A sudah tidak beroperasi 2 minggu. Warga yang tidak punya kendaraan pribadi sangat kesulitan mobilitas.',
   'lapor', 'pending', 'STG-00009', NULL,
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  ('00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0001-000000000001',
   'Warga Test 10', '08100000010', 'Jl. Kartini No. 6, Kota Uji Coba',
   'Kios PKL di depan sekolah berjualan makanan tidak higienis. Sudah beberapa anak dilaporkan sakit perut setelah jajan di situ.',
   'lapor', 'pending', 'STG-00010', '00000000-0000-0000-0002-000000000001',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  ('00000000-0000-0000-0003-000000000011', '00000000-0000-0000-0001-000000000001',
   'Warga Test 11', '08100000011', 'Jl. Cut Nyak Dien No. 30, Kota Uji Coba',
   'Rambu lalu lintas di persimpangan jalan besar sudah tidak terbaca karena catnya sudah pudar dan tiangnya berkarat parah.',
   'lapor', 'pending', 'STG-00011', NULL,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  ('00000000-0000-0000-0003-000000000012', '00000000-0000-0000-0001-000000000001',
   'Warga Test 12', '08100000012', 'Jl. Hasanuddin No. 45, Kota Uji Coba',
   'Gedung sekolah SD Negeri 01 atapnya bocor. Ketika hujan, air masuk ke ruang kelas dan mengganggu proses belajar mengajar.',
   'lapor', 'pending', 'STG-00012', '00000000-0000-0000-0002-000000000001',
   NOW(), NOW()),

  -- IN PROGRESS
  ('00000000-0000-0000-0003-000000000013', '00000000-0000-0000-0001-000000000001',
   'Warga Test 13', '08100000013', 'Jl. Sultan Agung No. 7, Kota Uji Coba',
   'Proyek pembangunan jalan di kawasan perumahan tidak dilengkapi pagar pengaman. Kendaraan dan pejalan kaki sering membahayakan diri.',
   'lapor', 'in_progress', 'STG-00013', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days'),

  ('00000000-0000-0000-0003-000000000014', '00000000-0000-0000-0001-000000000001',
   'Warga Test 14', '08100000014', 'Jl. Teuku Umar No. 19, Kota Uji Coba',
   'Tempat pembuangan sampah sementara (TPS) di kelurahan ini sudah melebihi kapasitas. Petugas kebersihan diharap meningkatkan frekuensi pengambilan.',
   'lapor', 'in_progress', 'STG-00014', '00000000-0000-0000-0002-000000000002',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '3 days'),

  ('00000000-0000-0000-0003-000000000015', '00000000-0000-0000-0001-000000000001',
   'Warga Test 15', '08100000015', 'Jl. Pangeran Antasari No. 2, Kota Uji Coba',
   'Pipa air PDAM di dekat pasar bocor dan menyebabkan genangan di badan jalan. Sudah dilaporkan ke PDAM tapi belum ada tindak lanjut.',
   'lapor', 'in_progress', 'STG-00015', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '2 days'),

  ('00000000-0000-0000-0003-000000000016', '00000000-0000-0000-0001-000000000001',
   'Warga Test 16', '08100000016', 'Jl. Rajawali No. 11, Kota Uji Coba',
   'Fasilitas posyandu di RW 05 tidak memiliki alat timbang bayi yang layak. Alat yang ada sudah rusak dan tidak akurat.',
   'lapor', 'in_progress', 'STG-00016', '00000000-0000-0000-0002-000000000001',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),

  ('00000000-0000-0000-0003-000000000017', '00000000-0000-0000-0001-000000000001',
   'Warga Test 17', '08100000017', 'Jl. Garuda No. 25, Kota Uji Coba',
   'Jembatan penghubung antar desa kondisinya sudah retak-retak dan lantai kayunya banyak yang lapuk. Sangat berbahaya untuk dilalui kendaraan bermuatan.',
   'lapor', 'in_progress', 'STG-00017', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'),

  -- RESOLVED
  ('00000000-0000-0000-0003-000000000018', '00000000-0000-0000-0001-000000000001',
   'Warga Test 18', '08100000018', 'Jl. Elang No. 4, Kota Uji Coba',
   'Lampu traffic light di persimpangan utama rusak selama 3 hari dan menyebabkan kemacetan parah serta beberapa insiden kecelakaan.',
   'lapor', 'resolved', 'STG-00018', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days'),

  ('00000000-0000-0000-0003-000000000019', '00000000-0000-0000-0001-000000000001',
   'Warga Test 19', '08100000019', 'Jl. Melati No. 33, Kota Uji Coba',
   'Selokan di sepanjang jalan tersumbat sampah dan mengeluarkan bau yang sangat tidak sedap. Warga sekitar terganggu.',
   'lapor', 'resolved', 'STG-00019', '00000000-0000-0000-0002-000000000002',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '15 days'),

  -- REJECTED
  ('00000000-0000-0000-0003-000000000020', '00000000-0000-0000-0001-000000000001',
   'Warga Test 20', '08100000020', 'Jl. Anggrek No. 18, Kota Uji Coba',
   'Mohon pemerintah segera membangun mall di dekat perumahan kami agar warga tidak jauh berbelanja. Saat ini jarak ke pusat perbelanjaan terdekat 15 km.',
   'lapor', 'rejected', 'STG-00020', NULL,
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days')

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- REPORTS (ASPIRASI)
-- =============================================================================

INSERT INTO reports (
  id, tenant_id, reporter_name, phone, address, description,
  type, status, ticket_id, assigned_opd_id, created_at, updated_at
) VALUES

  -- PENDING
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0001-000000000001',
   'Warga Test 21', '08100000021', 'Jl. Dahlia No. 10, Kota Uji Coba',
   'Saya berharap pemerintah dapat membangun ruang baca publik di setiap kelurahan agar minat baca masyarakat meningkat, terutama generasi muda.',
   'aspirasi', 'pending', 'STG-00021', '00000000-0000-0000-0002-000000000001',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),

  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0001-000000000001',
   'Warga Test 22', '08100000022', 'Jl. Mawar No. 7, Kota Uji Coba',
   'Saya mengusulkan agar pemerintah membuat program pelatihan wirausaha gratis bagi ibu rumah tangga dan pemuda putus sekolah.',
   'aspirasi', 'pending', 'STG-00022', NULL,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0001-000000000001',
   'Warga Test 23', '08100000023', 'Jl. Melur No. 3, Kota Uji Coba',
   'Mohon diadakan jalur sepeda yang aman di pusat kota agar warga bisa bersepeda ke kantor tanpa khawatir tertabrak kendaraan bermotor.',
   'aspirasi', 'pending', 'STG-00023', '00000000-0000-0000-0002-000000000003',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),

  ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0001-000000000001',
   'Warga Test 24', '08100000024', 'Jl. Kenanga No. 16, Kota Uji Coba',
   'Harap ditambah armada bus kota dengan jadwal yang lebih teratur. Saat ini warga sering menunggu lebih dari 1 jam.',
   'aspirasi', 'pending', 'STG-00024', NULL,
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  ('00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0001-000000000001',
   'Warga Test 25', '08100000025', 'Jl. Cempaka No. 21, Kota Uji Coba',
   'Mohon dibangun pusat daur ulang sampah di tiap kecamatan agar warga dapat lebih mudah berpartisipasi dalam program daur ulang.',
   'aspirasi', 'pending', 'STG-00025', '00000000-0000-0000-0002-000000000002',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  -- IN PROGRESS
  ('00000000-0000-0000-0004-000000000006', '00000000-0000-0000-0001-000000000001',
   'Warga Test 26', '08100000026', 'Jl. Flamboyan No. 9, Kota Uji Coba',
   'Usul agar pemerintah mengadakan festival budaya tahunan yang menampilkan kesenian lokal untuk melestarikan budaya daerah dan menarik wisatawan.',
   'aspirasi', 'in_progress', 'STG-00026', NULL,
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days'),

  ('00000000-0000-0000-0004-000000000007', '00000000-0000-0000-0001-000000000001',
   'Warga Test 27', '08100000027', 'Jl. Kamboja No. 13, Kota Uji Coba',
   'Mohon pemerintah membangun lebih banyak ruang terbuka hijau (RTH) di kawasan padat penduduk untuk mengurangi polusi dan menyediakan ruang rekreasi.',
   'aspirasi', 'in_progress', 'STG-00027', '00000000-0000-0000-0002-000000000002',
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days'),

  -- RESOLVED
  ('00000000-0000-0000-0004-000000000008', '00000000-0000-0000-0001-000000000001',
   'Warga Test 28', '08100000028', 'Jl. Bougenville No. 5, Kota Uji Coba',
   'Usulan penambahan fasilitas wifi gratis di taman-taman kota agar warga dapat memanfaatkan waktu luang untuk belajar dan bekerja.',
   'aspirasi', 'resolved', 'STG-00028', NULL,
   NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days'),

  -- REJECTED
  ('00000000-0000-0000-0004-000000000009', '00000000-0000-0000-0001-000000000001',
   'Warga Test 29', '08100000029', 'Jl. Anyelir No. 28, Kota Uji Coba',
   'Mohon pemerintah membangun gedung opera megah bertaraf internasional di kota kami untuk meningkatkan citra daerah di mata dunia.',
   'aspirasi', 'rejected', 'STG-00029', NULL,
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days')

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- REPORT DISPOSITIONS
-- =============================================================================
-- Sample disposition audit trail for in_progress and resolved reports.
-- assigned_by uses a DO block to avoid hardcoding a user UUID.

DO $$
DECLARE
  system_user_id UUID;
BEGIN
  -- Use the first user in auth.users as the "assigner" for seed dispositions.
  -- In a real staging environment, this will be the test admin user.
  SELECT id INTO system_user_id FROM auth.users LIMIT 1;

  IF system_user_id IS NULL THEN
    RAISE NOTICE 'No auth users found — skipping report_dispositions seed.';
    RETURN;
  END IF;

  INSERT INTO report_dispositions (
    id, report_id, opd_id, assigned_by, assigned_at,
    status_before, status_after, action_type, notes, tenant_id
  ) VALUES
    (
      '00000000-0000-0000-0005-000000000001',
      '00000000-0000-0000-0003-000000000013',
      '00000000-0000-0000-0002-000000000003',
      system_user_id,
      NOW() - INTERVAL '14 days',
      'pending', 'in_progress', 'disposition',
      'Diteruskan ke Dinas PU untuk penanganan pagar pengaman proyek.',
      '00000000-0000-0000-0001-000000000001'
    ),
    (
      '00000000-0000-0000-0005-000000000002',
      '00000000-0000-0000-0003-000000000014',
      '00000000-0000-0000-0002-000000000002',
      system_user_id,
      NOW() - INTERVAL '13 days',
      'pending', 'in_progress', 'disposition',
      'Disposisi ke Dinas Lingkungan untuk peningkatan frekuensi pengambilan sampah.',
      '00000000-0000-0000-0001-000000000001'
    ),
    (
      '00000000-0000-0000-0005-000000000003',
      '00000000-0000-0000-0003-000000000015',
      '00000000-0000-0000-0002-000000000003',
      system_user_id,
      NOW() - INTERVAL '11 days',
      'pending', 'in_progress', 'disposition',
      'Koordinasi dengan PDAM untuk perbaikan pipa bocor.',
      '00000000-0000-0000-0001-000000000001'
    ),
    (
      '00000000-0000-0000-0005-000000000004',
      '00000000-0000-0000-0003-000000000018',
      '00000000-0000-0000-0002-000000000003',
      system_user_id,
      NOW() - INTERVAL '29 days',
      'pending', 'in_progress', 'disposition',
      'Diteruskan ke Dishub untuk perbaikan traffic light.',
      '00000000-0000-0000-0001-000000000001'
    ),
    (
      '00000000-0000-0000-0005-000000000005',
      '00000000-0000-0000-0003-000000000018',
      '00000000-0000-0000-0002-000000000003',
      system_user_id,
      NOW() - INTERVAL '21 days',
      'in_progress', 'resolved', 'status_change',
      'Traffic light telah diperbaiki dan berfungsi normal kembali.',
      '00000000-0000-0000-0001-000000000001'
    ),
    (
      '00000000-0000-0000-0005-000000000006',
      '00000000-0000-0000-0003-000000000019',
      '00000000-0000-0000-0002-000000000002',
      system_user_id,
      NOW() - INTERVAL '24 days',
      'pending', 'in_progress', 'disposition',
      'Tim kebersihan dijadwalkan untuk pembersihan selokan.',
      '00000000-0000-0000-0001-000000000001'
    ),
    (
      '00000000-0000-0000-0005-000000000007',
      '00000000-0000-0000-0003-000000000019',
      '00000000-0000-0000-0002-000000000002',
      system_user_id,
      NOW() - INTERVAL '16 days',
      'in_progress', 'resolved', 'status_change',
      'Selokan telah dibersihkan dan aliran air kembali lancar.',
      '00000000-0000-0000-0001-000000000001'
    )
  ON CONFLICT (id) DO NOTHING;

END $$;


-- =============================================================================
-- REPORT AI INSIGHTS
-- =============================================================================
-- Sample AI insights for a few resolved/in_progress reports.

INSERT INTO report_ai_insights (
  id, report_id, summary_analysis, key_insights, recommended_actions,
  model_used, urgency, urgency_reason, sentiment, sentiment_reason,
  suggested_opd_id, suggested_opd_confidence, suggested_opd_name,
  created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0006-000000000001',
    '00000000-0000-0000-0003-000000000001',
    'Laporan ini mengenai kerusakan jalan yang berlubang di area perumahan. Kondisi ini membahayakan pengendara dan telah menyebabkan beberapa kecelakaan kecil. Penanganan segera diperlukan untuk mencegah insiden lebih lanjut.',
    '["Kerusakan jalan berdampak langsung pada keselamatan lalu lintas", "Sudah ada laporan kecelakaan kecil yang terjadi", "Lokasi padat lalu lintas membutuhkan prioritas perbaikan tinggi"]',
    '["Lakukan survei lapangan dalam 1x24 jam", "Pasang rambu peringatan sementara sambil menunggu perbaikan", "Jadwalkan perbaikan permanen dalam 2 minggu"]',
    'google/gemini-2.5-flash',
    'critical',
    'Sudah terjadi kecelakaan dan berpotensi menimbulkan korban lebih serius jika tidak segera ditangani.',
    'negative',
    'Nada laporan menunjukkan kekecewaan dan kekhawatiran yang tinggi dari pelapor.',
    '00000000-0000-0000-0002-000000000003',
    'high',
    'Dinas Pekerjaan Umum',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '00000000-0000-0000-0006-000000000002',
    '00000000-0000-0000-0003-000000000003',
    'Laporan tentang penumpukan sampah yang tidak diangkut selama 5 hari. Masalah ini berdampak pada kesehatan dan kenyamanan warga sekitar dan memerlukan tindakan segera dari Dinas Lingkungan.',
    '["Penumpukan sampah selama 5 hari melampaui batas toleransi kebersihan", "Bau menyengat mengindikasikan sampah organik yang membusuk", "Berisiko menjadi sarang penyakit (DBD, diare)"]',
    '["Kerahkan petugas kebersihan hari ini juga", "Tingkatkan frekuensi pengambilan sampah di wilayah ini", "Evaluasi kapasitas TPS terdekat"]',
    'google/gemini-2.5-flash',
    'moderate',
    'Berdampak pada kesehatan masyarakat dan kenyamanan lingkungan publik.',
    'negative',
    'Pelapor mengekspresikan gangguan dan ketidaknyamanan yang jelas.',
    '00000000-0000-0000-0002-000000000002',
    'high',
    'Dinas Lingkungan Hidup',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    '00000000-0000-0000-0006-000000000003',
    '00000000-0000-0000-0004-000000000001',
    'Aspirasi membangun ruang baca publik di setiap kelurahan merupakan inisiatif yang sangat positif untuk meningkatkan literasi masyarakat. Ini sejalan dengan program pemerintah dalam mencerdaskan kehidupan bangsa.',
    '["Program ruang baca publik memiliki dampak jangka panjang yang signifikan", "Investasi rendah dengan manfaat sosial tinggi", "Dapat diintegrasikan dengan program perpustakaan keliling yang ada"]',
    '["Lakukan studi kelayakan di 3 kelurahan percontohan", "Libatkan komunitas dalam pengelolaan ruang baca", "Kembangkan program donasi buku dari masyarakat"]',
    'google/gemini-2.5-flash',
    'minor',
    'Aspirasi pembangunan sosial jangka panjang tanpa urgensi mendesak.',
    'positive',
    'Pelapor menunjukkan kepedulian dan semangat membangun yang konstruktif.',
    '00000000-0000-0000-0002-000000000001',
    'high',
    'Dinas Pendidikan',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- CONFIGURATION TABLES
-- =============================================================================
-- All sensitive values are placeholders. Update these manually on staging
-- with real credentials after seeding.

-- Flowise AI Config
INSERT INTO flowise_config (
  id, tenant_id, config_name, is_active,
  api_url, api_key, chatflow_id,
  streaming, timeout_seconds,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0007-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'default',
  false,  -- disabled by default on staging; enable after filling real credentials
  'https://your-flowise-staging-url.example.com',
  'REPLACE_WITH_FLOWISE_API_KEY',
  'REPLACE_WITH_CHATFLOW_ID',
  false,
  30,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Fonnte WhatsApp Config
INSERT INTO fonnte_config (
  id, tenant_id, config_name, is_active,
  device_numbers, auto_reply_enabled, session_timeout_minutes,
  api_token, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0007-000000000002',
  '00000000-0000-0000-0001-000000000001',
  'default',
  false,  -- disabled by default on staging
  '{}',
  true,
  30,
  'REPLACE_WITH_FONNTE_API_TOKEN',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- AI Assistant Config
INSERT INTO ai_assistant_config (
  id, tenant_id, config_name, is_ai_enabled,
  preset_reply_text, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0007-000000000003',
  '00000000-0000-0000-0001-000000000001',
  'default',
  false,  -- AI disabled by default on staging; enable after Flowise config is set
  'Terima kasih telah menghubungi kami. Saat ini layanan AI asisten sedang tidak aktif untuk lingkungan staging. Silakan hubungi admin.',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- WhatsApp Provider Config
INSERT INTO whatsapp_provider_config (
  id, tenant_id, config_name, provider, is_active,
  notes, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0007-000000000004',
  '00000000-0000-0000-0001-000000000001',
  'default',
  'fonnte',
  false,  -- disabled by default on staging
  'Staging environment — configure Fonnte token before enabling.',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Login Config
INSERT INTO login_config (
  id, login_title, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0007-000000000005',
  'Portal Lapor [STAGING]',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- POST-SEED SETUP: Link your existing staging user to the test tenant
-- =============================================================================
-- After running this seed, execute the following SQL in the Supabase SQL editor
-- on the STAGING project (cxauavfcyfscjnatxino) to link your test account.
--
-- Replace 'your-email@example.com' with the email you used to register on staging.
--
--   DO $$
--   DECLARE
--     my_user_id UUID;
--   BEGIN
--     SELECT id INTO my_user_id FROM auth.users WHERE email = 'your-email@example.com';
--
--     IF my_user_id IS NULL THEN
--       RAISE EXCEPTION 'User not found. Check the email address.';
--     END IF;
--
--     -- Link profile to test tenant
--     UPDATE profiles
--       SET tenant_id = '00000000-0000-0000-0001-000000000001'
--     WHERE id = my_user_id;
--
--     -- Assign superadmin role
--     INSERT INTO user_roles (user_id, role)
--       VALUES (my_user_id, 'superadmin')
--     ON CONFLICT DO NOTHING;
--
--     RAISE NOTICE 'Done! User % linked to staging tenant as superadmin.', my_user_id;
--   END $$;
--
-- After running the above, log in to the staging admin dashboard and you should
-- see all the seeded tenants, OPDs, and reports.
-- =============================================================================
