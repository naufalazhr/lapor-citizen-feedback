import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { ChannelProviderCard } from "@/components/admin/ChannelProviderCard";
import { OpenRouterConfigManager } from "@/components/admin/OpenRouterConfigManager";
import { BytePlusConfigManager } from "@/components/admin/BytePlusConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { OpenRouterLogo, OpenAILogo, GeminiLogo, BytePlusLogo } from "@/components/admin/ProviderLogos";
import { Cpu } from "lucide-react";

// Tables not yet in generated types
const db: { from: (table: string) => any } = supabase as any;

const IntegrationChannelAIInsight = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [openPanel, setOpenPanel] = useState<"openrouter" | "byteplus" | null>(null);

  // activeProvider = the provider currently used for AI Insight (from ai_insight_provider_config)
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activatingProvider, setActivatingProvider] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // credential flags — has config saved, independent of which is active
  const [hasOpenRouterCredentials, setHasOpenRouterCredentials] = useState(false);
  const [hasBytePlusCredentials, setHasBytePlusCredentials] = useState(false);

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

    // Fetch tenant_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.user.id)
      .single();

    const tid = profile?.tenant_id ?? null;
    setTenantId(tid);

    // Load which provider is currently active
    let resolvedProvider: string | null = null;
    if (tid) {
      const { data: providerConfig } = await db
        .from("ai_insight_provider_config")
        .select("provider")
        .eq("tenant_id", tid)
        .eq("is_active", true)
        .maybeSingle();
      resolvedProvider = providerConfig?.provider ?? null;
    }

    // Default to "openrouter" for backward compatibility
    setActiveProvider(resolvedProvider ?? "openrouter");

    // Load credential status for each provider independently
    const [orRes, bpRes] = await Promise.all([
      db.from("openrouter_config").select("id").eq("is_active", true).maybeSingle(),
      db.from("byteplus_config").select("id").eq("is_active", true).maybeSingle(),
    ]);

    setHasOpenRouterCredentials(!!orRes.data);
    setHasBytePlusCredentials(!!bpRes.data);
    setLoading(false);
  };

  const activateProvider = async (provider: "openrouter" | "byteplus") => {
    if (provider === activeProvider) return;
    setActivatingProvider(provider);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tidak terautentikasi");

      let tid = tenantId;
      if (!tid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", session.user.id)
          .single();
        tid = profile?.tenant_id ?? null;
        if (tid) setTenantId(tid);
      }

      if (!tid) throw new Error("Tenant ID tidak ditemukan");

      // Deactivate all existing provider configs for this tenant
      await db
        .from("ai_insight_provider_config")
        .update({ is_active: false })
        .eq("tenant_id", tid);

      // Upsert the new active provider
      const { error } = await db
        .from("ai_insight_provider_config")
        .upsert({
          tenant_id: tid,
          provider,
          is_active: true,
          config_name: "default",
          created_by: session.user.id,
        }, { onConflict: "tenant_id,config_name" });

      if (error) throw error;

      setActiveProvider(provider);

      const labels: Record<string, string> = {
        openrouter: "OpenRouter",
        byteplus: "BytePlus",
      };
      toast({
        title: "Provider diaktifkan",
        description: `${labels[provider]} sekarang aktif sebagai provider AI Insight.`,
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

  const togglePanel = (panel: "openrouter" | "byteplus") => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

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
            <Cpu className="h-6 w-6 text-purple-500" />
            AI Insight
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih provider LLM (Large Language Model) untuk mengaktifkan fitur kecerdasan
            buatan seperti AI Insight, Analitik Eksekutif, dan klasifikasi laporan otomatis.
            Hanya satu provider yang aktif di satu waktu.
          </p>
        </div>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Provider LLM
            </CardTitle>
            <CardDescription>
              Provider <strong>Aktif</strong> adalah yang saat ini digunakan untuk fitur AI Insight.
              Provider <em>Terkonfigurasi</em> memiliki kredensial tersimpan
              tetapi tidak sedang digunakan — klik &ldquo;Jadikan Aktif&rdquo; untuk beralih.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ChannelProviderCard
                name="OpenRouter"
                description="Gateway multi-model LLM — akses GPT-4o, Claude, Gemini, dan ratusan model dengan satu API key"
                logo={<OpenRouterLogo />}
                isActive={activeProvider === "openrouter"}
                isConfigured={hasOpenRouterCredentials}
                isActivating={activatingProvider === "openrouter"}
                isConfigOpen={openPanel === "openrouter"}
                onActivate={() => activateProvider("openrouter")}
                onConfigure={() => togglePanel("openrouter")}
              />
              <ChannelProviderCard
                name="BytePlus"
                description="Platform AI dari ByteDance — akses model Seed untuk analitik dan klasifikasi"
                logo={<BytePlusLogo />}
                isActive={activeProvider === "byteplus"}
                isConfigured={hasBytePlusCredentials}
                isActivating={activatingProvider === "byteplus"}
                isConfigOpen={openPanel === "byteplus"}
                onActivate={() => activateProvider("byteplus")}
                onConfigure={() => togglePanel("byteplus")}
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
                  <OpenRouterConfigManager onSave={refreshCredentials} />
                </div>
              </div>
            )}

            {/* BytePlus Config Panel */}
            {openPanel === "byteplus" && (
              <div className="mt-2">
                <Separator className="mb-6" />
                <div>
                  <h3 className="text-base font-semibold mb-1">Konfigurasi BytePlus</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Atur API key dan model default untuk fitur AI Insight via BytePlus ARK
                  </p>
                  <BytePlusConfigManager onSave={refreshCredentials} />
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
