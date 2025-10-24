import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a secure random API key
async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const key = 'lpk_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  
  // Create hash for storage
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  const prefix = key.substring(0, 12) // Store prefix for identification
  return { key, hash, prefix }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header (JWT token)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase client with the JWT token from request
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get authenticated user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Failed to get user:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Authenticated user:', user.id)

    // Parse request body
    const { key_name, notes } = await req.json()

    if (!key_name) {
      return new Response(
        JSON.stringify({ error: 'key_name is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate API key and hash
    const { key, hash, prefix } = await generateApiKey()

    // Store the hashed key in database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        key_name,
        key_hash: hash,
        key_prefix: prefix,
        created_by: user.id,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create API key', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('API key created successfully:', data.id)

    // Return the key ONLY once - it cannot be retrieved again
    return new Response(
      JSON.stringify({
        success: true,
        message: 'API key created successfully',
        api_key: key, // Full key returned only once
        data: {
          id: data.id,
          key_name: data.key_name,
          key_prefix: prefix,
          created_at: data.created_at,
        },
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
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
