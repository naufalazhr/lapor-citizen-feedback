import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRoleManager } from "@/components/admin/UserRoleManager";
import { UserOPDAssignmentDialog } from "@/components/admin/UserOPDAssignmentDialog";
import { InvitationManager } from "@/components/admin/InvitationManager";
import { PendingUserCard } from "@/components/admin/PendingUserCard";
import { useToast } from "@/hooks/use-toast";
import { Search, UserCog, Building2, UserPlus, Clock } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  department: string | null;
  position: string | null;
  role: string | null;
}

interface PendingApproval {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  organization: string | null;
  department: string | null;
  position: string | null;
  requested_at: string;
  user?: {
    email: string;
    full_name?: string;
  };
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
  const [showOPDAssignment, setShowOPDAssignment] = useState(false);
  const [showInvitationManager, setShowInvitationManager] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);

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
    fetchPendingApprovals();
  };

  const fetchPendingApprovals = async () => {
    const { data, error } = await supabase
      .from('user_approvals')
      .select(`
        id,
        user_id,
        requested_role,
        status,
        organization,
        department,
        position,
        requested_at
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending approvals:', error);
      return;
    }

    // Fetch user details for each approval
    const approvalsWithUsers = await Promise.all(
      (data || []).map(async (approval) => {
        const { data: userData } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', approval.user_id)
          .single();

        return {
          ...approval,
          user: userData || { email: 'Unknown' },
        };
      })
    );

    setPendingApprovals(approvalsWithUsers);
  };

  const fetchUsers = async () => {
    try {
      // TENANT ISOLATION: Get current user's tenant_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching current user profile:", profileError);
        throw profileError;
      }

      // If current user has no tenant_id, they might be superadmin (show all)
      // Otherwise, only show users from the same tenant
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentUserProfile?.tenant_id) {
        // TENANT ISOLATION: Filter by tenant_id and exclude superadmins
        profilesQuery = profilesQuery
          .eq('tenant_id', currentUserProfile.tenant_id)
          .not('tenant_id', 'is', null);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

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

  const handleAssignOPD = (user: UserProfile) => {
    setSelectedUser(user);
    setShowOPDAssignment(true);
  };

  const handleRoleAssigned = () => {
    fetchUsers();
    setShowRoleManager(false);
    setSelectedUser(null);
  };

  const handleOPDAssigned = () => {
    fetchUsers();
    setShowOPDAssignment(false);
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
      opd_member: "secondary",
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
          <Button onClick={() => setShowInvitationManager(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>

        {/* Pending Approvals Section */}
        {pendingApprovals.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Approvals
                  </CardTitle>
                  <CardDescription>
                    Users waiting for access approval
                  </CardDescription>
                </div>
                <Badge variant="secondary">{pendingApprovals.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingApprovals.map((approval) => (
                  <PendingUserCard
                    key={approval.id}
                    approval={approval}
                    onApproved={fetchPendingApprovals}
                    onRejected={fetchPendingApprovals}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignRole(user)}
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            Atur Role
                          </Button>
                          {user.role === 'opd_member' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignOPD(user)}
                            >
                              <Building2 className="h-4 w-4 mr-2" />
                              Tugaskan OPD
                            </Button>
                          )}
                        </div>
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
        <>
          <UserRoleManager
            user={selectedUser}
            open={showRoleManager}
            onOpenChange={setShowRoleManager}
            onRoleAssigned={handleRoleAssigned}
          />
          <UserOPDAssignmentDialog
            user={selectedUser}
            open={showOPDAssignment}
            onOpenChange={setShowOPDAssignment}
            onSuccess={handleOPDAssigned}
          />
        </>
      )}

      <InvitationManager
        open={showInvitationManager}
        onOpenChange={setShowInvitationManager}
      />
    </Dashboard>
  );
};

export default Users;
