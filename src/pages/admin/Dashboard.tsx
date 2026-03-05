import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { ProfileMenu } from "@/components/admin/ProfileMenu";
import { AIStatusIndicator } from "@/components/admin/AIStatusIndicator";
import { useUserRole } from "@/hooks/use-user-role";
import { useCriticalNotifications } from "@/hooks/use-critical-notifications";
import { CriticalAlertBanner } from "@/components/admin/dashboard/CriticalAlertBanner";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Clock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardProps {
  children: React.ReactNode;
}

const Dashboard = ({ children }: DashboardProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [hasRole, setHasRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const { overdueCount, overdueReports, dismissAll, dismiss } = useCriticalNotifications();

  // Identity state
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string>('');

  const getDashboardTitle = () => {
    if (role === 'admin' || role === 'superadmin' || role === 'owner') return 'Admin Dashboard';
    if (role === 'member') return 'Member Dashboard';
    if (role === 'opd_member') return 'OPD Member Dashboard';
    return 'Dashboard';
  };

  const getRoleLabel = () => {
    const labels: Record<string, string> = {
      superadmin: 'Super Admin',
      owner: 'Owner',
      admin: 'Admin',
      member: 'Member',
      opd_member: 'OPD Member',
      viewer: 'Viewer',
    };
    return role ? (labels[role] || role) : '';
  };

  const getRoleBadgeClass = () => {
    switch (role) {
      case 'superadmin': return 'bg-red-100 text-red-700 border-red-200';
      case 'owner': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'admin': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'member': return 'bg-green-100 text-green-700 border-green-200';
      case 'opd_member': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'viewer': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Close bell dropdown when clicking outside
  useEffect(() => {
    if (!bellOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bellOpen]);

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
    // Step 0: Check role first — superadmin may not have a tenant_id
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching role:", roleError);
      setHasRole(false);
      navigate("/profile-setup");
      return;
    }

    // Superadmin without tenant_id: allow access, skip tenant checks
    if (roleData?.role === 'superadmin') {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (profileData?.full_name) {
        setUserFullName(profileData.full_name);
      } else if (profileData?.email) {
        setUserFullName(profileData.email.split('@')[0]);
      }

      setHasRole(true);
      return;
    }

    // Step 1: Get profile with tenant_id and full_name
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      setHasRole(false);
      navigate("/profile-setup");
      return;
    }

    if (!profileData || !profileData.tenant_id) {
      setHasRole(false);
      navigate("/profile-setup");
      return;
    }

    // Set user display name
    if (profileData.full_name) {
      setUserFullName(profileData.full_name);
    } else if (profileData.email) {
      setUserFullName(profileData.email.split('@')[0]);
    }

    // Steps 2, 3, 4: run in parallel — tenant name, login logo, user role
    const [tenantResult, loginConfigResult] = await Promise.all([
      supabase.from('tenants').select('name').eq('id', profileData.tenant_id).single(),
      supabase.from('login_config').select('logo_url').limit(1).maybeSingle(),
    ]);

    if (tenantResult.data?.name) {
      setTenantName(tenantResult.data.name);
    }

    if (loginConfigResult.data?.logo_url) {
      setTenantLogoUrl(loginConfigResult.data.logo_url);
    }

    if (roleData) {
      setHasRole(true);
      return;
    }

    // Step 5: Check pending approval (only if no role found)
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
        <header className="sticky top-0 z-[1001] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 gap-4">

            {/* LEFT: Toggle + Organization Identity + Page Title */}
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="shrink-0" />

              {/* Organization identity */}
              <div className="flex items-center gap-2 shrink-0">
                {tenantLogoUrl ? (
                  <img
                    src={tenantLogoUrl}
                    alt="Logo"
                    className="h-7 w-7 rounded-full object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {tenantName && (
                  <span className="font-semibold text-sm truncate max-w-[160px] md:max-w-xs hidden sm:inline">
                    {tenantName}
                  </span>
                )}
              </div>

              <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />

              <h1 className="text-sm font-semibold text-muted-foreground hidden sm:block truncate">
                {getDashboardTitle()}
              </h1>
            </div>

            {/* CENTER: spacer */}
            <div className="flex-1" />

            {/* RIGHT: User info + actions */}
            <div className="flex items-center gap-2 shrink-0">

              {/* User name + role badge */}
              {userFullName && (
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                    {userFullName}
                  </span>
                  {role && (
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                      getRoleBadgeClass()
                    )}>
                      {getRoleLabel()}
                    </span>
                  )}
                </div>
              )}

              <AIStatusIndicator />

              {/* Critical notification bell */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setBellOpen(prev => !prev)}
                  className={cn(
                    "relative flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                    overdueCount > 0 && "text-red-500 hover:text-red-600"
                  )}
                  title={overdueCount > 0 ? `${overdueCount} laporan kritis menunggu` : "Notifikasi"}
                  aria-label="Notifikasi laporan kritis"
                >
                  <Bell className="h-5 w-5" />
                  {overdueCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full leading-none">
                      {overdueCount > 9 ? "9+" : overdueCount}
                    </span>
                  )}
                </button>

                {/* Bell dropdown */}
                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                      <span className="text-sm font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Laporan Kritis Tertunggak
                      </span>
                      {overdueCount > 0 && (
                        <button
                          onClick={() => { dismissAll(); setBellOpen(false); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Tutup semua
                        </button>
                      )}
                    </div>

                    {overdueCount === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Tidak ada laporan kritis tertunggak
                      </div>
                    ) : (
                      <div className="divide-y divide-border max-h-72 overflow-y-auto">
                        {overdueReports.slice(0, 5).map(report => (
                          <div key={report.id} className="px-3 py-2.5 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <Link
                                  to={`/admin/reports/${report.id}`}
                                  onClick={() => setBellOpen(false)}
                                  className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate"
                                >
                                  #{report.ticket_id}
                                </Link>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {report.urgency_reason || report.description}
                                </p>
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(report.created_at).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </div>
                              </div>
                              <button
                                onClick={() => dismiss(report.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1 rounded"
                                title="Abaikan"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                        {overdueCount > 5 && (
                          <div className="px-3 py-2 text-center">
                            <Link
                              to="/admin/reports"
                              onClick={() => setBellOpen(false)}
                              className="text-xs text-primary hover:underline"
                            >
                              Lihat {overdueCount - 5} laporan lainnya →
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ProfileMenu />
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 p-6 bg-background">
            {overdueCount > 0 && (
              <div className="mb-4">
                <CriticalAlertBanner count={overdueCount} onDismissAll={dismissAll} />
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
