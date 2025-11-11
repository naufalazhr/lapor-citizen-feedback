import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

interface UserRoleManagerProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleAssigned: () => void;
}

const roles = [
  { value: "admin", label: "Admin", description: "Akses penuh termasuk pengaturan integrasi" },
  { value: "member", label: "Member", description: "Dapat mengelola laporan dan percakapan" },
  { value: "opd_member", label: "OPD Member", description: "Dapat mengelola laporan untuk OPD yang ditugaskan" },
  { value: "viewer", label: "Viewer", description: "Hanya dapat melihat data" },
];

export const UserRoleManager = ({
  user,
  open,
  onOpenChange,
  onRoleAssigned,
}: UserRoleManagerProps) => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<"admin" | "member" | "opd_member" | "viewer">("member");
  const [loading, setLoading] = useState(false);

  // Update selected role when user prop changes or dialog opens
  useEffect(() => {
    if (open && user.role) {
      setSelectedRole(user.role as "admin" | "member" | "opd_member" | "viewer");
    }
  }, [open, user.role]);

  const handleAssignRole = async () => {
    if (!selectedRole) {
      toast({
        title: "Error",
        description: "Pilih role terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('assign_user_role', {
        target_user_id: user.id,
        new_role: selectedRole,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || "Gagal mengatur role");
      }

      toast({
        title: "Berhasil",
        description: result.message || "Role berhasil diatur.",
      });

      onRoleAssigned();
    } catch (error: any) {
      console.error("Error assigning role:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengatur role pengguna.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Atur Role Pengguna
          </DialogTitle>
          <DialogDescription>
            Tetapkan role akses untuk {user.full_name || user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pilih Role</label>
            <Select 
              value={selectedRole} 
              onValueChange={(value) => setSelectedRole(value as "admin" | "member" | "opd_member" | "viewer")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{role.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {role.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
            <h4 className="font-medium">Deskripsi Role:</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong>Admin:</strong> Akses penuh, dapat mengelola integrasi dan pengguna</li>
              <li><strong>Member:</strong> Dapat mengelola laporan dan percakapan</li>
              <li><strong>OPD Member:</strong> Dapat mengelola laporan untuk OPD yang ditugaskan</li>
              <li><strong>Viewer:</strong> Hanya dapat melihat data tanpa mengubah</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button onClick={handleAssignRole} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
