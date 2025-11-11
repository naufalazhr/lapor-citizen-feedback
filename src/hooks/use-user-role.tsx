import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'superadmin' | 'admin' | 'member' | 'viewer' | 'opd_member' | 'owner' | null;

interface UseUserRoleReturn {
  role: UserRole;
  isSuperadmin: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isMember: boolean;
  isViewer: boolean;
  isOPDMember: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useUserRole = (): UseUserRoleReturn => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setRole(null);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
        return;
      }

      setRole(data?.role as UserRole || null);
    } catch (error) {
      console.error('Error in useUserRole:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    isSuperadmin: role === 'superadmin',
    isAdmin: role === 'admin',
    isOwner: role === 'owner',
    isMember: role === 'member',
    isViewer: role === 'viewer',
    isOPDMember: role === 'opd_member',
    loading,
    refetch: fetchRole,
  };
};
