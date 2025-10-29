// Simple edge function to retrieve webhook errors (bypasses RLS)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  try {
    const { data: errors, error } = await supabase
      .from('webhook_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ errors }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});