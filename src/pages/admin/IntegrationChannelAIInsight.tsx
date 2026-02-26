import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { ChannelProviderCard } from "@/components/admin/ChannelProviderCard";
import { OpenRouterConfigManager } from "@/components/admin/OpenRouterConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { OpenRouterLogo, OpenAILogo, GeminiLogo } from "@/components/admin/ProviderLogos";
import { Cpu } from "lucide-react";

// openrouter_config is a new table not yet in generated types.
const db: { from: (table: string) => any } = supabase as any;

const IntegrationChannelAIInsight = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [openPanel, setOpenPanel] = useState<"openrouter" | null>(null);
  const [hasOpenRouterConfig, setHasOpenRouterConfig] = useState(false);

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

    const { data } = await db
      .from("openrouter_config")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    setHasOpenRouterConfig(!!data);
    setLoading(false);
  };

  const togglePanel = (panel: "openrouter") => {
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
            <Cpu className="h-6 w-6 text-purple-500" />
            AI Insight
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih provider LLM (Large Language Model) untuk mengaktifkan fitur kecerdasan
            buatan seperti AI Insight, Analitik Eksekutif, dan klasifikasi laporan otomatis.
          </p>
        </div>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Provider LLM
            </CardTitle>
            <CardDescription>
              Aktifkan dan konfigurasi provider model bahasa besar pilihan Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ChannelProviderCard
                name="OpenRouter"
                description="Gateway multi-model LLM — akses GPT-4o, Claude, Gemini, dan ratusan model dengan satu API key"
                logo={<OpenRouterLogo />}
                isActive={hasOpenRouterConfig}
                isConfigOpen={openPanel === "openrouter"}
                onConfigure={() => togglePanel("openrouter")}
              />
              <ChannelProviderCard
                name="OpenAI"
                description="Akses langsung ke GPT-4o, o1, dan model OpenAI terbaru"
                logo={<OpenAILogo />}
                isActive={false}
                isComingSoon
                onConfigure={() => {}}
              />
              <ChannelProviderCard
                name="Google Gemini"
                description="Gemini 2.0 Flash dan model Google AI untuk analitik berkinerja tinggi"
                logo={<GeminiLogo />}
                isActive={false}
                isComingSoon
                onConfigure={() => {}}
              />
            </div>

            {/* OpenRouter Config Panel */}
            {openPanel === "openrouter" && (
              <div className="mt-2">
                <Separator className="mb-6" />
                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi OpenRouter</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Atur API key dan model default untuk fitur AI Insight
                  </p>
                  <OpenRouterConfigManager />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default IntegrationChannelAIInsight;