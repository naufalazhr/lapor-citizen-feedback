import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Bot, BotOff, AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface AIAssistantConfig {
  id: string;
  config_name: string;
  is_ai_enabled: boolean;
  ai_disabled_at: string | null;
  ai_disabled_by: string | null;
  preset_reply_text: string;
  updated_at: string;
}

export const AIAssistantConfigManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AIAssistantConfig | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    is_ai_enabled: true,
    preset_reply_text: "Terima kasih telah menghubungi kami. Saat ini layanan AI asisten sedang tidak aktif. Silakan hubungi admin atau coba lagi nanti.",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ai_assistant_config")
        .select("*")
        .eq("config_name", "default")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setConfig(data as AIAssistantConfig);
        setFormData({
          is_ai_enabled: data.is_ai_enabled,
          preset_reply_text: data.preset_reply_text,
        });
      }
    } catch (error: any) {
      console.error("Error fetching AI Assistant config:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal memuat konfigurasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequest = (newValue: boolean) => {
    setPendingToggleValue(newValue);
    setShowConfirmDialog(true);
  };

  const handleConfirmToggle = async () => {
    setShowConfirmDialog(false);

    try {
      setSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tidak terautentikasi");

      const updateData: any = {
        is_ai_enabled: pendingToggleValue,
        updated_at: new Date().toISOString(),
      };

      // Track when AI is disabled
      if (!pendingToggleValue) {
        updateData.ai_disabled_at = new Date().toISOString();
        updateData.ai_disabled_by = session.user.id;
      } else {
        updateData.ai_disabled_at = null;
        updateData.ai_disabled_by = null;
      }

      if (config) {
        const { error } = await supabase
          .from("ai_assistant_config")
          .update(updateData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_assistant_config").insert([{
          config_name: "default",
          is_ai_enabled: pendingToggleValue,
          preset_reply_text: formData.preset_reply_text,
          ai_disabled_at: !pendingToggleValue ? new Date().toISOString() : null,
          ai_disabled_by: !pendingToggleValue ? session.user.id : null,
        }]);

        if (error) throw error;
      }

      setFormData(prev => ({ ...prev, is_ai_enabled: pendingToggleValue }));

      toast({
        title: pendingToggleValue ? "AI Asisten Diaktifkan" : "AI Asisten Dinonaktifkan",
        description: pendingToggleValue
          ? "Semua pesan akan diproses oleh AI"
          : "Semua pesan akan dibalas dengan teks preset",
      });

      await fetchConfig();
    } catch (error: any) {
      console.error("Error toggling AI status:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengubah status AI",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.preset_reply_text.trim()) {
      newErrors.preset_reply_text = "Teks balasan preset wajib diisi";
    } else if (formData.preset_reply_text.length < 10) {
      newErrors.preset_reply_text = "Teks balasan minimal 10 karakter";
    } else if (formData.preset_reply_text.length > 1000) {
      newErrors.preset_reply_text = "Teks balasan maksimal 1000 karakter";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSavePresetText = async () => {
    if (!validateForm()) {
      toast({
        title: "Validasi Gagal",
        description: "Mohon perbaiki kesalahan sebelum menyimpan",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tidak terautentikasi");

      if (config) {
        const { error } = await supabase
          .from("ai_assistant_config")
          .update({
            preset_reply_text: formData.preset_reply_text.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_assistant_config").insert([{
          config_name: "default",
          is_ai_enabled: formData.is_ai_enabled,
          preset_reply_text: formData.preset_reply_text.trim(),
        }]);

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Teks balasan preset berhasil disimpan",
      });

      await fetchConfig();
    } catch (error: any) {
      console.error("Error saving preset text:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan teks balasan",
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
      {/* Important Notice */}
      <Alert variant="default" className="border-amber-500 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>AI Governance:</strong> Fitur ini memungkinkan kontrol penuh atas AI Asisten.
          Menonaktifkan AI akan menyebabkan semua pesan WhatsApp dibalas dengan teks preset.
        </AlertDescription>
      </Alert>

      {/* Status Alert */}
      {formData.is_ai_enabled ? (
        <Alert className="border-green-500 bg-green-50">
          <Bot className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>AI Asisten Aktif</strong> - Semua pesan diproses oleh AI.
            {config && (
              <span className="block text-sm mt-1">
                Terakhir diperbarui {formatDistanceToNow(new Date(config.updated_at), { addSuffix: true, locale: id })}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-orange-500 bg-orange-50">
          <BotOff className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>AI Asisten Nonaktif</strong> - Semua pesan dibalas dengan teks preset.
            {config?.ai_disabled_at && (
              <span className="block text-sm mt-1">
                Dinonaktifkan {formatDistanceToNow(new Date(config.ai_disabled_at), { addSuffix: true, locale: id })}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg p-6 space-y-6">
        {/* AI Toggle Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Kontrol Status AI</h3>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="ai_enabled" className="text-base font-medium">
                {formData.is_ai_enabled ? "AI Asisten Aktif" : "AI Asisten Nonaktif"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_ai_enabled
                  ? "Pesan akan diproses oleh AI untuk menghasilkan respons cerdas"
                  : "Pesan akan dibalas dengan teks preset yang sudah dikonfigurasi"}
              </p>
            </div>
            <Switch
              id="ai_enabled"
              checked={formData.is_ai_enabled}
              onCheckedChange={handleToggleRequest}
              disabled={saving}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </div>

        {/* Preset Text Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Teks Balasan Preset</h3>
          <p className="text-sm text-muted-foreground">
            Teks ini akan dikirim sebagai balasan otomatis ketika AI Asisten dinonaktifkan.
          </p>

          <div className="space-y-2">
            <Label htmlFor="preset_reply_text">
              Pesan Balasan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="preset_reply_text"
              placeholder="Masukkan teks balasan otomatis..."
              rows={4}
              value={formData.preset_reply_text}
              onChange={(e) => handleInputChange("preset_reply_text", e.target.value)}
              className={errors.preset_reply_text ? "border-destructive" : ""}
            />
            {errors.preset_reply_text && (
              <p className="text-sm text-destructive">{errors.preset_reply_text}</p>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pesan yang akan dikirim saat AI dinonaktifkan</span>
              <span>{formData.preset_reply_text.length}/1000</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSavePresetText} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Simpan Teks Preset
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingToggleValue ? (
                <Bot className="h-5 w-5 text-green-600" />
              ) : (
                <BotOff className="h-5 w-5 text-orange-600" />
              )}
              Konfirmasi Perubahan Status AI
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {pendingToggleValue ? (
                <>
                  Apakah Anda yakin ingin <strong>mengaktifkan AI Asisten</strong>?
                  <br /><br />
                  Semua pesan WhatsApp akan diproses oleh AI untuk menghasilkan respons cerdas.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin <strong>menonaktifkan AI Asisten</strong>?
                  <br /><br />
                  Semua pesan WhatsApp akan dibalas dengan teks preset:
                  <div className="mt-2 p-2 bg-muted rounded text-sm italic">
                    "{formData.preset_reply_text.substring(0, 100)}{formData.preset_reply_text.length > 100 ? '...' : ''}"
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={saving}
              className={pendingToggleValue ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {pendingToggleValue ? "Ya, Aktifkan AI" : "Ya, Nonaktifkan AI"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
