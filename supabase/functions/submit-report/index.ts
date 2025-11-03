import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface ReportPayload {
  reporter_name: string
  phone: string
  address: string
  description: string
  type: 'lapor' | 'aspirasi'
  photo_url?: string | null
  geo_location?: {
    lat: number
    lng: number
  } | null
  session_id?: string | null  // NEW: Optional session_id from Flowise
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key')
    
    if (!apiKey) {
      console.error('Missing API key')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase client (use service role for API key validation)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Hash the provided API key
    const encoder = new TextEncoder()
    const keyBytes = encoder.encode(apiKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Validate API key against database
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, is_active')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (keyError || !keyData) {
      console.error('Invalid API key')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update last_used_at timestamp (fire and forget)
    supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id)
      .then(() => console.log('Updated last_used_at for key:', keyData.id))

    // Parse request body
    const payload: ReportPayload = await req.json()
    
    // Fetch field configuration to determine required fields and defaults
    const { data: fieldConfigs, error: configError } = await supabase
      .from('api_field_configs')
      .select('field_name, is_required, default_value')

    if (configError) {
      console.error('Error fetching field configs:', configError)
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          message: 'Failed to load field requirements',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Apply default values and validate required fields
    const requiredConfigs = fieldConfigs?.filter(config => config.is_required) || []
    const missingFields = requiredConfigs
      .filter(config => !payload[config.field_name as keyof ReportPayload])
      .map(config => config.field_name)
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields)
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: missingFields,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Apply default values for empty/missing optional fields
    console.log('📋 Applying default values...')
    console.log('📋 Payload before defaults:', JSON.stringify(payload))

    fieldConfigs?.forEach(config => {
      const fieldName = config.field_name as keyof ReportPayload
      const currentValue = payload[fieldName]
      const hasDefaultValue = config.default_value !== null && config.default_value !== undefined

      // Check if field needs a default value
      // Apply default if: undefined, null, empty string, or empty object
      const needsDefault =
        currentValue === undefined ||
        currentValue === null ||
        currentValue === '' ||
        (typeof currentValue === 'object' && currentValue !== null && Object.keys(currentValue).length === 0)

      console.log(`📋 Field: ${fieldName}`)
      console.log(`   - Current value:`, currentValue)
      console.log(`   - Has default:`, hasDefaultValue)
      console.log(`   - Needs default:`, needsDefault)
      console.log(`   - Default value:`, config.default_value)

      if (needsDefault && hasDefaultValue) {
        payload[fieldName] = config.default_value as any
        console.log(`✅ Applied default value for ${fieldName}:`, config.default_value)
      }
    })

    console.log('📋 Payload after defaults:', JSON.stringify(payload))

    // Validate type
    if (payload.type !== 'lapor' && payload.type !== 'aspirasi') {
      console.error('Invalid type:', payload.type)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid type',
          message: 'Type must be either "lapor" or "aspirasi"'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Insert report into database (supabase client already initialized above)
    const insertData = {
      reporter_name: payload.reporter_name,
      phone: payload.phone,
      address: payload.address,
      description: payload.description,
      type: payload.type,
      photo_url: payload.photo_url || null,
      geo_location: payload.geo_location || null,
      session_id: payload.session_id || null,  // NEW: Store session_id for exact matching
      status: 'pending'
    }

    console.log('💾 Inserting report into database...')
    console.log('💾 Insert data:', JSON.stringify(insertData))
    console.log('💾 geo_location value:', insertData.geo_location)

    const { data: reportData, error } = await supabase
      .from('reports')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create report', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Report created successfully:', reportData.id)
    console.log('Report ticket_id:', reportData.ticket_id)

    // CONDITION 2: Report created → Mark conversation as COMPLETED
    // Match conversation by session_id (priority 1) or phone (priority 2)
    try {
      let activeConversation = null
      let matchMethod = 'none'

      // Priority 1: Match by session_id (exact, reliable)
      if (payload.session_id) {
        const { data, error: convError } = await supabase
          .from('conversations')
          .select('id, session_id')
          .eq('session_id', payload.session_id)
          .single()

        if (data && !convError) {
          activeConversation = data
          matchMethod = 'session_id'
          console.log('✓ Matched conversation by session_id:', payload.session_id)
        } else {
          console.warn('⚠ session_id provided but no conversation found:', payload.session_id)
        }
      }

      // Priority 2: Fallback to phone matching (for backward compatibility)
      if (!activeConversation) {
        const { data, error: convError } = await supabase
          .from('conversations')
          .select('id, phone_number')
          .eq('phone_number', payload.phone)
          .eq('status', 'active')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single()

        if (data && !convError) {
          activeConversation = data
          matchMethod = 'phone_number'
          console.log('✓ Matched conversation by phone_number:', payload.phone)
        }
      }

      // Update conversation if found
      if (activeConversation) {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            report_id: reportData.id  // CRITICAL: Store UUID from reports.id
          })
          .eq('id', activeConversation.id)

        if (updateError) {
          console.error('Failed to mark conversation as completed:', updateError)
        } else {
          console.log('✓ Conversation marked as completed:', activeConversation.id)
          console.log('✓ Linked report_id (UUID):', reportData.id)
          console.log('✓ Match method:', matchMethod)
        }
      } else {
        console.warn('⚠ No conversation found for matching')
        console.warn('⚠ Phone:', payload.phone)
        console.warn('⚠ session_id:', payload.session_id || 'not provided')
        console.warn('⚠ Report created but not linked to conversation')
        console.warn('⚠ Report ID:', reportData.id, 'Ticket:', reportData.ticket_id)
      }
    } catch (convUpdateError) {
      // Don't fail the report submission if conversation update fails
      console.error('Error updating conversation status:', convUpdateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Report submitted successfully',
        data: {
          ticket_id: reportData.ticket_id,
          status: reportData.status,
          created_at: reportData.created_at
        }
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
