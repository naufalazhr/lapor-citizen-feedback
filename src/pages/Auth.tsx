import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Building2, MessageSquare, BarChart3 } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginTitle, setLoginTitle] = useState("Portal Lapor");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
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

    fetchLoginConfig();

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
  }, [navigate]);

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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
