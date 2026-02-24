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
import { Bell, AlertTriangle, Clock } from "lucide-react";
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

  const getDashboardTitle = () => {
    if (role === 'admin' || role === 'superadmin' || role === 'owner') return 'Admin Dashboard';
    if (role === 'member') return 'Member Dashboard';
    if (role === 'opd_member') return 'OPD Member Dashboard';
    return 'Dashboard';
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
