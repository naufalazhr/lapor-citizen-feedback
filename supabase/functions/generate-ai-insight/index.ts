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
  report_category: string
}

const VALID_REPORT_CATEGORIES = [
  'flood', 'fire', 'accident', 'road_damage', 'waste',
  'public_facility', 'security', 'health', 'education',
  'drainage', 'street_lighting', 'licensing', 'aspiration', 'other'
]

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

    // ============================================
    // LOAD AI PROVIDER CONFIG FROM DB (per-tenant)
    // 1. Check ai_insight_provider_config for which provider is active
    // 2. Load credentials from the corresponding config table
    // 3. Fall back to 'pimpinan-insight' secret for backward compatibility
    // ============================================
    let aiProvider: 'openrouter' | 'byteplus' = 'openrouter'
    let aiApiKey = Deno.env.get('pimpinan-insight') || ''
    let aiBaseUrl = 'https://openrouter.ai/api/v1'
    let aiModel = 'google/gemini-2.5-flash'
    let aiMaxTokens: number | null = null  // null = use per-mode defaults
    let aiTemperature = 0.3

    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.tenant_id) {
        // Determine which provider is selected via ai_insight_provider_config
        let selectedProvider: string = 'openrouter'
        try {
          const { data: providerConfig } = await supabaseAdmin
            .from('ai_insight_provider_config')
            .select('provider')
            .eq('tenant_id', profile.tenant_id)
            .eq('is_active', true)
            .maybeSingle()

          if (providerConfig?.provider) {
            selectedProvider = providerConfig.provider
            console.log('AI Insight provider selected for tenant:', profile.tenant_id, '->', selectedProvider)
          } else {
            console.log('No ai_insight_provider_config for tenant, defaulting to openrouter')
          }
        } catch (providerError) {
          console.warn('ai_insight_provider_config table not available, defaulting to openrouter:', providerError)
        }

        // Load credentials from the selected provider's config table
        if (selectedProvider === 'byteplus') {
          try {
            const { data: bpConfig } = await supabaseAdmin
              .from('byteplus_config')
              .select('api_key, base_url, default_model, max_tokens, temperature')
              .eq('tenant_id', profile.tenant_id)
              .eq('is_active', true)
              .maybeSingle()

            if (bpConfig?.api_key) {
              aiProvider = 'byteplus'
              aiApiKey = bpConfig.api_key
              aiBaseUrl = bpConfig.base_url || 'https://ark.ap-southeast.bytepluses.com/api/v3'
              aiModel = bpConfig.default_model || 'seed-2-0-lite-260228'
              aiMaxTokens = bpConfig.max_tokens || null
              aiTemperature = bpConfig.temperature !== null && bpConfig.temperature !== undefined
                ? Number(bpConfig.temperature)
                : aiTemperature
              console.log('Loaded BytePlus config from DB for tenant:', profile.tenant_id, 'model:', aiModel)
            } else {
              console.log('BytePlus selected but no credentials found, falling back to OpenRouter')
            }
          } catch (bpError) {
            console.warn('byteplus_config table not available, falling back to OpenRouter:', bpError)
          }
        }

        // Load OpenRouter config (either selected or as fallback)
        if (aiProvider === 'openrouter') {
          const { data: orConfig } = await supabaseAdmin
            .from('openrouter_config')
            .select('api_key, base_url, default_model, max_tokens, temperature')
            .eq('tenant_id', profile.tenant_id)
            .eq('is_active', true)
            .maybeSingle()

          if (orConfig?.api_key) {
            aiApiKey = orConfig.api_key
            aiBaseUrl = orConfig.base_url || aiBaseUrl
            aiModel = orConfig.default_model || aiModel
            aiMaxTokens = orConfig.max_tokens || null
            aiTemperature = orConfig.temperature !== null && orConfig.temperature !== undefined
              ? Number(orConfig.temperature)
              : aiTemperature
            console.log('Loaded OpenRouter config from DB for tenant:', profile.tenant_id, 'model:', aiModel)
          } else {
            console.log('No active OpenRouter config in DB for tenant, using secret fallback')
          }
        }
      }
    } catch (configError) {
      console.warn('Failed to load AI config from DB, using secret fallback:', configError)
    }

    if (!aiApiKey) {
      console.error('AI API key not found in DB config or secrets')
      return new Response(
        JSON.stringify({ error: 'AI service configuration error - no AI API key configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper: call the AI provider with a prompt and return the text content
    const callAI = async (prompt: string, maxTokens: number): Promise<{ content: string | null, error: string | null }> => {
      if (aiProvider === 'byteplus') {
        // BytePlus ARK API uses /responses endpoint with input array
        const response = await fetch(`${aiBaseUrl}/responses`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: aiModel,
            stream: false,
            input: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: prompt
                  }
                ]
              }
            ],
            temperature: aiTemperature,
            max_output_tokens: aiMaxTokens || maxTokens
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('BytePlus API error:', response.status, errorText)
          return { content: null, error: errorText }
        }

        const result = await response.json()
        console.log('BytePlus raw response structure:', JSON.stringify(result).substring(0, 500))

        // BytePlus /responses API format (OpenAI Responses API compatible):
        // { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
        // Also try: output_text at top level, choices (chat completions fallback)
        const outputContent = result.output?.[0]?.content?.[0]?.text
          || result.output?.find((o: any) => o.type === 'message')?.content?.find((c: any) => c.type === 'output_text')?.text
          || result.choices?.[0]?.message?.content
          || result.output_text
          || null

        if (!outputContent) {
          console.error('BytePlus response had no extractable text. Full keys:', Object.keys(result), 'output type:', typeof result.output, 'output length:', result.output?.length)
          if (result.output?.[0]) {
            console.error('output[0] keys:', Object.keys(result.output[0]), 'output[0].content:', JSON.stringify(result.output[0].content)?.substring(0, 300))
          }
        }

        return { content: outputContent, error: null }
      } else {
        // OpenRouter uses standard OpenAI /chat/completions format
        const response = await fetch(`${aiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiApiKey}`,
            'HTTP-Referer': supabaseUrl,
            'X-Title': 'Lapor AI - Citizen Feedback System',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: aiTemperature,
            max_tokens: aiMaxTokens || maxTokens
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('OpenRouter API error:', response.status, errorText)
          return { content: null, error: errorText }
        }

        const result = await response.json()
        const content = result.choices?.[0]?.message?.content || null
        return { content, error: null }
      }
    }

    // Parse request body
    const requestBody = await req.json()
    const { report_id, report_data, available_opds, dashboard_summary, summary_data } = requestBody as {
      report_id?: string
      report_data?: ReportData
      available_opds?: OPDInfo[]
      dashboard_summary?: boolean
      summary_data?: {
        total_reports: number
        reports_by_status: { pending: number; in_progress: number; resolved: number; rejected: number }
        reports_by_type: { lapor: number; aspirasi: number }
        today_stats: any
        slow_opds: any[]
        trending: any[]
        top_recommendations: string[]
        urgent_issues_count?: number
        period_label?: string
      }
    }

    // ============================================
    // DASHBOARD SUMMARY MODE
    // ============================================
    if (dashboard_summary && summary_data) {
      console.log('Generating AI insight for dashboard summary')

      // Calculate key metrics for the prompt
      const totalReports = summary_data.total_reports || 0
      const pendingCount = summary_data.reports_by_status?.pending || 0
      const inProgressCount = summary_data.reports_by_status?.in_progress || 0
      const resolvedCount = summary_data.reports_by_status?.resolved || 0
      const rejectedCount = summary_data.reports_by_status?.rejected || 0
      const completionRate = totalReports > 0 ? Math.round((resolvedCount / totalReports) * 100) : 0
      const laporCount = summary_data.reports_by_type?.lapor || 0
      const aspirasiCount = summary_data.reports_by_type?.aspirasi || 0

      // Build comprehensive prompt for dashboard analysis
      const dashboardPrompt = `Kamu adalah asisten AI untuk Pimpinan/Pejabat Eksekutif Pemerintah Daerah.
Analisis data dashboard laporan masyarakat berikut dan berikan insight eksekutif untuk pengambilan keputusan.

=== DATA DASHBOARD ${summary_data.period_label ? `(${summary_data.period_label})` : ''} ===

STATISTIK UTAMA:
- Total Laporan: ${totalReports}
- Tingkat Penyelesaian: ${completionRate}%
- Status: Pending ${pendingCount}, Proses ${inProgressCount}, Selesai ${resolvedCount}, Ditolak ${rejectedCount}
- Jenis: Laporan/Pengaduan ${laporCount} (${totalReports > 0 ? Math.round((laporCount / totalReports) * 100) : 0}%), Aspirasi ${aspirasiCount} (${totalReports > 0 ? Math.round((aspirasiCount / totalReports) * 100) : 0}%)

STATISTIK HARI INI:
${JSON.stringify(summary_data.today_stats, null, 2)}

OPD DENGAN RESPONS LAMBAT (${summary_data.slow_opds?.length || 0} OPD):
${summary_data.slow_opds?.length > 0 ? summary_data.slow_opds.map((opd: any) =>
  `- ${opd.name || opd.opd_name}: Avg respons ${Math.round(opd.response_hours || opd.avg_response_hours || 0)} jam, Pending ${opd.pending || opd.pending_count || 0}, Rate ${opd.completion_rate || 0}%`
).join('\n') : '- Tidak ada OPD dengan respons lambat'}

TREN MINGGU INI:
${summary_data.trending?.length > 0 ? summary_data.trending.map((t: any) =>
  `- ${t.name}: ${t.thisWeek || 0} (minggu ini) vs ${t.lastWeek || 0} (minggu lalu), Perubahan: ${t.change > 0 ? '+' : ''}${t.change || 0}`
).join('\n') : '- Tidak ada data tren'}

LAPORAN MENDESAK: ${summary_data.urgent_issues_count || 0} laporan

=== INSTRUKSI ===

Berikan analisis dalam format JSON berikut. WAJIB actionable dan relevan untuk pimpinan.

{
  "executive_summary": "[2-3 kalimat ringkasan situasi keseluruhan untuk pimpinan. Fokus pada: kondisi umum, risiko utama, dan satu rekomendasi prioritas]",
  "priority_alerts": [
    {
      "level": "critical|warning|info",
      "title": "[Judul singkat, maks 8 kata]",
      "message": "[Penjelasan 1-2 kalimat tentang situasi]",
      "action": "[Tindakan spesifik yang harus dilakukan pimpinan]"
    }
  ],
  "bottlenecks": [
    {
      "area": "[Nama area/OPD bermasalah]",
      "issue": "[Masalah yang terdeteksi, maks 15 kata]",
      "impact": "[Dampak jika tidak ditangani, maks 15 kata]"
    }
  ],
  "trends": [
    {
      "indicator": "[Nama indikator]",
      "direction": "up|down|stable",
      "interpretation": "[Interpretasi singkat tren ini, maks 15 kata]"
    }
  ],
  "recommendations_today": [
    "[Rekomendasi 1: tindakan konkret untuk hari ini, mulai kata kerja]",
    "[Rekomendasi 2: tindakan konkret untuk hari ini, mulai kata kerja]",
    "[Rekomendasi 3: tindakan konkret untuk hari ini, mulai kata kerja]"
  ]
}

ATURAN PRIORITAS ALERT:
- CRITICAL: Laporan mendesak belum ditangani >24jam, tingkat penyelesaian <30%, OPD tidak responsif >3 hari
- WARNING: Backlog pending tinggi (>20), penurunan kinerja signifikan, tren negatif
- INFO: Insight positif, pencapaian baik, rekomendasi improvement

PANDUAN OUTPUT:
1. Maksimal 3 priority_alerts, urutkan dari paling penting
2. Maksimal 3 bottlenecks, fokus pada yang berdampak besar
3. Maksimal 3 trends, pilih yang paling relevan untuk keputusan
4. Tepat 3 recommendations_today, harus bisa ditindak HARI INI
5. Bahasa Indonesia formal tapi mudah dipahami
6. Jika data menunjukkan kinerja baik, sampaikan dengan objektif (tidak perlu memaksakan masalah)
7. Output HANYA JSON valid, tanpa markdown atau penjelasan tambahan`

      // Call AI provider
      console.log(`Calling ${aiProvider} API for dashboard summary...`, 'model:', aiModel)
      const { content: aiContent, error: aiError } = await callAI(dashboardPrompt, 1500)

      if (aiError) {
        return new Response(
          JSON.stringify({ error: 'AI service error', details: aiError }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!aiContent) {
        return new Response(
          JSON.stringify({ error: 'AI returned empty response' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`${aiProvider} dashboard response received`)

      // Parse AI response
      let parsedDashboardInsight
      try {
        let jsonString = aiContent
        if (jsonString.includes('```json')) {
          jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        } else if (jsonString.includes('```')) {
          jsonString = jsonString.replace(/```\n?/g, '')
        }
        jsonString = jsonString.trim()
        parsedDashboardInsight = JSON.parse(jsonString)
      } catch (parseError) {
        console.error('Failed to parse dashboard AI response as JSON:', aiContent)
        // Fallback response
        parsedDashboardInsight = {
          executive_summary: 'Analisis AI tidak dapat diproses. Silakan coba lagi.',
          priority_alerts: [],
          bottlenecks: [],
          trends: [],
          recommendations_today: ['Review data dashboard secara manual']
        }
      }

      // Validate and ensure all required fields exist
      const validatedInsight = {
        executive_summary: parsedDashboardInsight.executive_summary || 'Tidak ada ringkasan tersedia.',
        priority_alerts: Array.isArray(parsedDashboardInsight.priority_alerts) ? parsedDashboardInsight.priority_alerts : [],
        bottlenecks: Array.isArray(parsedDashboardInsight.bottlenecks) ? parsedDashboardInsight.bottlenecks : [],
        trends: Array.isArray(parsedDashboardInsight.trends) ? parsedDashboardInsight.trends : [],
        recommendations_today: Array.isArray(parsedDashboardInsight.recommendations_today) ? parsedDashboardInsight.recommendations_today : []
      }

      console.log('Dashboard AI insight generated successfully')

      return new Response(
        JSON.stringify({
          success: true,
          data: validatedInsight
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // INDIVIDUAL REPORT MODE (existing functionality)
    // ============================================
    if (!report_id || !report_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: report_id and report_data (or use dashboard_summary mode)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating AI insight for report:', report_id)

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
    "suggested_opd_confidence": "[high|medium|low]",
    "report_category": "[WAJIB pilih tepat satu dari: flood, fire, accident, road_damage, waste, public_facility, security, health, education, drainage, street_lighting, licensing, aspiration, other]"
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

    // Call AI provider
    console.log(`Calling ${aiProvider} API...`, 'model:', aiModel)
    const { content: aiContent, error: aiCallError } = await callAI(prompt, 800)

    if (aiCallError) {
      return new Response(
        JSON.stringify({ error: 'AI service error', details: aiCallError }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`${aiProvider} response received`)

    if (!aiContent) {
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

    // Validate report_category - fall back to 'other' if AI returns an invalid value
    const validReportCategory = classification?.report_category && VALID_REPORT_CATEGORIES.includes(classification.report_category)
      ? classification.report_category
      : 'other'

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
        report_category: validReportCategory,
        // Metadata
        model_used: `${aiProvider}/${aiModel}`,
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
