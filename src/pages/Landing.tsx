import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, MessageSquare, BarChart3, Clock, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const [loginConfig, setLoginConfig] = useState<{ login_title: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    const fetchLoginConfig = async () => {
      const { data } = await supabase
        .from("login_config")
        .select("login_title, logo_url")
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setLoginConfig(data);
      }
    };
    fetchLoginConfig();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loginConfig?.logo_url && (
              <img 
                src={loginConfig.logo_url} 
                alt="Logo" 
                className="h-8 w-8 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              {loginConfig?.login_title || "Portal Lapor"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/lapor">
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Buat Laporan
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-block">
            <span className="px-4 py-2 rounded-full bg-secondary/10 text-secondary-foreground text-sm font-medium">
              Platform Laporan & Aspirasi Warga
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            Suara Anda,
            <span className="block bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Masa Depan Bersama
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Platform modern untuk mengelola laporan dan aspirasi warga dengan sistem pemantauan real-time dan analitik yang komprehensif
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/lapor">
              <Button size="lg" className="w-full sm:w-auto">
                <MessageSquare className="h-5 w-5 mr-2" />
                Sampaikan Aspirasi
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Shield className="h-5 w-5 mr-2" />
                Akses Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Fitur Unggulan</h3>
            <p className="text-muted-foreground">
              Solusi lengkap untuk manajemen laporan dan aspirasi warga
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Real-Time Monitoring</h4>
                <p className="text-muted-foreground">
                  Pantau semua laporan masuk secara langsung dengan sistem notifikasi otomatis
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Analitik Mendalam</h4>
                <p className="text-muted-foreground">
                  Dashboard analitik lengkap dengan visualisasi data dan laporan statistik
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">AI-Powered Chatbot</h4>
                <p className="text-muted-foreground">
                  Integrasi WhatsApp dengan chatbot AI untuk pengumpulan laporan otomatis
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Multi-User Management</h4>
                <p className="text-muted-foreground">
                  Sistem role-based access control untuk admin, member, dan viewer
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Status Tracking</h4>
                <p className="text-muted-foreground">
                  Lacak progress setiap laporan dari pending hingga completed
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Keamanan Terjamin</h4>
                <p className="text-muted-foreground">
                  Enkripsi data end-to-end dan sistem autentikasi yang aman
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/10 to-secondary/10 border-2">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <h3 className="text-3xl md:text-4xl font-bold">
              Siap Melayani Warga Lebih Baik?
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Bergabunglah dengan institusi pemerintah dan organisasi lainnya yang telah menggunakan platform kami untuk meningkatkan layanan publik
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/lapor">
                <Button size="lg" className="w-full sm:w-auto">
                  Buat Laporan Sekarang
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Login sebagai Admin
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; 2025 {loginConfig?.login_title || "Portal Lapor"}. Platform Laporan & Aspirasi Warga.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
