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
    
    // Validate required fields
    if (!payload.reporter_name || !payload.phone || !payload.address || 
        !payload.description || !payload.type) {
      console.error('Missing required fields:', payload)
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['reporter_name', 'phone', 'address', 'description', 'type']
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

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
    const { data: reportData, error } = await supabase
      .from('reports')
      .insert({
        reporter_name: payload.reporter_name,
        phone: payload.phone,
        address: payload.address,
        description: payload.description,
        type: payload.type,
        photo_url: payload.photo_url || null,
        geo_location: payload.geo_location || null,
        status: 'pending'
      })
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
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Report submitted successfully',
        data: {
          id: reportData.id,
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
