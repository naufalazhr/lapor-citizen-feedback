import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a cryptographically secure random token for invitations
 * @returns A URL-safe random token string (32 characters)
 */
export const generateInvitationToken = (): string => {
  const array = new Uint8Array(24); // 24 bytes = 32 characters in base64url
  crypto.getRandomValues(array);

  // Convert to base64url (URL-safe base64)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Validates an invitation token and returns the invitation details
 * @param token The invitation token to validate
 * @returns The invitation data if valid, null otherwise
 */
export const validateInvitationToken = async (token: string) => {
  try {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        tenant:tenants(id, name, slug),
        inviter:profiles!invited_by(id, full_name, email)
      `)
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .is('accepted_at', null)
      .single();

    if (error) {
      console.error('Error validating invitation:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in validateInvitationToken:', error);
    return null;
  }
};

/**
 * Accepts an invitation for an existing user
 * @param userId The ID of the user accepting the invitation
 * @param invitationId The ID of the invitation to accept
 * @param tenantId The tenant ID from the invitation
 * @param role The role from the invitation
 * @returns Success status
 */
export const acceptInvitation = async (
  userId: string,
  invitationId: string,
  tenantId: string,
  role: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Step 1: Update user's tenant_id in profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ tenant_id: tenantId })
      .eq('id', userId);

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    // Step 2: Assign role to user
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (roleError) {
      // If role already exists, update it instead
      const { error: updateRoleError } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);

      if (updateRoleError) {
        return { success: false, error: updateRoleError.message };
      }
    }

    // Step 3: Mark invitation as accepted
    const { error: invitationError } = await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitationId);

    if (invitationError) {
      console.error('Error marking invitation as accepted:', invitationError);
      // Don't return error here - invitation is functionally accepted
    }

    return { success: true };
  } catch (error) {
    console.error('Error in acceptInvitation:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Revokes/deletes an invitation
 * @param invitationId The ID of the invitation to revoke
 * @returns Success status
 */
export const revokeInvitation = async (
  invitationId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in revokeInvitation:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Creates a new invitation
 * @param email The email address to invite
 * @param tenantId The tenant ID to invite to
 * @param role The role to assign
 * @returns The created invitation with token
 */
export const createInvitation = async (
  email: string,
  tenantId: string,
  role: string
): Promise<{ success: boolean; invitation?: any; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Generate token
    const token = generateInvitationToken();

    // Set expiration to 14 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    // Create invitation
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email,
        tenant_id: tenantId,
        role,
        invited_by: session.user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select(`
        *,
        tenant:tenants(id, name, slug)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, invitation: data };
  } catch (error) {
    console.error('Error in createInvitation:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Gets all pending invitations for the current user's tenant
 * @returns List of pending invitations
 */
export const getPendingInvitations = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    // Get user's tenant_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.tenant_id) return [];

    // Get pending invitations for this tenant
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        inviter:profiles!invited_by(full_name, email)
      `)
      .eq('tenant_id', profile.tenant_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPendingInvitations:', error);
    return [];
  }
};

/**
 * Generates the full invitation URL
 * @param token The invitation token
 * @returns The full invitation URL
 */
export const getInvitationUrl = (token: string): string => {
  return `${window.location.origin}/invite/${token}`;
};
