import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserRoleManager } from "@/components/admin/UserRoleManager";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCog } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  department: string | null;
  position: string | null;
  role: string | null;
}

const Users = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showRoleManager, setShowRoleManager] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.email?.toLowerCase().includes(query) ||
          user.full_name?.toLowerCase().includes(query) ||
          user.organization?.toLowerCase().includes(query) ||
          user.department?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .in('role', ['admin', 'owner'])
      .single();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Anda tidak memiliki izin untuk mengakses halaman ini.",
        variant: "destructive",
      });
      navigate('/admin/dashboard');
      return;
    }

    setIsAdmin(true);
    fetchUsers();
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        throw rolesError;
      }

      console.log("Fetched roles:", roles);
      console.log("Fetched profiles:", profiles);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      console.log("Role map:", Array.from(roleMap.entries()));

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        role: roleMap.get(profile.id) || null,
      })) || [];

      console.log("Users with roles:", usersWithRoles);

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data pengguna.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = (user: UserProfile) => {
    setSelectedUser(user);
    setShowRoleManager(true);
  };

  const handleRoleAssigned = () => {
    fetchUsers();
    setShowRoleManager(false);
    setSelectedUser(null);
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) {
      return <Badge variant="outline">Tidak Ada Role</Badge>;
    }

    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      owner: "default",
      admin: "default",
      member: "secondary",
      viewer: "secondary",
    };

    return <Badge variant={variants[role] || "outline"}>{role.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Memuat...</div>
        </div>
      </Dashboard>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kelola Pengguna</h1>
            <p className="text-muted-foreground mt-1">
              Kelola pengguna dan tetapkan role akses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari pengguna berdasarkan nama, email, atau organisasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Nama</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Organisasi</th>
                  <th className="text-left p-4 font-medium">Departemen</th>
                  <th className="text-left p-4 font-medium">Posisi</th>
                  <th className="text-left p-4 font-medium">Role</th>
                  <th className="text-left p-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      {searchQuery ? "Tidak ada pengguna yang cocok dengan pencarian." : "Belum ada pengguna terdaftar."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="p-4">{user.full_name || "-"}</td>
                      <td className="p-4">{user.email || "-"}</td>
                      <td className="p-4">{user.organization || "-"}</td>
                      <td className="p-4">{user.department || "-"}</td>
                      <td className="p-4">{user.position || "-"}</td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignRole(user)}
                        >
                          <UserCog className="h-4 w-4 mr-2" />
                          Atur Role
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserRoleManager
          user={selectedUser}
          open={showRoleManager}
          onOpenChange={setShowRoleManager}
          onRoleAssigned={handleRoleAssigned}
        />
      )}
    </Dashboard>
  );
};

export default Users;
