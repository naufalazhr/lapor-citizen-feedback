export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  id: string;
  email: string;
  tenant_id: string;
  role: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationWithDetails extends Invitation {
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  inviter?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CreateInvitationInput {
  email: string;
  role: string;
}
