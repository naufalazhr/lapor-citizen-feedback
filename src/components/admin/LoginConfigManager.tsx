import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

export function LoginConfigManager() {
  const [loginTitle, setLoginTitle] = useState("Portal Lapor");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "File tidak valid",
        description: "Silakan pilih file gambar (PNG, JPG, WEBP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File terlalu besar",
        description: "Ukuran maksimal file adalah 2MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    // Clear URL when file is selected
    setLogoUrl("");
  };

  const handleRemoveFile = () => {
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;

    try {
      setUploading(true);
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("login-logos")
        .upload(filePath, logoFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("login-logos")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Gagal upload gambar",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Upload logo if file is selected
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (!uploadedUrl) {
          toast({
            title: "Gagal menyimpan",
            description: "Gagal upload gambar logo",
            variant: "destructive",
          });
          return;
        }
        finalLogoUrl = uploadedUrl;
      }

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
            logo_url: finalLogoUrl || null,
          })
          .eq("id", existingConfig.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from("login_config")
          .insert({
            login_title: loginTitle,
            logo_url: finalLogoUrl || null,
          });

        if (error) throw error;
      }

      // Update state and clear file
      setLogoUrl(finalLogoUrl);
      setLogoFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
          <Label htmlFor="logo-upload">Upload Logo/Gambar</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={loading || uploading}
              className="flex-1"
            />
            {logoFile && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRemoveFile}
                disabled={loading || uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Upload gambar logo (PNG, JPG, WEBP - maksimal 2MB)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo-url">Atau Masukkan URL Logo</Label>
          <Input
            id="logo-url"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            disabled={loading || uploading || !!logoFile}
          />
          <p className="text-sm text-muted-foreground">
            Alternatif: masukkan URL gambar logo jika tidak upload file
          </p>
        </div>

        {(logoUrl || logoFile) && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">Preview Logo:</p>
            {logoFile ? (
              <img 
                src={URL.createObjectURL(logoFile)} 
                alt="Logo preview" 
                className="h-16 w-16 object-contain rounded"
              />
            ) : logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo preview" 
                className="h-16 w-16 object-contain rounded"
                onError={(e) => {
                  e.currentTarget.src = "";
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>
        )}

        <Button onClick={handleSave} disabled={loading || uploading} className="w-full">
          {loading || uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploading ? "Mengupload..." : "Menyimpan..."}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Simpan Konfigurasi
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
