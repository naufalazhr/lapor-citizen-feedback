import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReportData {
  id: string
  ticket_id: string
  reporter_name: string
  phone: string | null
  address: string
  description: string
  type: 'lapor' | 'aspirasi'
  status: string
  created_at: string
  assigned_opd_name?: string | null
  disposition_notes?: string | null
}

interface OPDInfo {
  id: string
  code: string
  name: string
  description: string | null
}

interface ClassificationResult {
  urgency: 'critical' | 'moderate' | 'minor'
  urgency_reason: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentiment_reason: string
  suggested_opd_name: string
  suggested_opd_confidence: 'high' | 'medium' | 'low'
}

interface AIInsightResponse {
  summary_analysis: string
  key_insights: string[]
  recommended_actions: string[]
  classification?: ClassificationResult
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get user's auth token for permission check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user and their role
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user role - only superadmin, admin, member can generate insights
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData) {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - User role not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const allowedRoles = ['superadmin', 'admin', 'member']
    if (!allowedRoles.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { report_id, report_data, available_opds }: {
      report_id: string
      report_data: ReportData
      available_opds?: OPDInfo[]
    } = await req.json()

    if (!report_id || !report_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: report_id and report_data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating AI insight for report:', report_id)

    // Get OpenRouter API key from secrets
    const openRouterApiKey = Deno.env.get('pimpinan-insight')
    if (!openRouterApiKey) {
      console.error('OpenRouter API key not found in secrets')
      return new Response(
        JSON.stringify({ error: 'AI service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare the prompt for AI analysis - optimized for quick executive reading (20-40 seconds)
    const reportTypeLabel = report_data.type === 'lapor' ? 'Pengaduan' : 'Aspirasi'
    const statusLabel = {
      'pending': 'Menunggu',
      'in_progress': 'Proses',
      'resolved': 'Selesai',
      'rejected': 'Ditolak'
    }[report_data.status] || report_data.status

    const prompt = `Kamu adalah asisten eksekutif AI. Buat ringkasan SINGKAT untuk pimpinan yang sibuk.

LAPORAN [${report_data.ticket_id}]
Jenis: ${reportTypeLabel} | Status: ${statusLabel}
Lokasi: ${report_data.address}
${report_data.assigned_opd_name ? `OPD Saat Ini: ${report_data.assigned_opd_name}` : 'OPD: Belum ditentukan'}

ISI LAPORAN:
${report_data.description}

---

INSTRUKSI KETAT - IKUTI DENGAN TEPAT:

Hasilkan JSON dengan format berikut. WAJIB singkat dan padat.

{
  "summary_analysis": "[MAKSIMAL 1-2 kalimat, ~25 kata. Format: Apa masalahnya + dampak/urgensi]",
  "key_insights": [
    "[Poin 1: maks 10 kata]",
    "[Poin 2: maks 10 kata]",
    "[Poin 3: maks 10 kata]"
  ],
  "recommended_actions": [
    "[Aksi 1: mulai dengan kata kerja, maks 10 kata]",
    "[Aksi 2: mulai dengan kata kerja, maks 10 kata]",
    "[Aksi 3: mulai dengan kata kerja, maks 10 kata]"
  ],
  "classification": {
    "urgency": "[critical|moderate|minor]",
    "urgency_reason": "[1 kalimat alasan, maks 15 kata]",
    "sentiment": "[positive|negative|neutral]",
    "sentiment_reason": "[1 kalimat alasan, maks 15 kata]",
    "suggested_opd_name": "[Nama OPD yang relevan, contoh: Dinas Kesehatan, Dinas Lingkungan Hidup, Dinas Pekerjaan Umum, dll]",
    "suggested_opd_confidence": "[high|medium|low]"
  }
}

ATURAN WAJIB:
1. TOTAL output MAKSIMAL 200 kata
2. Summary: 1-2 kalimat saja, langsung ke inti masalah
3. Key Insights: Tepat 3 poin, tiap poin maks 10 kata
4. Actions: Tepat 3 aksi, MULAI dengan kata kerja (Koordinasi..., Kirim..., Tindaklanjuti..., Verifikasi...)
5. Gunakan bahasa Indonesia yang lugas dan jelas
6. JANGAN gunakan kata pengantar, langsung ke poin
7. Output HANYA JSON, tanpa markdown atau penjelasan tambahan

PANDUAN KLASIFIKASI:
- Urgency CRITICAL: Risiko kesehatan/keselamatan jiwa, bencana, keadaan darurat
- Urgency MODERATE: Gangguan layanan publik, infrastruktur rusak, dampak komunitas
- Urgency MINOR: Keluhan umum, saran, pertanyaan informasi
- Sentiment berdasarkan nada laporan: marah/frustasi=negative, puas/apresiasi=positive, netral=neutral
- suggested_opd_name: WAJIB isi nama OPD pemerintah daerah yang paling relevan berdasarkan isi laporan. Contoh:
  * Masalah kesehatan/penyakit/rumah sakit → Dinas Kesehatan
  * Masalah jalan/jembatan/drainase → Dinas Pekerjaan Umum
  * Masalah sampah/polusi/lingkungan → Dinas Lingkungan Hidup
  * Masalah pendidikan/sekolah → Dinas Pendidikan
  * Masalah keamanan/kriminal → Kepolisian/Satpol PP
  * Masalah perizinan/administrasi → Dinas terkait atau Bagian Umum
- Confidence HIGH jika domain OPD jelas cocok, MEDIUM jika perlu verifikasi, LOW jika ragu`

    // Call OpenRouter API with Gemini 2.5 Flash
    console.log('Calling OpenRouter API...')
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': supabaseUrl,
        'X-Title': 'Lapor AI - Citizen Feedback System',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,  // Lower temperature for more focused, consistent output
        max_tokens: 800    // Increased to accommodate classification data (~200 words target)
      })
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('OpenRouter API error:', aiResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'AI service error', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aiResult = await aiResponse.json()
    console.log('OpenRouter response received')

    // Parse AI response
    const aiContent = aiResult.choices?.[0]?.message?.content
    if (!aiContent) {
      console.error('No content in AI response:', aiResult)
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract JSON from response (handle potential markdown code blocks)
    let parsedInsight: AIInsightResponse
    try {
      // Remove markdown code blocks if present
      let jsonString = aiContent
      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```\n?/g, '')
      }
      jsonString = jsonString.trim()

      parsedInsight = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', aiContent)
      // Fallback: create structured response from raw text
      parsedInsight = {
        summary_analysis: aiContent.substring(0, 500),
        key_insights: ['Analisis AI tidak dapat diproses dengan sempurna'],
        recommended_actions: ['Silakan review laporan secara manual']
      }
    }

    // Validate parsed insight structure
    if (!parsedInsight.summary_analysis || !Array.isArray(parsedInsight.key_insights) || !Array.isArray(parsedInsight.recommended_actions)) {
      console.error('Invalid insight structure:', parsedInsight)
      return new Response(
        JSON.stringify({ error: 'AI returned invalid response structure' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract and validate classification data
    const classification = parsedInsight.classification
    const validUrgency = classification?.urgency && ['critical', 'moderate', 'minor'].includes(classification.urgency)
      ? classification.urgency
      : null
    const validSentiment = classification?.sentiment && ['positive', 'negative', 'neutral'].includes(classification.sentiment)
      ? classification.sentiment
      : null
    const validConfidence = classification?.suggested_opd_confidence && ['high', 'medium', 'low'].includes(classification.suggested_opd_confidence)
      ? classification.suggested_opd_confidence
      : null

    // Get suggested OPD name (no validation needed - AI provides the name)
    const suggestedOpdName = classification?.suggested_opd_name?.trim() || null

    // Save to database using upsert (update if exists, insert if not)
    const { data: savedInsight, error: saveError } = await supabaseAdmin
      .from('report_ai_insights')
      .upsert({
        report_id: report_id,
        summary_analysis: parsedInsight.summary_analysis,
        key_insights: parsedInsight.key_insights,
        recommended_actions: parsedInsight.recommended_actions,
        // Classification fields
        urgency: validUrgency,
        urgency_reason: classification?.urgency_reason || null,
        sentiment: validSentiment,
        sentiment_reason: classification?.sentiment_reason || null,
        suggested_opd_name: suggestedOpdName,
        suggested_opd_confidence: validConfidence,
        // Metadata
        model_used: 'google/gemini-2.5-flash',
        generated_by: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'report_id'
      })
      .select()
      .single()

    if (saveError) {
      console.error('Database save error:', saveError)
      return new Response(
        JSON.stringify({ error: 'Failed to save insight', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('AI insight saved successfully:', savedInsight.id)

    return new Response(
      JSON.stringify({
        success: true,
        data: savedInsight
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
