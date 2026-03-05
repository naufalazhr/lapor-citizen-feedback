import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Save, AlertCircle, CheckCircle, Copy, Check, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InfobipConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  api_key: string | null;
  base_url: string | null;
  sender_number: string | null;
  auto_reply_enabled: boolean;
  session_timeout_minutes: number;
  updated_at: string;
}

export const InfobipConfigManager = ({ onSaved }: { onSaved?: () => void } = {}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<InfobipConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [formData, setFormData] = useState({
    api_key: "",
    base_url: "",
    sender_number: "",
    auto_reply_enabled: true,
    session_timeout_minutes: 30,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const webhookBaseUrl = (import.meta.env.VITE_WEBHOOK_BASE_URL || import.meta.env.VITE_SUPABASE_URL) as string;
  const webhookUrl = `${webhookBaseUrl}/functions/v1/infobip-webhook`;

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("infobip_config" as any)
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const configData = data as unknown as InfobipConfig;
        setConfig(configData);
        setFormData({
          api_key: configData.api_key || "",
          base_url: configData.base_url || "",
          sender_number: configData.sender_number || "",
          auto_reply_enabled: configData.auto_reply_enabled,
          session_timeout_minutes: configData.session_timeout_minutes,
        });
      }
    } catch (error: any) {
      console.error("Error fetching Infobip config:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.api_key.trim()) {
      newErrors.api_key = "API Key is required";
    }

    if (!formData.base_url.trim()) {
      newErrors.base_url = "Base URL is required";
    } else if (formData.base_url.includes("://")) {
      newErrors.base_url = "Enter the hostname only, e.g. xxxxx.api.infobip.com (no https://)";
    }

    if (!formData.sender_number.trim()) {
      newErrors.sender_number = "Sender number is required";
    } else if (!/^\d+$/.test(formData.sender_number.trim())) {
      newErrors.sender_number = "Sender number must contain digits only (e.g. 628123456789)";
    }

    const timeout = Number(formData.session_timeout_minutes);
    if (isNaN(timeout) || timeout < 5 || timeout > 1440) {
      newErrors.session_timeout_minutes = "Timeout must be between 5 and 1440 minutes (1 day)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        api_key: formData.api_key.trim(),
        base_url: formData.base_url.trim().replace(/^https?:\/\//, ""),
        sender_number: formData.sender_number.trim(),
        auto_reply_enabled: formData.auto_reply_enabled,
        session_timeout_minutes: Number(formData.session_timeout_minutes),
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from("infobip_config" as any)
          .update(updateData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Get tenant_id from current user's profile
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", session.user.id)
          .single();

        if (!profile?.tenant_id) throw new Error("Tenant ID not found");

        // Create new config
        const { error } = await supabase
          .from("infobip_config" as any)
          .insert([{
            ...updateData,
            config_name: "default",
            is_active: true,
            tenant_id: profile.tenant_id,
          }]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Infobip configuration saved successfully",
      });

      await fetchConfig();
      onSaved?.();
    } catch (error: any) {
      console.error("Error saving Infobip config:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
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

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast({
      title: "Copied to clipboard",
      description: "Webhook URL has been copied",
    });
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!config && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No active configuration found. Create a new configuration below.
          </AlertDescription>
        </Alert>
      )}

      {config && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Configuration active. Last updated{" "}
            {formatDistanceToNow(new Date(config.updated_at), { addSuffix: true })}.
          </AlertDescription>
        </Alert>
      )}

      {/* Webhook URL Info */}
      <div className="border rounded-lg p-4 bg-muted/50">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Webhook URL</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("https://portal.infobip.com/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Infobip Portal
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste this URL in Infobip Portal → Channels &amp; Numbers → WhatsApp → [Your Number] → Inbound forwarding
          </p>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={copyWebhookUrl}
            >
              {copiedWebhook ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 space-y-6">
        {/* API Configuration Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">API Configuration</h3>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api_key">
              API Key <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="api_key"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your Infobip API key"
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
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.api_key && (
              <p className="text-sm text-destructive">{errors.api_key}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Found in Infobip Portal → Account → API Keys
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="base_url">
              Base URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="base_url"
              type="text"
              placeholder="xxxxx.api.infobip.com"
              value={formData.base_url}
              onChange={(e) => handleInputChange("base_url", e.target.value)}
              className={errors.base_url ? "border-destructive font-mono" : "font-mono"}
            />
            {errors.base_url && (
              <p className="text-sm text-destructive">{errors.base_url}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Your Infobip subdomain (without https://). Shown in your portal after login.
            </p>
          </div>
        </div>

        {/* Device Configuration Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">WhatsApp Number</h3>

          <div className="space-y-2">
            <Label htmlFor="sender_number">
              Sender Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sender_number"
              type="text"
              placeholder="628123456789"
              value={formData.sender_number}
              onChange={(e) => handleInputChange("sender_number", e.target.value)}
              className={errors.sender_number ? "border-destructive font-mono" : "font-mono"}
            />
            {errors.sender_number && (
              <p className="text-sm text-destructive">{errors.sender_number}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Your WhatsApp Business number in E.164 format without +. Found in Infobip Portal → Channels &amp; Numbers → WhatsApp.
            </p>
          </div>
        </div>

        {/* Settings Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Settings</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_reply_enabled">Enable Auto Reply</Label>
              <p className="text-sm text-muted-foreground">
                Automatically reply to incoming WhatsApp messages
              </p>
            </div>
            <Switch
              id="auto_reply_enabled"
              checked={formData.auto_reply_enabled}
              onCheckedChange={(checked) =>
                handleInputChange("auto_reply_enabled", checked)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_timeout_minutes">
              Session Timeout (minutes) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="session_timeout_minutes"
              type="number"
              min="5"
              max="1440"
              value={formData.session_timeout_minutes}
              onChange={(e) =>
                handleInputChange("session_timeout_minutes", e.target.value)
              }
              className={errors.session_timeout_minutes ? "border-destructive" : ""}
            />
            {errors.session_timeout_minutes && (
              <p className="text-sm text-destructive">
                {errors.session_timeout_minutes}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Time before a conversation session expires (5–1440 minutes)
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
