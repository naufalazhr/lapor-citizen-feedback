import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Save, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// openrouter_config is a new table not yet in generated types.
// We give the client a minimal interface so TypeScript resolves .from() → any
// without trying to match against the generated schema union.
const db: { from: (table: string) => any; auth: typeof supabase.auth } = supabase as any;

interface OpenRouterConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  api_key: string | null;
  base_url: string;
  default_model: string | null;
  max_tokens: number | null;
  temperature: number | null;
  updated_at: string;
}


interface OpenRouterConfigManagerProps {
  onSave?: () => void;
}

export const OpenRouterConfigManager = ({ onSave }: OpenRouterConfigManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<OpenRouterConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    api_key: "",
    base_url: "https://openrouter.ai/api/v1",
    default_model: "openai/gpt-4o",
    max_tokens: 2048,
    temperature: 0.7,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await db
        .from("openrouter_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        // PGRST205 = table not found (migration not yet applied to this environment).
        // Treat it as "no config" instead of surfacing an error toast.
        if (error.code === "PGRST205" || error.code === "42P01") return;
        throw error;
      }

      if (data) {
        const cfg = (data as unknown) as OpenRouterConfig;
        setConfig(cfg);
        setFormData({
          api_key: cfg.api_key || "",
          base_url: cfg.base_url || "https://openrouter.ai/api/v1",
          default_model: cfg.default_model || "openai/gpt-4o",
          max_tokens: cfg.max_tokens || 2048,
          temperature: cfg.temperature || 0.7,
        });
      }
    } catch (error: any) {
      console.error("Error fetching OpenRouter config:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal memuat konfigurasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.api_key.trim()) {
      newErrors.api_key = "API Key wajib diisi";
    }

    if (!formData.base_url.trim()) {
      newErrors.base_url = "Base URL wajib diisi";
    } else {
      try {
        new URL(formData.base_url);
      } catch {
        newErrors.base_url = "Format URL tidak valid";
      }
    }

    if (!formData.default_model.trim()) {
      newErrors.default_model = "Model wajib diisi";
    }

    const maxTokens = Number(formData.max_tokens);
    if (isNaN(maxTokens) || maxTokens < 256 || maxTokens > 8192) {
      newErrors.max_tokens = "Max tokens harus antara 256 dan 8192";
    }

    const temp = Number(formData.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      newErrors.temperature = "Temperature harus antara 0.0 dan 2.0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Validasi Error",
        description: "Perbaiki kesalahan sebelum menyimpan",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        api_key: formData.api_key.trim(),
        base_url: formData.base_url.trim(),
        default_model: formData.default_model.trim(),
        max_tokens: Number(formData.max_tokens),
        temperature: Number(formData.temperature),
        updated_at: new Date().toISOString(),
      };

      if (config) {
        const { error } = await db
          .from("openrouter_config")
          .update(updateData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Tidak terautentikasi");

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", session.user.id)
          .single();

        if (!profile?.tenant_id) throw new Error("Tenant ID tidak ditemukan");

        const { error } = await db.from("openrouter_config").insert([{
          ...updateData,
          config_name: "default",
          is_active: true,
          tenant_id: profile.tenant_id,
          created_by: session.user.id,
        }]);

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Konfigurasi OpenRouter berhasil disimpan",
      });

      await fetchConfig();
      onSave?.();
    } catch (error: any) {
      console.error("Error saving OpenRouter config:", error);
      // PGRST205 / 42P01 = table not yet created in this environment
      const isTableMissing = error.code === "PGRST205" || error.code === "42P01";
      toast({
        title: isTableMissing ? "Tabel Belum Tersedia" : "Error",
        description: isTableMissing
          ? "Tabel openrouter_config belum ada di database ini. Hubungi superadmin untuk menerapkan migrasi."
          : error.message || "Gagal menyimpan konfigurasi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Memuat konfigurasi...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!config && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Belum ada konfigurasi aktif. Buat konfigurasi baru di bawah ini.
          </AlertDescription>
        </Alert>
      )}

      {config && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Konfigurasi aktif. Terakhir diperbarui{" "}
            {formatDistanceToNow(new Date(config.updated_at), { addSuffix: true })}.
          </AlertDescription>
        </Alert>
      )}

      {/* Info link to OpenRouter */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div>
          <p className="text-sm font-medium">OpenRouter</p>
          <p className="text-xs text-muted-foreground">
            Platform multi-model LLM — akses GPT-4o, Claude, Gemini, dan ratusan model lainnya
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open("https://openrouter.ai/keys", "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Dapatkan API Key
        </Button>
      </div>

      <div className="border rounded-lg p-6 space-y-6">
        {/* API Auth Section */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Autentikasi API</h3>

          <div className="space-y-2">
            <Label htmlFor="or_api_key">
              API Key <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="or_api_key"
                type={showApiKey ? "text" : "password"}
                placeholder="sk-or-v1-..."
                value={formData.api_key}
                onChange={(e) => handleInputChange("api_key", e.target.value)}
                className={errors.api_key ? "border-destructive pr-10" : "pr-10"}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.api_key && (
              <p className="text-sm text-destructive">{errors.api_key}</p>
            )}
            <p className="text-xs text-muted-foreground">
              API key dari dashboard OpenRouter (openrouter.ai/keys)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="or_base_url">Base URL</Label>
            <Input
              id="or_base_url"
              type="url"
              value={formData.base_url}
              onChange={(e) => handleInputChange("base_url", e.target.value)}
              className={errors.base_url ? "border-destructive" : ""}
            />
            {errors.base_url && (
              <p className="text-sm text-destructive">{errors.base_url}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Endpoint API OpenRouter (biarkan default kecuali menggunakan proxy)
            </p>
          </div>
        </div>

        {/* Model Settings */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-base font-semibold">Pengaturan Model</h3>

          <div className="space-y-2">
            <Label htmlFor="or_default_model">
              Model Default <span className="text-destructive">*</span>
            </Label>
            <Input
              id="or_default_model"
              type="text"
              placeholder="google/gemini-2.5-flash"
              value={formData.default_model}
              onChange={(e) => handleInputChange("default_model", e.target.value)}
              className={errors.default_model ? "border-destructive" : ""}
            />
            {errors.default_model && (
              <p className="text-sm text-destructive">{errors.default_model}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Nama model sesuai format OpenRouter, contoh: <code className="bg-muted px-1 rounded">google/gemini-2.5-pro</code>, <code className="bg-muted px-1 rounded">openai/gpt-4o</code>, <code className="bg-muted px-1 rounded">anthropic/claude-3-5-sonnet</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="or_max_tokens">
                Max Tokens <span className="text-destructive">*</span>
              </Label>
              <Input
                id="or_max_tokens"
                type="number"
                min="256"
                max="8192"
                value={formData.max_tokens}
                onChange={(e) => handleInputChange("max_tokens", e.target.value)}
                className={errors.max_tokens ? "border-destructive" : ""}
              />
              {errors.max_tokens && (
                <p className="text-sm text-destructive">{errors.max_tokens}</p>
              )}
              <p className="text-xs text-muted-foreground">256 – 8192 token</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="or_temperature">
                Temperature <span className="text-destructive">*</span>
              </Label>
              <Input
                id="or_temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleInputChange("temperature", e.target.value)}
                className={errors.temperature ? "border-destructive" : ""}
              />
              {errors.temperature && (
                <p className="text-sm text-destructive">{errors.temperature}</p>
              )}
              <p className="text-xs text-muted-foreground">0.0 (tepat) – 2.0 (kreatif)</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
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
    </div>
  );
};
