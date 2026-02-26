import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { ChannelProviderCard } from "@/components/admin/ChannelProviderCard";
import { FonnteConfigManager } from "@/components/admin/FonnteConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FonnteLogo, InfobipLogo, TwilioLogo } from "@/components/admin/ProviderLogos";
import { MessageSquare } from "lucide-react";

const IntegrationChannelWhatsApp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [openPanel, setOpenPanel] = useState<"fonnte" | null>(null);
  const [hasFonnteConfig, setHasFonnteConfig] = useState(false);

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

    const { data } = await supabase
      .from("fonnte_config")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    setHasFonnteConfig(!!data);
    setLoading(false);
  };

  const togglePanel = (panel: "fonnte") => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
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
            dari warga melalui WhatsApp.
          </p>
        </div>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Provider WhatsApp Gateway
            </CardTitle>
            <CardDescription>
              Aktifkan dan konfigurasi provider gateway WhatsApp pilihan Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ChannelProviderCard
                name="Fonnte"
                description="Gateway WhatsApp Indonesia yang mudah diintegrasikan dengan API sederhana"
                logo={<FonnteLogo />}
                isActive={hasFonnteConfig}
                isConfigOpen={openPanel === "fonnte"}
                onConfigure={() => togglePanel("fonnte")}
              />
              <ChannelProviderCard
                name="Infobip"
                description="Platform komunikasi enterprise dengan WhatsApp Business API resmi"
                logo={<InfobipLogo />}
                isActive={false}
                isComingSoon
                onConfigure={() => {}}
              />
              <ChannelProviderCard
                name="Twilio"
                description="WhatsApp Business API resmi melalui platform komunikasi cloud Twilio"
                logo={<TwilioLogo />}
                isActive={false}
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
                  <FonnteConfigManager />
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