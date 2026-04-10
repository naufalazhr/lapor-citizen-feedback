import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserRoleManager } from "@/components/admin/UserRoleManager";
import { UserOPDAssignmentDialog } from "@/components/admin/UserOPDAssignmentDialog";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, UserPlus, MoreHorizontal, UserCog, Building2, KeyRound, Copy, CheckCircle2, Pencil, Ban, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  department: string | null;
  position: string | null;
  role: string | null;
  opd_name: string | null;
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
}

const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

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
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<{ email: string; password: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [suspendingUserId, setSuspendingUserId] = useState<string | null>(null);

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
          user.department?.toLowerCase().includes(query) ||
          user.opd_name?.toLowerCase().includes(query)
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

    setCurrentUserId(session.user.id);

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

      // Filter by tenant. Superadmins are excluded via role-based filter below.
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentUserProfile?.tenant_id) {
        profilesQuery = profilesQuery.eq('tenant_id', currentUserProfile.tenant_id);
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

      const { data: opdAssignments } = await supabase
        .from('user_opd_assignments')
        .select('user_id, opd:opds(name)')
        .eq('is_active', true);

      // Exclude superadmin users — they are managed via dedicated superadmin routes
      const superadminIds = new Set(
        (roles || []).filter(r => r.role === 'superadmin').map(r => r.user_id)
      );

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const opdMap = new Map(
        (opdAssignments || []).map(a => [a.user_id, (a.opd as { name: string } | null)?.name ?? null])
      );

      const usersWithRoles = (profiles || [])
        .filter(profile => !superadminIds.has(profile.id))
        .map(profile => ({
          ...profile,
          role: roleMap.get(profile.id) || null,
          opd_name: opdMap.get(profile.id) ?? null,
        }));

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

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }

    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesi tidak ditemukan");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "reset_password",
          user_id: resetPasswordUser.id,
          new_password: newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mereset password");

      setResetSuccess({ email: resetPasswordUser.email, password: newPassword });
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Gagal mereset password", description: error.message, variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSetActiveStatus = async (user: UserProfile, isActive: boolean) => {
    setSuspendingUserId(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesi tidak ditemukan");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "set_active_status",
          user_id: user.id,
          is_active: isActive,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengubah status");

      toast({
        title: isActive ? "Pengguna diaktifkan" : "Pengguna ditangguhkan",
        description: `${user.full_name || user.email} ${isActive ? 'dapat login kembali' : 'tidak dapat login'}`,
      });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    } finally {
      setSuspendingUserId(null);
    }
  };

  const getStatusBadge = (user: UserProfile) => {
    if (!user.is_active) return <Badge variant="destructive">Ditangguhkan</Badge>;
    if (user.last_login_at) return <Badge variant="default">Aktif</Badge>;
    return <Badge variant="outline">Belum Login</Badge>;
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
          <Button onClick={() => setShowCreateUser(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Tambah Pengguna
          </Button>
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
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Nama</th>
                  <th className="text-left p-4 font-medium">Role</th>
                  <th className="text-left p-4 font-medium">OPD</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Dibuat</th>
                  <th className="text-left p-4 font-medium">Login Terakhir</th>
                  <th className="text-left p-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-muted-foreground">
                      {searchQuery ? "Tidak ada pengguna yang cocok dengan pencarian." : "Belum ada pengguna terdaftar."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="p-4 text-sm">{user.email || "-"}</td>
                      <td className="p-4">{user.full_name || "-"}</td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4">{user.opd_name || "-"}</td>
                      <td className="p-4">
                        {getStatusBadge(user)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {user.last_login_at
                          ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })
                          : "-"}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditUser(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Pengguna
                            </DropdownMenuItem>
                            {user.id !== currentUserId && (
                              <DropdownMenuItem onClick={() => handleAssignRole(user)}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Atur Role
                              </DropdownMenuItem>
                            )}
                            {user.role === 'opd_member' && (
                              <DropdownMenuItem onClick={() => handleAssignOPD(user)}>
                                <Building2 className="h-4 w-4 mr-2" />
                                Tugaskan OPD
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setResetPasswordUser(user); setNewPassword(""); }}>
                              <KeyRound className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            {user.id !== currentUserId && (
                              user.is_active ? (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={suspendingUserId === user.id}
                                  onClick={() => handleSetActiveStatus(user, false)}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  {suspendingUserId === user.id ? "Memproses..." : "Tangguhkan"}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  disabled={suspendingUserId === user.id}
                                  onClick={() => handleSetActiveStatus(user, true)}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  {suspendingUserId === user.id ? "Memproses..." : "Aktifkan Kembali"}
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      <CreateUserDialog
        open={showCreateUser}
        onOpenChange={setShowCreateUser}
        onUserCreated={fetchUsers}
      />

      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
        onUserUpdated={fetchUsers}
      />

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setResetSuccess(null); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-sm">
          {resetSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>Password Berhasil Direset</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Password telah diperbarui</span>
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2 font-mono text-sm">
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium">{resetSuccess.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Password: </span>
                    <span className="font-medium">{resetSuccess.password}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Salin dan bagikan kredensial baru ini kepada pengguna.
                </p>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`Email: ${resetSuccess.email}\nPassword: ${resetSuccess.password}`);
                      toast({ title: "Kredensial disalin ke clipboard" });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Salin Kredensial
                  </Button>
                  <Button onClick={() => { setResetPasswordUser(null); setResetSuccess(null); }}>
                    Selesai
                  </Button>
                </DialogFooter>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription>
                  Atur password baru untuk {resetPasswordUser?.email}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="new-password">Password Baru</Label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setNewPassword(generatePassword())}
                      disabled={resettingPassword}
                    >
                      Generate Password
                    </Button>
                  </div>
                  <Input
                    id="new-password"
                    type="text"
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={resettingPassword}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetPasswordUser(null)} disabled={resettingPassword}>
                  Batal
                </Button>
                <Button onClick={handleResetPassword} disabled={resettingPassword || !newPassword}>
                  {resettingPassword ? "Mereset..." : "Reset Password"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Dashboard>
  );
};

export default Users;
