import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function LoginConfigManager() {
  const [loginTitle, setLoginTitle] = useState("Portal Lapor");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from("login_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLoginTitle(data.login_title || "Portal Lapor");
        setLogoUrl(data.logo_url || "");
      }
    } catch (error: any) {
      console.error("Error fetching config:", error);
      toast({
        title: "Gagal memuat konfigurasi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Check if config exists
      const { data: existingConfig } = await supabase
        .from("login_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from("login_config")
          .update({
            login_title: loginTitle,
            logo_url: logoUrl || null,
          })
          .eq("id", existingConfig.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from("login_config")
          .insert({
            login_title: loginTitle,
            logo_url: logoUrl || null,
          });

        if (error) throw error;
      }

      toast({
        title: "Berhasil disimpan",
        description: "Konfigurasi halaman login telah diperbarui",
      });
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast({
        title: "Gagal menyimpan",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi Halaman Login</CardTitle>
          <CardDescription>
            Personalisasi tampilan halaman login
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi Halaman Login</CardTitle>
        <CardDescription>
          Personalisasi tampilan halaman login
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-title">Judul Halaman Login</Label>
          <Input
            id="login-title"
            type="text"
            value={loginTitle}
            onChange={(e) => setLoginTitle(e.target.value)}
            placeholder="Portal Lapor"
            disabled={loading}
          />
          <p className="text-sm text-muted-foreground">
            Nama aplikasi yang ditampilkan di halaman login
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo-url">URL Logo/Gambar</Label>
          <Input
            id="logo-url"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            disabled={loading}
          />
          <p className="text-sm text-muted-foreground">
            URL gambar logo yang ditampilkan di halaman login (opsional)
          </p>
        </div>

        {logoUrl && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">Preview Logo:</p>
            <img 
              src={logoUrl} 
              alt="Logo preview" 
              className="h-16 w-16 object-contain rounded"
              onError={(e) => {
                e.currentTarget.src = "";
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            "Simpan Konfigurasi"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
