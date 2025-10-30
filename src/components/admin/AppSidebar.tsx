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
import { LayoutDashboard, FileText, BarChart3, LogOut, Code, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Laporan", url: "/admin/reports", icon: FileText },
  { title: "Analitik", url: "/admin/analytics", icon: BarChart3 },
  { title: "Percakapan", url: "/admin/conversations", icon: MessageSquare },
  { title: "Integrasi", url: "/admin/integration", icon: Code },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Berhasil keluar",
      description: "Anda telah keluar dari sistem",
    });
    navigate("/auth");
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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    className={isActive(item.url) ? "bg-accent" : ""}
                  >
                    <item.icon className="h-4 w-4" />
                    {state !== "collapsed" && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
