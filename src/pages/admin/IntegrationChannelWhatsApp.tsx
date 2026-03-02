import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { ChannelProviderCard } from "@/components/admin/ChannelProviderCard";
import { FonnteConfigManager } from "@/components/admin/FonnteConfigManager";
import { InfobipConfigManager } from "@/components/admin/InfobipConfigManager";
import { WhatsAppCloudConfigManager } from "@/components/admin/WhatsAppCloudConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FonnteLogo, InfobipLogo, TwilioLogo, WhatsAppCloudLogo } from "@/components/admin/ProviderLogos";
import { MessageSquare } from "lucide-react";

const IntegrationChannelWhatsApp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [openPanel, setOpenPanel] = useState<"fonnte" | "infobip" | "whatsapp_cloud" | null>(null);

  // activeProvider = the provider currently routing messages (from whatsapp_provider_config)
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activatingProvider, setActivatingProvider] = useState<string | null>(null);

  // credential flags — has config saved, independent of which is routing
  const [hasFonnteCredentials, setHasFonnteCredentials] = useState(false);
  const [hasInfobipCredentials, setHasInfobipCredentials] = useState(false);
  const [hasWhatsAppCloudCredentials, setHasWhatsAppCloudCredentials] = useState(false);

  useEffect(() => {
    checkAccessAndConfigs();
  }, []);

  const checkAccessAndConfigs = async () => {
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
      .single();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya admin yang dapat mengakses pengaturan channel.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    // Load which provider is currently routing
    const { data: providerConfig } = await supabase
      .from("whatsapp_provider_config" as any)
      .select("provider")
      .eq("is_active", true)
      .maybeSingle();

    // Default to "fonnte" for backward compatibility if no routing row exists
    setActiveProvider((providerConfig as any)?.provider ?? "fonnte");

    // Load credential status for each provider independently
    const [fonnteRes, infobipRes, waCloudRes] = await Promise.all([
      supabase.from("fonnte_config").select("id").eq("is_active", true).maybeSingle(),
      supabase.from("infobip_config" as any).select("id").eq("is_active", true).maybeSingle(),
      supabase.from("whatsapp_cloud_config" as any).select("id").eq("is_active", true).maybeSingle(),
    ]);

    setHasFonnteCredentials(!!fonnteRes.data);
    setHasInfobipCredentials(!!(infobipRes.data));
    setHasWhatsAppCloudCredentials(!!(waCloudRes.data));
    setLoading(false);
  };

  const activateProvider = async (provider: "fonnte" | "infobip" | "whatsapp_cloud") => {
    if (provider === activeProvider) return;
    setActivatingProvider(provider);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session.user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant ID not found");

      const { error } = await supabase
        .from("whatsapp_provider_config" as any)
        .upsert({
          tenant_id: profile.tenant_id,
          provider,
          is_active: true,
          config_name: "default",
        }, { onConflict: "tenant_id,config_name" });

      if (error) throw error;

      setActiveProvider(provider);

      const labels: Record<string, string> = {
        fonnte: "Fonnte",
        infobip: "Infobip",
        whatsapp_cloud: "WhatsApp Cloud API",
      };
      toast({
        title: "Provider diaktifkan",
        description: `${labels[provider]} sekarang aktif sebagai gateway WhatsApp.`,
      });
    } catch (error: any) {
      toast({
        title: "Gagal mengaktifkan provider",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setActivatingProvider(null);
    }
  };

  const togglePanel = (panel: "fonnte" | "infobip" | "whatsapp_cloud") => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  // Refresh credential badges after a config manager saves
  const refreshCredentials = () => {
    checkAccessAndConfigs();
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-full">
          <div className="text-lg text-muted-foreground">Memuat...</div>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-500" />
            WhatsApp Gateway
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih provider gateway WhatsApp untuk menerima dan mengirim pesan
            dari warga melalui WhatsApp. Hanya satu provider yang aktif di satu waktu.
          </p>
        </div>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Provider WhatsApp Gateway
            </CardTitle>
            <CardDescription>
              Provider <strong>Aktif</strong> adalah gateway yang saat ini mengirim dan menerima
              pesan WhatsApp. Provider <em>Terkonfigurasi</em> memiliki kredensial tersimpan
              tetapi tidak sedang digunakan — klik &ldquo;Jadikan Aktif&rdquo; untuk beralih.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChannelProviderCard
                name="Fonnte"
                description="Gateway WhatsApp Indonesia yang mudah diintegrasikan dengan API sederhana"
                logo={<FonnteLogo />}
                isActive={activeProvider === "fonnte"}
                isConfigured={hasFonnteCredentials}
                isActivating={activatingProvider === "fonnte"}
                isConfigOpen={openPanel === "fonnte"}
                onActivate={() => activateProvider("fonnte")}
                onConfigure={() => togglePanel("fonnte")}
              />
              <ChannelProviderCard
                name="Infobip"
                description="Platform komunikasi enterprise dengan WhatsApp Business API resmi"
                logo={<InfobipLogo />}
                isActive={activeProvider === "infobip"}
                isConfigured={hasInfobipCredentials}
                isActivating={activatingProvider === "infobip"}
                isConfigOpen={openPanel === "infobip"}
                onActivate={() => activateProvider("infobip")}
                onConfigure={() => togglePanel("infobip")}
              />
              <ChannelProviderCard
                name="WhatsApp Cloud API"
                description="WhatsApp Business Cloud API resmi langsung dari Meta tanpa perantara"
                logo={<WhatsAppCloudLogo />}
                isActive={activeProvider === "whatsapp_cloud"}
                isConfigured={hasWhatsAppCloudCredentials}
                isActivating={activatingProvider === "whatsapp_cloud"}
                isConfigOpen={openPanel === "whatsapp_cloud"}
                onActivate={() => activateProvider("whatsapp_cloud")}
                onConfigure={() => togglePanel("whatsapp_cloud")}
              />
              <ChannelProviderCard
                name="Twilio"
                description="WhatsApp Business API resmi melalui platform komunikasi cloud Twilio"
                logo={<TwilioLogo />}
                isActive={false}
                isConfigured={false}
                isComingSoon
                onConfigure={() => {}}
              />
            </div>

            {/* Fonnte Config Panel */}
            {openPanel === "fonnte" && (
              <div className="mt-2">
                <Separator className="mb-6" />
                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi Fonnte</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Atur token API dan nomor perangkat WhatsApp Fonnte Anda
                  </p>
                  <FonnteConfigManager onSaved={refreshCredentials} />
                </div>
              </div>
            )}

            {/* Infobip Config Panel */}
            {openPanel === "infobip" && (
              <div className="mt-2">
                <Separator className="mb-6" />
                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi Infobip</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Atur API Key, Base URL, dan nomor pengirim WhatsApp Infobip Anda
                  </p>
                  <InfobipConfigManager onSaved={refreshCredentials} />
                </div>
              </div>
            )}

            {/* WhatsApp Cloud API Config Panel */}
            {openPanel === "whatsapp_cloud" && (
              <div className="mt-2">
                <Separator className="mb-6" />
                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi WhatsApp Cloud API</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Atur Phone Number ID, Access Token, dan Verify Token dari Meta Developer Portal
                  </p>
                  <WhatsAppCloudConfigManager onSaved={refreshCredentials} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default IntegrationChannelWhatsApp;
