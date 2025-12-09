import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { ProfileMenu } from "@/components/admin/ProfileMenu";
import { AIStatusIndicator } from "@/components/admin/AIStatusIndicator";
import { useUserRole } from "@/hooks/use-user-role";

interface DashboardProps {
  children: React.ReactNode;
}

const Dashboard = ({ children }: DashboardProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [hasRole, setHasRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();

  const getDashboardTitle = () => {
    if (role === 'admin' || role === 'superadmin' || role === 'owner') return 'Admin Dashboard';
    if (role === 'member') return 'Member Dashboard';
    if (role === 'opd_member') return 'OPD Member Dashboard';
    return 'Dashboard';
  };

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    await checkUserRole(session.user.id);
    setLoading(false);
  };

  const checkUserRole = async (userId: string) => {
    // Step 1: Check if user has tenant_id
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      setHasRole(false);
      navigate("/profile-setup");
      return;
    }

    // If user has no tenant_id, redirect to profile setup
    if (!profileData || !profileData.tenant_id) {
      setHasRole(false);
      navigate("/profile-setup");
      return;
    }

    // Step 2: Check if user has role (user has tenant_id at this point)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching role:", roleError);
      // If there's an error fetching role, redirect to profile setup
      setHasRole(false);
      navigate("/profile-setup");
      return;
    }

    // If user has a role, they're good to go
    if (roleData) {
      setHasRole(true);
      return;
    }

    // Step 3: User has tenant but no role - check if they have pending approval
    const { data: approvalData } = await supabase
      .from("user_approvals")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    setHasRole(false);

    if (approvalData) {
      navigate("/pending-approval");
    } else {
      navigate("/profile-setup");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasRole) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-lg font-semibold">{getDashboardTitle()}</h1>
            </div>
            <div className="flex items-center gap-3">
              <AIStatusIndicator />
              <ProfileMenu />
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
