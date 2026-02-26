import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { ChannelProviderCard } from "@/components/admin/ChannelProviderCard";
import { FlowiseConfigManager } from "@/components/admin/FlowiseConfigManager";
import { AIAssistantConfigManager } from "@/components/admin/AIAssistantConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FlowiseLogo, CekatLogo } from "@/components/admin/ProviderLogos";
import { Brain, Zap } from "lucide-react";

const IntegrationChannelAIAgent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [openPanel, setOpenPanel] = useState<"flowise" | null>(null);
  const [hasFlowiseConfig, setHasFlowiseConfig] = useState(false);

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
      .from("flowise_config")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    setHasFlowiseConfig(!!data);
    setLoading(false);
  };

  const togglePanel = (panel: "flowise") => {
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
            <Brain className="h-6 w-6 text-blue-500" />
            AI Agent Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih provider AI Agent untuk mengintegrasikan asisten AI yang berkomunikasi
            dengan warga dan mengirim data ke dashboard pimpinan.
          </p>
        </div>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Provider AI Agent
            </CardTitle>
            <CardDescription>
              Aktifkan dan konfigurasi provider AI chatbot pilihan Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ChannelProviderCard
                name="Flowise"
                description="Platform AI workflow untuk membangun chatbot dan agen AI berbasis visual"
                logo={<FlowiseLogo />}
                isActive={hasFlowiseConfig}
                isConfigOpen={openPanel === "flowise"}
                onConfigure={() => togglePanel("flowise")}
              />
              <ChannelProviderCard
                name="Stoneart"
                description="Platform AI agent Indonesia untuk layanan percakapan pelanggan"
                icon={<Zap className="h-6 w-6" />}
                isActive={false}
                isComingSoon
                onConfigure={() => {}}
              />
              <ChannelProviderCard
                name="Cekat.AI"
                description="Solusi AI assistant cepat untuk automasi layanan publik"
                logo={<CekatLogo />}
                isActive={false}
                isComingSoon
                onConfigure={() => {}}
              />
            </div>

            {/* Flowise Config Panel */}
            {openPanel === "flowise" && (
              <div className="mt-2 space-y-6">
                <Separator />

                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi Flowise</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Atur endpoint dan autentikasi Flowise untuk menghubungkan asisten AI Anda
                  </p>
                  <FlowiseConfigManager />
                </div>

                <Separator />

                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi AI Asisten</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Kontrol status AI dan pesan balasan preset (Human-in-the-Loop)
                  </p>
                  <AIAssistantConfigManager />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default IntegrationChannelAIAgent;
