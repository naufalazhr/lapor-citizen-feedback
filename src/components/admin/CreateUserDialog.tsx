import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Copy, CheckCircle2, UserPlus, RefreshCw } from "lucide-react";

const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "opd_member", label: "OPD Member" },
  { value: "viewer", label: "Viewer" },
];

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string; role: string } | null>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setRole("");
    setShowPassword(false);
    setCreatedUser(null);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!email || !fullName || !password || !role) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }

    setLoading(true);
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
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat pengguna");
      }

      setCreatedUser({ email: email.trim().toLowerCase(), password, role });
      onUserCreated();

      toast({
        title: "Pengguna berhasil dibuat",
        description: `${fullName.trim()} (${role}) telah ditambahkan`,
      });
    } catch (error: any) {
      toast({
        title: "Gagal membuat pengguna",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!createdUser) return;
    const text = `Email: ${createdUser.email}\nPassword: ${createdUser.password}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Kredensial disalin ke clipboard" });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdUser ? "Pengguna Berhasil Dibuat" : "Tambah Pengguna Baru"}
          </DialogTitle>
          {!createdUser && (
            <DialogDescription>
              Buat akun baru untuk anggota tim. Bagikan kredensial secara langsung.
            </DialogDescription>
          )}
        </DialogHeader>

        {createdUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Akun berhasil dibuat</span>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{createdUser.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                <span className="font-medium">{createdUser.password}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Role: </span>
                <span className="font-medium">{createdUser.role}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Salin dan bagikan kredensial ini kepada pengguna. Password bersifat sementara dan dapat diubah setelah login.
            </p>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={copyCredentials}>
                <Copy className="h-4 w-4 mr-2" />
                Salin Kredensial
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={resetForm}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Buat Lagi
                </Button>
                <Button onClick={() => handleClose(false)}>
                  Selesai
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name">Nama Lengkap</Label>
              <Input
                id="create-name"
                placeholder="Nama lengkap pengguna"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="create-password">Password Sementara</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs gap-1"
                  onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}
                  disabled={loading}
                >
                  <RefreshCw className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select value={role} onValueChange={setRole} disabled={loading}>
                <SelectTrigger id="create-role">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Membuat..." : "Buat Pengguna"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
