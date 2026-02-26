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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Settings,
  MessageSquare,
  Users,
  Building2,
  Clock,
  Key,
  Layers,
  Brain,
  Cpu,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const CHANNEL_PATHS = [
  "/admin/integration/channel/ai-agent",
  "/admin/integration/channel/whatsapp",
  "/admin/integration/channel/ai-insight",
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);

  // Auto-expand Channel sub-menu if a channel sub-path is active
  useEffect(() => {
    if (CHANNEL_PATHS.some((p) => location.pathname.startsWith(p))) {
      setChannelOpen(true);
    }
  }, [location.pathname]);

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
      localStorage.clear();
      navigate("/auth", { replace: true });
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isChannelActive = CHANNEL_PATHS.some((p) => location.pathname.startsWith(p));

  const isAdminUser = userRole !== null && ['admin', 'owner', 'superadmin'].includes(userRole);
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"}>
      <SidebarHeader className="border-b border-border px-4 py-3">
        {!isCollapsed && (
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
                  {!isCollapsed && <span>Ringkasan Eksekutif</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/admin/recent-reports')}
                  className={isActive('/admin/recent-reports') ? "bg-accent" : ""}
                >
                  <Clock className="h-4 w-4" />
                  {!isCollapsed && <span>Statistik &amp; Analitik</span>}
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
                  {!isCollapsed && <span>Laporan</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/admin/conversations')}
                  className={isActive('/admin/conversations') ? "bg-accent" : ""}
                >
                  <MessageSquare className="h-4 w-4" />
                  {!isCollapsed && <span>Percakapan</span>}
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
                    {!isCollapsed && <span>OPD</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/users')}
                    className={isActive('/admin/users') ? "bg-accent" : ""}
                  >
                    <Users className="h-4 w-4" />
                    {!isCollapsed && <span>User</span>}
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

                {/* Channel — collapsible with 3 sub-items */}
                {isCollapsed ? (
                  // Collapsed: single icon that navigates to first sub-page
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate('/admin/integration/channel/ai-agent')}
                      className={isChannelActive ? "bg-accent" : ""}
                      title="Channel"
                    >
                      <Layers className="h-4 w-4" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  // Expanded: collapsible with sub-menu
                  <Collapsible open={channelOpen} onOpenChange={setChannelOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className={isChannelActive ? "bg-accent" : ""}
                        >
                          <Layers className="h-4 w-4" />
                          <span>Channel</span>
                          <ChevronDown
                            className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                              channelOpen ? "rotate-180" : ""
                            }`}
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => navigate('/admin/integration/channel/ai-agent')}
                            className={isActive('/admin/integration/channel/ai-agent') ? "bg-accent" : ""}
                          >
                            <Brain className="h-3.5 w-3.5" />
                            <span>AI Agent Integration</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => navigate('/admin/integration/channel/whatsapp')}
                            className={isActive('/admin/integration/channel/whatsapp') ? "bg-accent" : ""}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>WhatsApp Gateway</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => navigate('/admin/integration/channel/ai-insight')}
                            className={isActive('/admin/integration/channel/ai-insight') ? "bg-accent" : ""}
                          >
                            <Cpu className="h-3.5 w-3.5" />
                            <span>AI Insight</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Konfigurasi Login */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/integration/login')}
                    className={isActive('/admin/integration/login') ? "bg-accent" : ""}
                  >
                    <Settings className="h-4 w-4" />
                    {!isCollapsed && <span>Konfigurasi Login</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* API Management */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/admin/integration/api')}
                    className={isActive('/admin/integration/api') ? "bg-accent" : ""}
                  >
                    <Key className="h-4 w-4" />
                    {!isCollapsed && <span>API Management</span>}
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
          {!isCollapsed && <span className="ml-2">Keluar</span>}
        </Button>
        {!isCollapsed && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground/50 tracking-wide select-none">
            pimpinan.com
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
