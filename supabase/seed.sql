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


-- =============================================================================
-- CONVERSATIONS
-- =============================================================================
-- 8 conversations across all statuses: 4 completed, 2 active, 2 abandoned.
-- Completed ones are linked to existing seeded reports.
-- device_number '628000000000' = fake government WhatsApp device.
-- UUID namespace 0009 reserved for conversations.

INSERT INTO conversations (
  id, session_id, phone_number, sender_name, status, channel,
  device_number, last_message_at, started_at, completed_at,
  report_id, tenant_id, created_at, updated_at
) VALUES

  -- 1. Completed → linked to STG-00001 (jalan berlubang, Warga Test 01)
  (
    '00000000-0000-0000-0009-000000000001',
    'flowise_stg_conv_001',
    '628100000001',
    'Warga Test 01',
    'completed',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '10 days' + INTERVAL '9 minutes',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days' + INTERVAL '9 minutes',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days' + INTERVAL '9 minutes'
  ),

  -- 2. Completed → linked to STG-00003 (sampah, Warga Test 03)
  (
    '00000000-0000-0000-0009-000000000002',
    'flowise_stg_conv_002',
    '628100000003',
    'Warga Test 03',
    'completed',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '8 days' + INTERVAL '7 minutes',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days' + INTERVAL '7 minutes',
    '00000000-0000-0000-0003-000000000003',
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days' + INTERVAL '7 minutes'
  ),

  -- 3. Completed → linked to STG-00005 (pohon miring, Warga Test 05), longer flow
  (
    '00000000-0000-0000-0009-000000000003',
    'flowise_stg_conv_003',
    '628100000005',
    'Warga Test 05',
    'completed',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '6 days' + INTERVAL '14 minutes',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days' + INTERVAL '14 minutes',
    '00000000-0000-0000-0003-000000000005',
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days' + INTERVAL '14 minutes'
  ),

  -- 4. Completed → linked to STG-00021 (aspirasi ruang baca, Warga Test 21)
  (
    '00000000-0000-0000-0009-000000000004',
    'flowise_stg_conv_004',
    '628100000021',
    'Warga Test 21',
    'completed',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '6 days' + INTERVAL '5 minutes',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days' + INTERVAL '5 minutes',
    '00000000-0000-0000-0004-000000000001',
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days' + INTERVAL '5 minutes'
  ),

  -- 5. Active → citizen mid-flow, no report yet
  (
    '00000000-0000-0000-0009-000000000005',
    'flowise_stg_conv_005',
    '628100000030',
    'Warga Test 30',
    'active',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '1 hour',
    NULL,
    NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '45 minutes'
  ),

  -- 6. Active → citizen sent a photo (has_attachment), no report yet
  (
    '00000000-0000-0000-0009-000000000006',
    'flowise_stg_conv_006',
    '628100000031',
    'Warga Test 31',
    'active',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '2 hours',
    NULL,
    NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '20 minutes'
  ),

  -- 7. Abandoned → user dropped off mid-conversation
  (
    '00000000-0000-0000-0009-000000000007',
    'flowise_stg_conv_007',
    '628100000032',
    'Warga Test 32',
    'abandoned',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '4 days' + INTERVAL '3 minutes',
    NOW() - INTERVAL '4 days',
    NULL,
    NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days' + INTERVAL '3 minutes'
  ),

  -- 8. Abandoned → quick bounce (1 message, never replied)
  (
    '00000000-0000-0000-0009-000000000008',
    'flowise_stg_conv_008',
    '628100000033',
    NULL,
    'abandoned',
    'whatsapp',
    '628000000000',
    NOW() - INTERVAL '3 days' + INTERVAL '30 seconds',
    NOW() - INTERVAL '3 days',
    NULL,
    NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '30 seconds'
  )

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- MESSAGES
-- =============================================================================
-- ~40 messages across 8 conversations.
-- UUID namespace 000a (hex 10) for messages.
-- message_index is 0-based per conversation.
-- agent_flow_data on assistant messages exercises AIThinkingCollapsible component.

INSERT INTO messages (
  id, conversation_id, role, content, message_index,
  has_attachment, agent_flow_data, tenant_id, created_at
) VALUES

  -- -----------------------------------------------------------------------
  -- Conversation 1: jalan berlubang (6 messages)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0001-000000000001',
    '00000000-0000-0000-0009-000000000001',
    'user',
    'halo, mau lapor ada jalan berlubang di depan rumah saya',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days'
  ),
  (
    '00000000-0000-000a-0001-000000000002',
    '00000000-0000-0000-0009-000000000001',
    'assistant',
    'Halo! Terima kasih sudah menghubungi Lapor Kota Uji Coba 😊 Saya siap membantu Anda membuat laporan. Boleh saya tahu lokasi jalan yang berlubang tersebut?',
    1, false,
    '[{"nodeId":"greeting_node","nodeLabel":"Sapa Warga","output":"Meminta detail lokasi kejadian"},{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi Niat","output":"Niat terdeteksi: membuat laporan kerusakan infrastruktur"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days' + INTERVAL '20 seconds'
  ),
  (
    '00000000-0000-000a-0001-000000000003',
    '00000000-0000-0000-0009-000000000001',
    'user',
    'di Jl. Merdeka No. 1, depan rumah saya. lubangnya cukup dalam, berbahaya buat motor',
    2, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days' + INTERVAL '2 minutes'
  ),
  (
    '00000000-0000-000a-0001-000000000004',
    '00000000-0000-0000-0009-000000000001',
    'assistant',
    'Baik, saya catat lokasinya di Jl. Merdeka No. 1. Sudah berapa lama lubang tersebut ada? Dan apakah sudah pernah ada kejadian kecelakaan di sana?',
    3, false,
    '[{"nodeId":"info_extractor","nodeLabel":"Ekstrak Informasi","output":"Lokasi: Jl. Merdeka No. 1 — terdeteksi sebagai kerusakan jalan"},{"nodeId":"clarification_agent","nodeLabel":"Klarifikasi","output":"Meminta informasi tambahan: durasi dan riwayat kecelakaan"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days' + INTERVAL '2 minutes' + INTERVAL '15 seconds'
  ),
  (
    '00000000-0000-000a-0001-000000000005',
    '00000000-0000-0000-0009-000000000001',
    'user',
    'udah lama banget, kayaknya 2 minggu lebih. udah ada beberapa kali kecelakaan kecil di sini. minta tolong segera diperbaiki',
    4, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days' + INTERVAL '5 minutes'
  ),
  (
    '00000000-0000-000a-0001-000000000006',
    '00000000-0000-0000-0009-000000000001',
    'assistant',
    'Laporan Anda telah berhasil kami terima dan dicatat dengan nomor tiket *STG-00001*. Tim Dinas Pekerjaan Umum akan segera menindaklanjuti laporan ini. Anda bisa melacak status laporan kapan saja melalui menu lacak di aplikasi ini. Terima kasih atas partisipasi Anda menjaga keselamatan warga kota! 🙏',
    5, false,
    '[{"nodeId":"report_creator","nodeLabel":"Buat Laporan","output":"Laporan berhasil dibuat: ID 00000000-0000-0000-0003-000000000001, Tiket STG-00001"},{"nodeId":"opd_router","nodeLabel":"Routing OPD","output":"Diteruskan ke Dinas Pekerjaan Umum (DISPU) berdasarkan kategori infrastruktur jalan"},{"nodeId":"notification_sender","nodeLabel":"Kirim Notifikasi","output":"Notifikasi berhasil dikirim ke admin"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '10 days' + INTERVAL '5 minutes' + INTERVAL '20 seconds'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 2: sampah (5 messages)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0002-000000000001',
    '00000000-0000-0000-0009-000000000002',
    'user',
    'permisi, mau lapor sampah di pinggir jalan tidak diangkut sudah 5 hari',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '8 days'
  ),
  (
    '00000000-0000-000a-0002-000000000002',
    '00000000-0000-0000-0009-000000000002',
    'assistant',
    'Selamat datang di layanan Lapor Kota Uji Coba 🌿 Kami turut prihatin dengan kondisi tersebut. Boleh saya tahu lokasinya di mana? Dan apakah sampahnya mengeluarkan bau atau sudah mengganggu warga sekitar?',
    1, false,
    '[{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi Niat","output":"Niat: laporan kebersihan/sampah"},{"nodeId":"empathy_node","nodeLabel":"Respons Empatik","output":"Memberikan respons empatik sambil mengumpulkan informasi"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '8 days' + INTERVAL '18 seconds'
  ),
  (
    '00000000-0000-000a-0002-000000000003',
    '00000000-0000-0000-0009-000000000002',
    'user',
    'di Jl. Sudirman No. 12. baunya menyengat sekali, ganggu warga sekitar',
    2, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '8 days' + INTERVAL '3 minutes'
  ),
  (
    '00000000-0000-000a-0002-000000000004',
    '00000000-0000-0000-0009-000000000002',
    'assistant',
    'Terima kasih informasinya. Sampah organik yang menumpuk 5 hari berpotensi menjadi sumber penyakit. Saya akan segera membuat laporan ini sebagai prioritas. Mohon konfirmasi: apakah Anda warga di sekitar Jl. Sudirman No. 12?',
    3, false,
    '[{"nodeId":"risk_assessor","nodeLabel":"Penilaian Risiko","output":"Risiko: sedang-tinggi — bau menyengat menandakan pembusukan organik, potensi sarang penyakit"},{"nodeId":"urgency_classifier","nodeLabel":"Klasifikasi Urgensi","output":"Urgensi: moderate — perlu tindakan dalam 1x24 jam"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '8 days' + INTERVAL '3 minutes' + INTERVAL '12 seconds'
  ),
  (
    '00000000-0000-000a-0002-000000000005',
    '00000000-0000-0000-0009-000000000002',
    'assistant',
    'Laporan kebersihan Anda telah berhasil dibuat dengan nomor tiket *STG-00003*. Dinas Lingkungan Hidup akan menindaklanjuti dalam waktu dekat. Terima kasih sudah peduli terhadap kebersihan lingkungan! ♻️',
    4, false,
    '[{"nodeId":"report_creator","nodeLabel":"Buat Laporan","output":"Laporan kebersihan berhasil dibuat: Tiket STG-00003"},{"nodeId":"opd_router","nodeLabel":"Routing OPD","output":"Diteruskan ke Dinas Lingkungan Hidup (DISLHK)"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '8 days' + INTERVAL '6 minutes' + INTERVAL '30 seconds'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 3: pohon miring (8 messages, longer back-and-forth)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0003-000000000001',
    '00000000-0000-0000-0009-000000000003',
    'user',
    'halo ada pohon besar di depan rumah saya hampir tumbang, miring ke arah kabel listrik',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days'
  ),
  (
    '00000000-0000-000a-0003-000000000002',
    '00000000-0000-0000-0009-000000000003',
    'assistant',
    'Ini situasi yang perlu segera ditangani! ⚠️ Pohon miring ke arah kabel listrik bisa sangat berbahaya. Boleh saya tahu lokasinya di mana?',
    1, false,
    '[{"nodeId":"urgency_detector","nodeLabel":"Deteksi Urgensi","output":"URGENSI TINGGI — pohon hampir tumbang menimpa infrastruktur listrik, risiko kebakaran dan kecelakaan"},{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi","output":"Kategori: kedaruratan infrastruktur/lingkungan"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '15 seconds'
  ),
  (
    '00000000-0000-000a-0003-000000000003',
    '00000000-0000-0000-0009-000000000003',
    'user',
    'Jl. Ahmad Yani No. 22. pohonnya sudah miring sekitar 30 derajat',
    2, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '2 minutes'
  ),
  (
    '00000000-0000-000a-0003-000000000004',
    '00000000-0000-0000-0009-000000000003',
    'assistant',
    'Baik, Jl. Ahmad Yani No. 22. Apakah pohon tersebut pohon milik pemerintah (di trotoar/bahu jalan) atau pohon di dalam pekarangan pribadi?',
    3, false,
    '[{"nodeId":"ownership_classifier","nodeLabel":"Cek Kepemilikan","output":"Perlu klarifikasi kepemilikan pohon untuk menentukan instansi yang berwenang menangani"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '2 minutes' + INTERVAL '10 seconds'
  ),
  (
    '00000000-0000-000a-0003-000000000005',
    '00000000-0000-0000-0009-000000000003',
    'user',
    'pohon di pinggir jalan, bukan punya saya. sudah ada di sana puluhan tahun',
    4, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '4 minutes'
  ),
  (
    '00000000-0000-000a-0003-000000000006',
    '00000000-0000-0000-0009-000000000003',
    'assistant',
    'Berarti pohon aset pemerintah di ruang publik. Ini wewenang Dinas Lingkungan Hidup. Apakah ada kendaraan yang biasa parkir di bawah pohon tersebut? Dan apakah sudah ada tanda-tanda dahan patah?',
    5, false,
    '[{"nodeId":"ownership_confirmed","nodeLabel":"Kepemilikan Terkonfirmasi","output":"Pohon aset pemda — wewenang Dinas Lingkungan Hidup"},{"nodeId":"risk_detail_collector","nodeLabel":"Kumpulkan Detail Risiko","output":"Mengumpulkan detail risiko tambahan untuk penilaian urgensi yang lebih akurat"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '4 minutes' + INTERVAL '12 seconds'
  ),
  (
    '00000000-0000-000a-0003-000000000007',
    '00000000-0000-0000-0009-000000000003',
    'user',
    'iya banyak motor parkir di situ. dahan kecilnya sudah mulai ada yang jatuh tadi pagi',
    6, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '7 minutes'
  ),
  (
    '00000000-0000-000a-0003-000000000008',
    '00000000-0000-0000-0009-000000000003',
    'assistant',
    'Laporan darurat Anda telah dibuat dengan nomor tiket *STG-00005* dan ditandai sebagai *PRIORITAS TINGGI*. Dinas Lingkungan Hidup akan mengirimkan tim survei dalam waktu 1x24 jam. Sementara menunggu, mohon informasikan kepada warga sekitar untuk tidak parkir di bawah pohon tersebut demi keselamatan. Terima kasih sudah sigap melapor! 🌳🙏',
    7, false,
    '[{"nodeId":"risk_assessor","nodeLabel":"Penilaian Akhir","output":"Risiko KRITIS — dahan sudah mulai jatuh, kendaraan di bawah pohon, berbatasan dengan kabel PLN"},{"nodeId":"report_creator","nodeLabel":"Buat Laporan","output":"Laporan darurat berhasil dibuat: Tiket STG-00005, prioritas tinggi"},{"nodeId":"opd_router","nodeLabel":"Routing OPD","output":"Diteruskan ke Dinas Lingkungan Hidup dengan flag URGENT"},{"nodeId":"safety_advisor","nodeLabel":"Saran Keamanan","output":"Memberikan saran keselamatan sementara kepada pelapor"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '7 minutes' + INTERVAL '18 seconds'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 4: aspirasi ruang baca (4 messages)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0004-000000000001',
    '00000000-0000-0000-0009-000000000004',
    'user',
    'saya ingin menyampaikan aspirasi, saya berharap ada ruang baca publik di kelurahan',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days'
  ),
  (
    '00000000-0000-000a-0004-000000000002',
    '00000000-0000-0000-0009-000000000004',
    'assistant',
    'Ide yang sangat bagus! 📚 Ruang baca publik bisa meningkatkan literasi dan menjadi pusat komunitas. Boleh saya tahu kelurahan atau area yang Anda maksud? Dan apakah ada preferensi khusus untuk lokasinya?',
    1, false,
    '[{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi Niat","output":"Niat: aspirasi/usulan pembangunan fasilitas publik — bukan laporan masalah"},{"nodeId":"aspiration_handler","nodeLabel":"Handler Aspirasi","output":"Mengumpulkan detail aspirasi untuk pencatatan"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '22 seconds'
  ),
  (
    '00000000-0000-000a-0004-000000000003',
    '00000000-0000-0000-0009-000000000004',
    'user',
    'di semua kelurahan kalau bisa. yang penting ada buku-buku dan tempat belajar untuk anak-anak dan remaja. sekarang anak-anak lebih banyak main HP daripada baca buku',
    2, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '3 minutes'
  ),
  (
    '00000000-0000-000a-0004-000000000004',
    '00000000-0000-0000-0009-000000000004',
    'assistant',
    'Aspirasi Anda telah berhasil dicatat dengan nomor tiket *STG-00021*. Usulan pembangunan ruang baca publik di setiap kelurahan akan diteruskan ke Dinas Pendidikan untuk dikaji lebih lanjut. Terima kasih atas kepedulian Anda terhadap pendidikan dan literasi generasi muda Kota Uji Coba! 📖✨',
    3, false,
    '[{"nodeId":"report_creator","nodeLabel":"Buat Aspirasi","output":"Aspirasi berhasil dicatat: Tiket STG-00021, kategori pendidikan/fasilitas publik"},{"nodeId":"opd_router","nodeLabel":"Routing OPD","output":"Diteruskan ke Dinas Pendidikan (DISDIK)"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '6 days' + INTERVAL '3 minutes' + INTERVAL '16 seconds'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 5: active — citizen mid-flow (3 messages)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0005-000000000001',
    '00000000-0000-0000-0009-000000000005',
    'user',
    'halo, mau lapor ada genangan air di depan gang saya setiap kali hujan',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '00000000-0000-000a-0005-000000000002',
    '00000000-0000-0000-0009-000000000005',
    'assistant',
    'Halo! Terima kasih sudah menghubungi kami 🌧️ Genangan air bisa jadi tanda saluran drainase tersumbat. Bisa tolong sebutkan alamat lengkap lokasi genangannya?',
    1, false,
    '[{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi Niat","output":"Niat: laporan banjir/genangan air — kemungkinan terkait drainase"},{"nodeId":"info_collector","nodeLabel":"Kumpulkan Info","output":"Meminta lokasi spesifik"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '1 hour' + INTERVAL '18 seconds'
  ),
  (
    '00000000-0000-000a-0005-000000000003',
    '00000000-0000-0000-0009-000000000005',
    'user',
    'di Gang Mawar RT 04 RW 02, Kel. Merdeka. genangannya lumayan dalam, sekitar 30cm pas hujan deras',
    2, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '45 minutes'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 6: active — with attachment photo (4 messages)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0006-000000000001',
    '00000000-0000-0000-0009-000000000006',
    'user',
    'selamat siang, mau lapor kondisi jembatan yang retak-retak',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '2 hours'
  ),
  (
    '00000000-0000-000a-0006-000000000002',
    '00000000-0000-0000-0009-000000000006',
    'assistant',
    'Selamat siang! Jembatan retak-retak perlu segera dicek kondisinya. Boleh saya tahu lokasi jembatan tersebut? Dan jika memungkinkan, tolong kirimkan foto kondisi jembatannya ya 📸',
    1, false,
    '[{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi Niat","output":"Niat: laporan kerusakan infrastruktur — jembatan"},{"nodeId":"photo_request","nodeLabel":"Minta Foto","output":"Meminta dokumentasi foto untuk mendukung laporan"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '2 hours' + INTERVAL '15 seconds'
  ),
  (
    '00000000-0000-000a-0006-000000000003',
    '00000000-0000-0000-0009-000000000006',
    'user',
    '[Foto kondisi jembatan retak]',
    2, true, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '1 hour' + INTERVAL '40 minutes'
  ),
  (
    '00000000-0000-000a-0006-000000000004',
    '00000000-0000-0000-0009-000000000006',
    'assistant',
    'Terima kasih fotonya! Dari gambar terlihat retakan cukup signifikan di bagian beton jembatan. Ini perlu segera dilaporkan ke Dinas PU. Boleh konfirmasi lokasinya di mana ya? Dan apakah jembatan ini masih digunakan kendaraan berat?',
    3, false,
    '[{"nodeId":"image_analyzer","nodeLabel":"Analisis Gambar","output":"Gambar diproses — terdeteksi keretakan beton pada struktur jembatan, estimasi severity: sedang-tinggi"},{"nodeId":"follow_up_questions","nodeLabel":"Pertanyaan Lanjutan","output":"Meminta konfirmasi lokasi dan penggunaan jembatan untuk penilaian risiko"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '20 minutes'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 7: abandoned — user dropped off (3 messages)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0007-000000000001',
    '00000000-0000-0000-0009-000000000007',
    'user',
    'halo mau tanya cara melaporkan',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '4 days'
  ),
  (
    '00000000-0000-000a-0007-000000000002',
    '00000000-0000-0000-0009-000000000007',
    'assistant',
    'Halo! Tentu saya bantu 😊 Untuk membuat laporan, cukup ceritakan masalah yang ingin Anda laporkan ke saya di sini. Misalnya: "Mau lapor jalan rusak di Jl. Merdeka" atau "Mau laporkan sampah yang tidak diangkut". Apa yang ingin Anda laporkan hari ini?',
    1, false,
    '[{"nodeId":"intent_classifier","nodeLabel":"Klasifikasi Niat","output":"Niat: pertanyaan tentang cara melapor — bukan laporan langsung"},{"nodeId":"onboarding_guide","nodeLabel":"Panduan Onboarding","output":"Memberikan panduan cara membuat laporan"}]'::jsonb,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '4 days' + INTERVAL '12 seconds'
  ),
  (
    '00000000-0000-000a-0007-000000000003',
    '00000000-0000-0000-0009-000000000007',
    'user',
    'oh gitu ya, nanti saya coba',
    2, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '4 days' + INTERVAL '3 minutes'
  ),

  -- -----------------------------------------------------------------------
  -- Conversation 8: abandoned — quick bounce (1 message)
  -- -----------------------------------------------------------------------
  (
    '00000000-0000-000a-0008-000000000001',
    '00000000-0000-0000-0009-000000000008',
    'user',
    'halo',
    0, false, NULL,
    '00000000-0000-0000-0001-000000000001',
    NOW() - INTERVAL '3 days'
  )

ON CONFLICT (id) DO NOTHING;
