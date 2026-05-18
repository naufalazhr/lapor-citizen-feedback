import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2].trim();
    }
  });
  return env;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function diagnoseUser(email) {
  console.log('Diagnosing user:', email, '\n');

  // 1. Check auth.users
  console.log('1. Checking auth.users...');
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  
  if (userError) {
    console.error('   Error listing users:', userError.message);
  } else {
    const user = userData.users.find(u => u.email === email);
    if (user) {
      console.log('   ✅ User found in auth.users:');
      console.log('      ID:', user.id);
      console.log('      Email:', user.email);
      console.log('      Created:', new Date(user.created_at).toLocaleString());
      console.log('      Email confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
      console.log('      Banned:', user.banned_until ? 'Yes' : 'No');
    } else {
      console.log('   ❌ User NOT found in auth.users');
      console.log('   → User needs to register first via signup');
      return;
  }

  // 2. Check profiles
  console.log('\n2. Checking profiles table...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('   Error fetching profile:', profileError.message);
  } else if (profile) {
    console.log('   ✅ Profile found:');
    console.log('      ID:', profile.id);
    console.log('      Full name:', profile.full_name);
    console.log('      Department:', profile.department);
    console.log('      Organization:', profile.organization);
    console.log('      Approval status:', profile.approval_status);
    console.log('      Is active:', profile.is_active);
  } else {
    console.log('   ⚠️  No profile found');
    console.log('   → Automatic profile creation may be needed (trigger)');
  }

  // 3. Check user_roles
  console.log('\n3. Checking user_roles...');
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role, created_at')
    .eq('user_id', user.id);

  if (rolesError) {
    console.error('   Error fetching roles:', rolesError.message);
  } else if (roles && roles.length > 0) {
    console.log('   ✅ Roles assigned:');
    roles.forEach(r => {
      console.log('      -', r.role, '(created:', new Date(r.created_at).toLocaleString() + ')');
    });
  } else {
    console.log('   ⚠️  No roles assigned');
    console.log('   → User needs role assignment (admin/superadmin)');
  }

  // 4. Check user_approvals (if any)
  console.log('\n4. Checking user_approvals...');
  const { data: approvals, error: approvalsError } = await supabase
    .from('user_approvals')
    .select('status, requested_role, reviewed_at, rejection_reason')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(1);

  if (approvalsError) {
    console.error('   Error fetching approvals:', approvalsError.message);
  } else if (approvals && approvals.length > 0) {
    const approv = approvals[0];
    console.log('   Found approval request:');
    console.log('      Status:', approv.status);
    console.log('      Requested role:', approv.requested_role);
    if (approv.status === 'rejected') {
      console.log('      Rejection reason:', approv.rejection_reason);
    }
    if (approv.reviewed_at) {
      console.log('      Reviewed:', new Date(approv.reviewed_at).toLocaleString());
    }
  } else {
    console.log('   No approval requests found');
  }

  console.log('\n=== DIAGNOSIS COMPLETE ===');
  console.log('\nNext steps based on findings:');
  console.log('- If user exists but no profile → Check if auth trigger is working');
  console.log('- If profile exists but approval_status is pending → Admin needs to approve');
  console.log('- If no roles assigned → Admin needs to assign role');
  console.log('- If email not confirmed → User must confirm email before login');
}

const email = 'naufal.azhar@sultantech.id';
diagnoseUser(email).catch(console.error);
