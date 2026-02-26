import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, FileText, LogOut, Settings, MessageSquare, Users, Building2, Clock, Bot, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (data) {
      setUserRole(data.role);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Berhasil keluar",
        description: "Anda telah keluar dari sistem",
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({
        title: "Berhasil keluar",
        description: "Anda telah keluar dari sistem",
      });
    } finally {
      // Always clear localStorage and navigate, regardless of API result
      localStorage.clear();
      navigate("/auth", { replace: true });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const isAdminUser = userRole !== null && ['admin', 'owner', 'superadmin'].includes(userRole);

  return (
    <Sidebar className={state === "collapsed" ? "w-16" : "w-64"}>
      <SidebarHeader className="border-b border-border px-4 py-3">
        {state !== "collapsed" && (
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Menu Navigasi</p>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/admin/dashboard')}
                  className={isActive('/admin/dashboard') ? "bg-accent" : ""}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {state !== "collapsed" && <span>Ringkasan Eksekutif</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/admin/recent-reports')}
                  className={isActive('/admin/recent-reports') ? "bg-accent" : ""}
                >
                  <Clock className="h-4 w-4" />
                  {state !== "collapsed" && <span>Statistik &amp; Analitik</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Laporan Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Laporan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/admin/reports')}
                  className={isActive('/admin/reports') ? "bg-accent" : ""}
                >
                  <FileText className="h-4 w-4" />
                  {state !== "collapsed" && <span>Laporan</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/admin/conversations')}
                  className={isActive('/admin/conversations') ? "bg-accent" : ""}
                >
                  <MessageSquare className="h-4 w-4" />
                  {state !== "collapsed" && <span>Percakapan</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Kelola Pengguna Group (adminOnly) */}
        {isAdminUser && (
          <SidebarGroup>
            <SidebarGroupLabel>Kelola Pengguna</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/opds')}
                    className={isActive('/admin/opds') ? "bg-accent" : ""}
                  >
                    <Building2 className="h-4 w-4" />
                    {state !== "collapsed" && <span>OPD</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/users')}
                    className={isActive('/admin/users') ? "bg-accent" : ""}
                  >
                    <Users className="h-4 w-4" />
                    {state !== "collapsed" && <span>User</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Integrasi Group (adminOnly) */}
        {isAdminUser && (
          <SidebarGroup>
            <SidebarGroupLabel>Integrasi</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/integration/login')}
                    className={isActive('/admin/integration/login') ? "bg-accent" : ""}
                  >
                    <Settings className="h-4 w-4" />
                    {state !== "collapsed" && <span>Konfigurasi Login</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/integration/ai')}
                    className={isActive('/admin/integration/ai') ? "bg-accent" : ""}
                  >
                    <Bot className="h-4 w-4" />
                    {state !== "collapsed" && <span>Konfigurasi AI Asisten</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/integration/api')}
                    className={isActive('/admin/integration/api') ? "bg-accent" : ""}
                  >
                    <Key className="h-4 w-4" />
                    {state !== "collapsed" && <span>API Management</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full justify-start"
        >
          <LogOut className="h-4 w-4" />
          {state !== "collapsed" && <span className="ml-2">Keluar</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
