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
import { LayoutDashboard, FileText, LogOut, Settings, MessageSquare, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Laporan", url: "/admin/reports", icon: FileText },
  { title: "Percakapan", url: "/admin/conversations", icon: MessageSquare },
  { title: "Kelola OPD", url: "/admin/opds", icon: Building2, adminOnly: true },
  { title: "Integrasi", url: "/admin/integration", icon: Settings, adminOnly: true },
  { title: "Kelola Pengguna", url: "/admin/users", icon: Users, adminOnly: true },
];

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

  return (
    <Sidebar className={state === "collapsed" ? "w-16" : "w-64"}>
      <SidebarHeader className="border-b border-border p-4">
        {state !== "collapsed" && (
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Portal Lapor
            </h2>
            <p className="text-xs text-muted-foreground">Sistem Pemantauan</p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
          <SidebarMenu>
            {menuItems.map((item) => {
              // Hide admin-only pages from non-admin users
              if (item.adminOnly && userRole && !['admin', 'owner', 'superadmin'].includes(userRole)) {
                return null;
              }
              
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    className={isActive(item.url) ? "bg-accent" : ""}
                  >
                    <item.icon className="h-4 w-4" />
                    {state !== "collapsed" && <span>{item.title}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
