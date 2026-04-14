import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "../Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChannelProviderCard } from "@/components/admin/ChannelProviderCard";
import {
  FonnteLogo,
  InfobipLogo,
  TwilioLogo,
  WhatsAppCloudLogo,
} from "@/components/admin/ProviderLogos";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Save,
  Loader2,
  Eye,
  EyeOff,
  ShieldAlert,
  UserCheck,
  ArrowRight,
} from "lucide-react";

type ProviderKey = "fonnte" | "whatsapp_cloud" | "infobip" | "twilio";

interface NotificationWhatsAppConfigRow {
  id?: string;
  provider: string;
  api_token: string;
  device_number: string | null;
  device_label: string | null;
  is_active: boolean;
}

const NotificationChannelWhatsAppPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openPanel, setOpenPanel] = useState<ProviderKey | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Fonnte config (the only real provider in Phase 1)
  const [config, setConfig] = useState<NotificationWhatsAppConfigRow>({
    provider: "fonnte",
    api_token: "",
    device_number: "",
    device_label: "Notifikasi SLA",
    is_active: false,
  });

  const activeProvider: ProviderKey | null =
    config.is_active && config.api_token ? (config.provider as ProviderKey) : null;
  const hasFonnteCredentials = !!config.api_token;

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "owner", "superadmin"])
      .maybeSingle();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya admin yang dapat mengakses konfigurasi channel notifikasi.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    await fetchConfig();
    setLoading(false);
  };

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from("notification_whatsapp_config" as any)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      toast({
        title: "Gagal memuat konfigurasi",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setConfig(data as unknown as NotificationWhatsAppConfigRow);
    }
  };

  const handleSave = async () => {
    if (!config.api_token.trim()) {
      toast({
        title: "Validasi gagal",
        description: "API Token wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("notification_whatsapp_config" as any)
          .update({
            provider: config.provider,
            api_token: config.api_token.trim(),
            device_number: config.device_number?.trim() || null,
            device_label: config.device_label?.trim() || null,
            is_active: config.is_active,
          } as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_whatsapp_config" as any)
          .insert({
            provider: "fonnte",
            api_token: config.api_token.trim(),
            device_number: config.device_number?.trim() || null,
            device_label: config.device_label?.trim() || null,
            is_active: true, // first save → auto-activate
          } as any);
        if (error) throw error;
      }

      toast({
        title: "Tersimpan",
        description: "Konfigurasi Fonnte berhasil disimpan.",
      });
      await fetchConfig();
    } catch (err: any) {
      toast({
        title: "Gagal menyimpan",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const activateFonnte = async () => {
    if (!hasFonnteCredentials) {
      toast({
        title: "Belum ada kredensial",
        description: "Simpan token terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    if (!config.id) return;
    const { error } = await supabase
      .from("notification_whatsapp_config" as any)
      .update({ is_active: true } as any)
      .eq("id", config.id);
    if (error) {
      toast({ title: "Gagal mengaktifkan", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Provider aktif",
      description: "Fonnte kini menjadi provider notifikasi WhatsApp.",
    });
    await fetchConfig();
  };

  const togglePanel = (panel: ProviderKey) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Memuat...</span>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-500" />
            Channel Notifikasi WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih provider WhatsApp untuk mengirim notifikasi SLA ke OPD. Hanya
            satu provider yang aktif dalam satu waktu.
          </p>
        </div>

        {/* Separate-number warning */}
        <Alert
          variant="destructive"
          className="border-amber-500 bg-amber-50 text-amber-900 [&>svg]:text-amber-600"
        >
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>PENTING — Gunakan nomor WhatsApp yang BERBEDA</AlertTitle>
          <AlertDescription className="mt-2 space-y-1 text-sm">
            <p>
              Nomor di sini harus <strong>berbeda</strong> dengan nomor yang
              dipakai untuk percakapan dengan warga (Integrasi → Channel →
              WhatsApp Gateway).
            </p>
            <p>
              Nomor notifikasi mengirim pesan push secara massal — risiko
              diblokir WhatsApp lebih tinggi. Jika nomor percakapan ikut
              diblokir, warga tidak bisa melapor sama sekali.
            </p>
          </AlertDescription>
        </Alert>

        {/* Provider cards */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Provider Notifikasi WhatsApp
            </CardTitle>
            <CardDescription>
              Provider <strong>Aktif</strong> saat ini yang akan mengirim
              notifikasi SLA. Klik kartu untuk mengatur konfigurasinya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChannelProviderCard
                name="Fonnte"
                description="Gateway WhatsApp Indonesia — cara termurah untuk pesan push internal"
                logo={<FonnteLogo />}
                isActive={activeProvider === "fonnte"}
                isConfigured={hasFonnteCredentials}
                isConfigOpen={openPanel === "fonnte"}
                onActivate={activateFonnte}
                onConfigure={() => togglePanel("fonnte")}
              />
              <ChannelProviderCard
                name="WhatsApp Cloud API"
                description="WhatsApp Business Cloud API resmi dari Meta — biaya per pesan"
                logo={<WhatsAppCloudLogo />}
                isActive={false}
                isConfigured={false}
                isComingSoon
                onConfigure={() => {}}
              />
              <ChannelProviderCard
                name="Infobip"
                description="Platform enterprise dengan WhatsApp Business API resmi"
                logo={<InfobipLogo />}
                isActive={false}
                isConfigured={false}
                isComingSoon
                onConfigure={() => {}}
              />
              <ChannelProviderCard
                name="Twilio"
                description="WhatsApp Business API resmi melalui Twilio"
                logo={<TwilioLogo />}
                isActive={false}
                isConfigured={false}
                isComingSoon
                onConfigure={() => {}}
              />
            </div>

            {/* Fonnte config panel */}
            {openPanel === "fonnte" && (
              <div className="mt-2">
                <Separator className="mb-6" />
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-1">Konfigurasi Fonnte</h3>
                    <p className="text-sm text-muted-foreground">
                      Atur token API dan nomor perangkat Fonnte yang didedikasikan untuk notifikasi
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api_token">
                        API Token <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="api_token"
                          type={showToken ? "text" : "password"}
                          placeholder="Token API Fonnte untuk perangkat notifikasi"
                          value={config.api_token}
                          onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowToken(!showToken)}
                        >
                          {showToken ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Token dari dashboard Fonnte untuk <strong>perangkat khusus
                        notifikasi</strong>. Jangan pakai token percakapan.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="device_number">Nomor Perangkat</Label>
                      <Input
                        id="device_number"
                        placeholder="628123456789"
                        value={config.device_number ?? ""}
                        onChange={(e) =>
                          setConfig({ ...config, device_number: e.target.value })
                        }
                        className="font-mono"
                      />
                      <p className="text-sm text-muted-foreground">
                        Nomor WhatsApp perangkat notifikasi (untuk referensi —
                        harus berbeda dari nomor percakapan)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="device_label">Label</Label>
                      <Input
                        id="device_label"
                        placeholder="Notifikasi SLA"
                        value={config.device_label ?? ""}
                        onChange={(e) =>
                          setConfig({ ...config, device_label: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Simpan Konfigurasi
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Provider-specific feature: contact sync */}
                  <Separator />
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-primary" />
                          Sinkron Kontak
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Karena Fonnte tidak menyediakan API untuk menambah
                          kontak secara otomatis, Anda perlu mengimpor kontak
                          OPD secara manual melalui dashboard Fonnte. Sistem
                          akan menolak mengirim ke OPD yang belum ditandai
                          tersinkron — ini adalah pengaman anti-banned utama.
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate("/admin/notifications/channel/whatsapp/contacts")}
                        className="shrink-0"
                      >
                        Kelola Kontak
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default NotificationChannelWhatsAppPage;
