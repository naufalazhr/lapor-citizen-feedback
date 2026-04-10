// =============================================================================
// create-user — Edge Function
// Admin/Owner creates a new user with email + password + role.
// Uses service_role key to call supabase.auth.admin.createUser().
// The handle_new_user() trigger auto-assigns tenant_id via get_default_tenant_id().
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_ROLES = ['admin', 'member', 'opd_member', 'viewer'];
const CALLER_ROLES = ['superadmin', 'owner', 'admin'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify JWT — extract calling user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user: caller }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check caller has admin/owner/superadmin role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: callerRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (roleError || !callerRole || !CALLER_ROLES.includes(callerRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body — supports 'create' and 'reset_password' actions
    const body = await req.json();
    const action = body.action || 'create';

    // ── ACTION: reset_password ──────────────────────────────────────────
    if (action === 'reset_password') {
      const { user_id, new_password } = body;

      if (!user_id || !new_password) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: user_id, new_password' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password harus minimal 6 karakter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SECURITY: Refuse to reset password for superadmin users
      const { data: targetRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user_id)
        .maybeSingle();

      if (targetRole?.role === 'superadmin') {
        return new Response(
          JSON.stringify({ error: 'Tidak dapat mereset password superadmin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: resetError } = await supabase.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (resetError) {
        console.error('Failed to reset password:', resetError.message);
        return new Response(
          JSON.stringify({ error: 'Gagal mereset password', details: resetError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password reset for user:', user_id);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: set_active_status ─────────────────────────────────────
    if (action === 'set_active_status') {
      const { user_id, is_active } = body;

      if (!user_id || typeof is_active !== 'boolean') {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: user_id, is_active (boolean)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Self-protection: admin cannot suspend themselves
      if (user_id === caller.id) {
        return new Response(
          JSON.stringify({ error: 'Tidak dapat mengubah status akun sendiri' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Superadmin protection
      const { data: targetRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user_id)
        .maybeSingle();

      if (targetRole?.role === 'superadmin') {
        return new Response(
          JSON.stringify({ error: 'Tidak dapat mengubah status superadmin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Last admin protection: refuse suspending the last active admin/owner
      if (!is_active && targetRole?.role && ['admin', 'owner'].includes(targetRole.role)) {
        const { count: activeAdminCount } = await supabase
          .from('user_roles')
          .select('user_id', { count: 'exact', head: true })
          .in('role', ['admin', 'owner'])
          .in('user_id',
            (await supabase.from('profiles').select('id').eq('is_active', true)).data?.map(p => p.id) || []
          );

        if ((activeAdminCount || 0) <= 1) {
          return new Response(
            JSON.stringify({ error: 'Tidak dapat menangguhkan admin terakhir' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Dual write: Supabase auth ban + profiles.is_active
      const { error: banError } = await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: is_active ? 'none' : '876000h',
      });

      if (banError) {
        console.error('Failed to update ban status:', banError.message);
        return new Response(
          JSON.stringify({ error: 'Gagal mengubah status pengguna', details: banError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active })
        .eq('id', user_id);

      if (profileError) {
        console.error('Failed to update profile is_active:', profileError.message);
      }

      console.log(`User ${user_id} ${is_active ? 'reactivated' : 'suspended'}`);
      return new Response(
        JSON.stringify({ success: true, is_active }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: create (default) ────────────────────────────────────────
    const { email, full_name, password, role } = body;

    if (!email || !full_name || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, full_name, password, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password harus minimal 6 karakter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create auth user (triggers handle_new_user → profile with tenant_id)
    const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() }
    });

    if (createError) {
      console.error('Failed to create user:', createError.message);

      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'Email sudah terdaftar' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Gagal membuat pengguna', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUser = newUserData.user;
    console.log('User created:', newUser.id, email);

    // 5. Assign role (trigger only assigns role for invitation path, not admin-created users)
    const { error: roleInsertError } = await supabase
      .from('user_roles')
      .insert({ user_id: newUser.id, role });

    if (roleInsertError) {
      console.error('Failed to assign role:', roleInsertError.message);
    }

    console.log('User creation complete:', { id: newUser.id, email, role });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          full_name: full_name.trim(),
          role
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
