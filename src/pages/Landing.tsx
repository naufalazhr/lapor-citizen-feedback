import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Shield, MessageSquare, BarChart3, Clock, CheckCircle2, Users, 
  Smartphone, TrendingUp, Bell, XCircle, Zap, Eye, FileText, MapPin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import heroIllustration from "@/assets/hero-reporting-illustration.png";

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

  const platformName = loginConfig?.login_title || "Portal Lapor";

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loginConfig?.logo_url && (
              <img 
                src={loginConfig.logo_url} 
                alt="Logo" 
                className="h-8 w-8 object-contain"
              />
            )}
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              {platformName}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link to="/lapor">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                <MessageSquare className="h-4 w-4 mr-2" />
                Buat Laporan
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                <Shield className="h-4 w-4 mr-2" />
                Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-primary-dark text-primary-foreground">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
        <div className="container mx-auto px-4 py-12 md:py-20 relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Content */}
            <div className="space-y-6 md:space-y-8 animate-fade-in">
              <div className="inline-block">
                <span className="px-4 py-2 rounded-full bg-secondary/20 backdrop-blur-sm border border-secondary/30 text-secondary text-sm font-medium">
                  🇮🇩 Platform Laporan & Aspirasi Warga
                </span>
              </div>
              
              <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                Revolusi Sistem
                <span className="block text-secondary mt-2">
                  Pelaporan Warga
                </span>
              </h2>
              
              <p className="text-lg md:text-xl text-primary-foreground/80 max-w-xl leading-relaxed">
                Asisten AI menghubungkan pekerja lapangan dengan pengambil keputusan melalui sistem pelaporan otomatis 24/7
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                <Link to="/lapor">
                  <Button size="lg" className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg hover:shadow-xl transition-all">
                    <Smartphone className="h-5 w-5 mr-2" />
                    Coba AI Assistant
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Live Dashboard
                  </Button>
                </Link>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-4 pt-6 md:pt-8">
                <div className="text-center lg:text-left">
                  <div className="text-3xl md:text-4xl font-bold text-secondary">80%</div>
                  <div className="text-sm text-primary-foreground/70 mt-1">Less Manual Work</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-3xl md:text-4xl font-bold text-secondary">~1hr</div>
                  <div className="text-sm text-primary-foreground/70 mt-1">Hemat Per Shift</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-3xl md:text-4xl font-bold text-secondary">24/7</div>
                  <div className="text-sm text-primary-foreground/70 mt-1">Live Monitoring</div>
                </div>
              </div>
            </div>

            {/* Right Column - Illustration */}
            <div className="relative animate-fade-in lg:block hidden">
              <div className="relative z-10">
                <img 
                  src={heroIllustration} 
                  alt="Citizen Reporting Platform" 
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-secondary/20 to-transparent rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Comparison Section */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Lihat Dampak Nyata Sistem Pelaporan Cerdas
            </h3>
            <p className="text-muted-foreground text-lg">
              Transformasi dari proses manual ke otomasi yang efisien
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Before Card */}
            <Card className="border-2 border-destructive/20 bg-destructive/5 hover:shadow-lg transition-all">
              <CardContent className="pt-8 pb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="rounded-full bg-destructive/10 p-2">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <h4 className="text-2xl font-bold text-destructive">Sebelum {platformName}</h4>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Form Kertas Manual</div>
                      <div className="text-sm text-muted-foreground">Proses pelaporan memakan waktu dan rentan kesalahan</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Respons Tertunda</div>
                      <div className="text-sm text-muted-foreground">Masalah tereskalasi sebelum mencapai pengambil keputusan</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Pengawasan Terbatas</div>
                      <div className="text-sm text-muted-foreground">Tidak ada visibilitas real-time terhadap operasi lapangan</div>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* After Card */}
            <Card className="border-2 border-success/30 bg-success/5 hover:shadow-lg transition-all">
              <CardContent className="pt-8 pb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="rounded-full bg-success/10 p-2">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <h4 className="text-2xl font-bold text-success">Dengan {platformName}</h4>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Laporan Digital Instan</div>
                      <div className="text-sm text-muted-foreground">WhatsApp-native dengan ekstraksi data AI otomatis</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Notifikasi Real-Time</div>
                      <div className="text-sm text-muted-foreground">Alert segera dan kemampuan respons cepat</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Transparansi Penuh</div>
                      <div className="text-sm text-muted-foreground">Dashboard tingkat gubernur dengan bukti yang dapat diverifikasi</div>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold mb-4">Fitur Unggulan</h3>
              <p className="text-muted-foreground text-lg">
                Solusi lengkap untuk manajemen laporan dan aspirasi warga
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="rounded-xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Clock className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">Real-Time Monitoring</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Pantau semua laporan masuk secara langsung dengan sistem notifikasi otomatis
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="rounded-xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">Analitik Mendalam</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Dashboard analitik lengkap dengan visualisasi data dan laporan statistik
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="rounded-xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">AI-Powered Chatbot</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Integrasi WhatsApp dengan chatbot AI untuk pengumpulan laporan otomatis
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="rounded-xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">Multi-User Management</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Sistem role-based access control untuk admin, member, dan viewer
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="rounded-xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">Status Tracking</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Lacak progress setiap laporan dari pending hingga completed
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="rounded-xl bg-primary/10 w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Shield className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">Keamanan Terjamin</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Enkripsi data end-to-end dan sistem autentikasi yang aman
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Kategori Pelaporan</h3>
            <p className="text-muted-foreground text-lg">
              Sistem kami mendukung berbagai jenis laporan warga
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-all border-2 hover:border-primary/50">
              <CardContent className="pt-8 pb-8">
                <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Kondisi Real-Time</h4>
                <p className="text-sm text-muted-foreground">
                  Laporan kondisi infrastruktur dan fasilitas publik
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-all border-2 hover:border-primary/50">
              <CardContent className="pt-8 pb-8">
                <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Analisis Trend</h4>
                <p className="text-sm text-muted-foreground">
                  Identifikasi pola dan tren masalah yang berulang
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-all border-2 hover:border-primary/50">
              <CardContent className="pt-8 pb-8">
                <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Alert & Respons</h4>
                <p className="text-sm text-muted-foreground">
                  Notifikasi cepat untuk situasi yang memerlukan perhatian segera
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-all border-2 hover:border-primary/50">
              <CardContent className="pt-8 pb-8">
                <div className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Dokumentasi</h4>
                <p className="text-sm text-muted-foreground">
                  Arsip lengkap dengan foto dan lokasi GPS
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-primary-dark text-primary-foreground py-16 md:py-20">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Siap Melayani Warga Lebih Baik?
            </h3>
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto leading-relaxed">
              Bergabunglah dengan institusi pemerintah dan organisasi lainnya yang telah menggunakan platform kami untuk meningkatkan layanan publik
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Link to="/lapor">
                <Button size="lg" className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Buat Laporan Sekarang
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground">
                  <Shield className="h-5 w-5 mr-2" />
                  Login sebagai Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                {loginConfig?.logo_url && (
                  <img 
                    src={loginConfig.logo_url} 
                    alt="Logo" 
                    className="h-8 w-8 object-contain"
                  />
                )}
                <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                  {platformName}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm max-w-sm">
                Platform pelaporan warga berbasis AI untuk meningkatkan transparansi dan efisiensi pelayanan publik.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/lapor" className="hover:text-primary transition-colors">
                    WhatsApp Assistant
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="hover:text-primary transition-colors">
                    Live Dashboard
                  </Link>
                </li>
                <li>
                  <span className="cursor-default">AI Analytics</span>
                </li>
                <li>
                  <span className="cursor-default">Mobile App</span>
                </li>
              </ul>
            </div>

            {/* Use Cases */}
            <div>
              <h4 className="font-semibold mb-4">Use Cases</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Field Workers</li>
                <li>Municipal Oversight</li>
                <li>Data Analytics</li>
                <li>Compliance</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              &copy; 2025 {platformName}. Platform Laporan & Aspirasi Warga. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
