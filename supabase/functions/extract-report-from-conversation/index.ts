// =============================================================================
// extract-report-from-conversation — Edge Function
// Uses AI (OpenRouter) to extract structured report data from a WhatsApp
// conversation that was handled by a human admin/member.
// Returns pre-filled form data that the admin can review before submitting.
// JWT authentication required. Only owner/admin/member allowed.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_ROLES = ['superadmin', 'owner', 'admin', 'member'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const openRouterApiKey = Deno.env.get('pimpinan-insight');

    if (!openRouterApiKey) {
      console.error('OpenRouter API key (pimpinan-insight) not configured');
      return new Response(
        JSON.stringify({ error: 'AI service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Check role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || !ALLOWED_ROLES.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: conversationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch all messages from the conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('role, content, sent_by_human, message_index')
      .eq('conversation_id', conversationId)
      .neq('role', 'system') // Exclude system messages (audit trail only)
      .order('message_index', { ascending: true });

    if (msgError) {
      console.error('Error fetching messages:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch conversation messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages found in this conversation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also fetch phone_number from conversation (useful as reporter phone fallback)
    const { data: conversation } = await supabase
      .from('conversations')
      .select('phone_number, sender_name')
      .eq('id', conversationId)
      .single();

    // 5. Build conversation transcript for the AI prompt
    const transcript = messages.map(msg => {
      const speaker = msg.role === 'user'
        ? 'Warga'
        : (msg.sent_by_human ? 'Petugas (Manusia)' : 'AI Asisten');
      return `${speaker}: ${msg.content}`;
    }).join('\n');

    const extractionPrompt = `Kamu adalah asisten yang membantu petugas pemerintah mengekstrak informasi laporan masyarakat dari percakapan WhatsApp.

Berikut adalah percakapan antara warga dan petugas:

---
${transcript}
---

Informasi tambahan:
- Nomor telepon warga: ${conversation?.phone_number || 'tidak diketahui'}
- Nama pengirim: ${conversation?.sender_name || 'tidak diketahui'}

Ekstrak informasi berikut dari percakapan di atas dan kembalikan dalam format JSON:
{
  "reporter_name": "nama lengkap pelapor (gunakan sender_name jika tidak ada dalam percakapan)",
  "phone": "nomor telepon pelapor (gunakan nomor telepon warga jika tidak disebutkan)",
  "address": "alamat atau lokasi kejadian yang dilaporkan",
  "description": "deskripsi lengkap masalah atau aspirasi yang dilaporkan",
  "type": "lapor atau aspirasi (lapor jika pengaduan masalah, aspirasi jika usulan/harapan)",
  "geo_location": { "lat": angka, "lng": angka }
}

Aturan:
1. Gunakan bahasa yang jelas dan informatif
2. Jika informasi tidak tersedia dalam percakapan, gunakan string kosong ""
3. Untuk phone, selalu gunakan nomor telepon warga jika tidak ada yang lain
4. Output HANYA JSON valid, tanpa teks lain di luar JSON
5. Untuk geo_location: jika ada baris "[Lokasi: lat, lng]" atau koordinat GPS eksplisit dalam percakapan, ekstrak sebagai objek { "lat": angka, "lng": angka }. Jika tidak ada koordinat GPS, gunakan null`;

    // 6. Call OpenRouter API
    console.log('Calling OpenRouter API for conversation extraction...');
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': supabaseUrl,
        'X-Title': 'Lapor AI - Conversation Report Extraction',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.1, // Low temperature for consistent structured output
        max_tokens: 800
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenRouter API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service error', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error('No content in AI response:', aiResult);
      return new Response(
        JSON.stringify({ error: 'AI returned empty response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Parse JSON from AI response
    let extractedData: {
      reporter_name: string;
      phone: string;
      address: string;
      description: string;
      type: string;
      geo_location?: { lat: number; lng: number } | null;
    };

    try {
      let jsonString = aiContent;
      // Strip markdown code fences if present
      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```\n?/g, '');
      }
      jsonString = jsonString.trim();
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI extraction response:', aiContent);
      // Return a safe fallback with what we do know
      extractedData = {
        reporter_name: conversation?.sender_name || '',
        phone: conversation?.phone_number || '',
        address: '',
        description: '',
        type: 'lapor'
      };
    }

    // 8. Validate and sanitize the type field
    if (extractedData.type !== 'lapor' && extractedData.type !== 'aspirasi') {
      extractedData.type = 'lapor'; // Default to lapor
    }

    // 9. Validate geo_location shape — coerce strings to numbers, discard if malformed.
    // AI models sometimes return coordinates as strings ("lat": "-6.93") instead of
    // numbers ("lat": -6.93). Accept both and normalise to float.
    if (extractedData.geo_location) {
      const { lat, lng } = extractedData.geo_location as any;
      const latNum = typeof lat === 'number' ? lat : parseFloat(lat);
      const lngNum = typeof lng === 'number' ? lng : parseFloat(lng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        extractedData.geo_location = null;
      } else {
        extractedData.geo_location = { lat: latNum, lng: lngNum };
      }
    }

    // Ensure phone fallback
    if (!extractedData.phone && conversation?.phone_number) {
      extractedData.phone = conversation.phone_number;
    }

    // Ensure reporter_name fallback
    if (!extractedData.reporter_name && conversation?.sender_name) {
      extractedData.reporter_name = conversation.sender_name;
    }

    console.log('Extraction successful:', {
      hasName: !!extractedData.reporter_name,
      hasPhone: !!extractedData.phone,
      hasAddress: !!extractedData.address,
      hasDescription: !!extractedData.description,
      type: extractedData.type,
      hasGeoLocation: !!extractedData.geo_location
    });

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in extract-report-from-conversation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
