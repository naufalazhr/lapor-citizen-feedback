import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Building2, MessageSquare, BarChart3, Mail, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { validateInvitationToken } from "@/utils/invitation";
import type { InvitationWithDetails } from "@/types/invitation";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginTitle, setLoginTitle] = useState("Portal Lapor");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationWithDetails | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Fetch login configuration
    const fetchLoginConfig = async () => {
      const { data } = await supabase
        .from("login_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data) {
        setLoginTitle(data.login_title || "Portal Lapor");
        setLogoUrl(data.logo_url);
      }
    };

    // Check for invitation token in URL
    const checkInvitation = async () => {
      const inviteToken = searchParams.get('invite');
      if (inviteToken) {
        setInvitationToken(inviteToken);
        const invitationData = await validateInvitationToken(inviteToken);
        if (invitationData) {
          setInvitation(invitationData);
          // Pre-fill email from invitation
          setEmail(invitationData.email);
        } else {
          toast({
            title: "Invalid invitation",
            description: "This invitation link is invalid or expired",
            variant: "destructive",
          });
        }
      }
    };

    fetchLoginConfig();
    checkInvitation();

    const redirectByRole = async (userId: string) => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "superadmin")
        .maybeSingle();

      if (roleData) {
        navigate("/admin/license-generator");
      } else {
        navigate("/admin");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectByRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        redirectByRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login berhasil",
        description: "Selamat datang kembali!",
      });
    } catch (error: any) {
      toast({
        title: "Login gagal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            organization,
            department,
            position,
            invitation_token: invitationToken, // Include invitation token
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // If no invitation token, create approval request
        if (!invitationToken) {
          const { error: approvalError } = await supabase
            .from("user_approvals")
            .insert({
              user_id: authData.user.id,
              requested_role: "viewer",
              organization,
              department,
              position,
            });

          if (approvalError) console.error("Approval request error:", approvalError);
        }
      }

      if (invitation) {
        toast({
          title: "Pendaftaran berhasil",
          description: `Selamat datang di ${invitation.tenant?.name}! Anda akan dialihkan ke dashboard.`,
        });
      } else {
        toast({
          title: "Pendaftaran berhasil",
          description: "Akun Anda menunggu persetujuan admin. Kami akan mengirim email setelah akun Anda disetujui.",
        });
      }

      // Reset form
      setEmail("");
      setPassword("");
      setFullName("");
      setOrganization("");
      setDepartment("");
      setPosition("");
    } catch (error: any) {
      toast({
        title: "Pendaftaran gagal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const redirectTo = invitationToken
        ? `${window.location.origin}/?invite=${invitationToken}`
        : `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: invitationToken ? {
            invitation_token: invitationToken,
          } : undefined,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Login Google gagal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-between text-white">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{loginTitle}</h1>
            <p className="text-sm text-white/80">Sistem Pemantauan Laporan & Aspirasi</p>
          </div>

          <div className="space-y-8 mt-16">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-white/10 backdrop-blur-sm">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Kelola Laporan Warga</h3>
                <p className="text-white/70 text-sm">Monitor dan tanggapi laporan serta aspirasi masyarakat secara real-time</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-white/10 backdrop-blur-sm">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Analitik & Insights</h3>
                <p className="text-white/70 text-sm">Dapatkan wawasan data untuk pengambilan keputusan yang lebih baik</p>
              </div>
            </div>
          </div>
        </div>

        {/* Illustration */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-2xl"></div>
          <div className="relative p-8 flex items-center justify-center">
            {logoUrl ? (
              <div className="w-full max-w-sm">
                <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-white/5 backdrop-blur-sm">
                  <div className="aspect-[4/3] w-full">
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 bg-white/10 rounded-full flex items-center justify-center">
                <Building2 className="h-32 w-32 text-white/30" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-2xl border-border">
          <CardHeader className="space-y-1">
            <div className="lg:hidden mb-4">
              <CardTitle className="text-2xl">{loginTitle}</CardTitle>
              <CardDescription className="text-xs">Sistem Pemantauan Laporan</CardDescription>
            </div>
            <CardTitle className="text-2xl lg:text-3xl">Selamat Datang</CardTitle>
            <CardDescription>
              Masuk ke dashboard pemantauan laporan dan aspirasi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="register">Daftar</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="nama@instansi.go.id"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? "Memproses..." : "Masuk"}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">atau</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleGoogleLogin}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Masuk dengan Google
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                {/* Invitation Banner */}
                {invitation && (
                  <div className="mb-6 bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <UserPlus className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-primary">
                          You're invited to join {invitation.tenant?.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Complete your registration to join as{' '}
                          <Badge variant="outline" className="ml-1">
                            {invitation.role}
                          </Badge>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nama Lengkap</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Nama Anda"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="nama@instansi.go.id"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-org">Organisasi/Instansi</Label>
                    <Input
                      id="register-org"
                      type="text"
                      placeholder="Contoh: Dinas Kesehatan"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-dept">Bagian</Label>
                      <Input
                        id="register-dept"
                        type="text"
                        placeholder="Departemen"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-pos">Posisi</Label>
                      <Input
                        id="register-pos"
                        type="text"
                        placeholder="Jabatan"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    <p className="font-medium">ℹ️ Informasi Penting</p>
                    <p className="text-xs mt-1">Akun baru memerlukan persetujuan admin sebelum dapat digunakan.</p>
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? "Memproses..." : "Daftar Sekarang"}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">atau</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleGoogleLogin}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Daftar dengan Google
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
