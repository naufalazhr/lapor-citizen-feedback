import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileDialog } from "./ProfileDialog";

export function ProfileMenu() {
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    setProfile(profileData);
    setRole(roleData?.role || 'viewer');
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
      // Clear only auth-related localStorage keys, preserve app data (AI insights, etc.)
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.startsWith('supabase.auth.')) {
          localStorage.removeItem(key);
        }
      });
      navigate("/auth", { replace: true });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'owner':
        return 'text-red-600';
      case 'member':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {profile?.full_name || "User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {profile?.email}
              </p>
              <p className={`text-xs font-semibold ${getRoleBadgeColor(role)}`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
            <User className="mr-2 h-4 w-4" />
            <span>Profil Saya</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Keluar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog 
        open={showProfileDialog} 
        onOpenChange={setShowProfileDialog}
        profile={profile}
        onProfileUpdate={fetchProfile}
      />
    </>
  );
}
