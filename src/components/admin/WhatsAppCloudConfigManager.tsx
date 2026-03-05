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

interface WhatsAppCloudConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  phone_number_id: string | null;
  access_token: string | null;
  verify_token: string | null;
  app_secret: string | null;
  auto_reply_enabled: boolean;
  session_timeout_minutes: number;
  updated_at: string;
}

export const WhatsAppCloudConfigManager = ({ onSaved }: { onSaved?: () => void } = {}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WhatsAppCloudConfig | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [formData, setFormData] = useState({
    phone_number_id: "",
    access_token: "",
    verify_token: "",
    app_secret: "",
    auto_reply_enabled: true,
    session_timeout_minutes: 30,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const webhookBaseUrl = (import.meta.env.VITE_WEBHOOK_BASE_URL || import.meta.env.VITE_SUPABASE_URL) as string;
  const webhookUrl = `${webhookBaseUrl}/functions/v1/whatsapp-cloud-webhook`;

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("whatsapp_cloud_config" as any)
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const configData = data as unknown as WhatsAppCloudConfig;
        setConfig(configData);
        setFormData({
          phone_number_id: configData.phone_number_id || "",
          access_token: configData.access_token || "",
          verify_token: configData.verify_token || "",
          app_secret: configData.app_secret || "",
          auto_reply_enabled: configData.auto_reply_enabled,
          session_timeout_minutes: configData.session_timeout_minutes,
        });
      }
    } catch (error: any) {
      console.error("Error fetching WhatsApp Cloud config:", error);
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

    if (!formData.phone_number_id.trim()) {
      newErrors.phone_number_id = "Phone Number ID is required";
    } else if (!/^\d+$/.test(formData.phone_number_id.trim())) {
      newErrors.phone_number_id = "Phone Number ID must contain digits only";
    }

    if (!formData.access_token.trim()) {
      newErrors.access_token = "Access Token is required";
    }

    if (!formData.verify_token.trim()) {
      newErrors.verify_token = "Verify Token is required";
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
        phone_number_id: formData.phone_number_id.trim(),
        access_token: formData.access_token.trim(),
        verify_token: formData.verify_token.trim(),
        app_secret: formData.app_secret.trim() || null,
        auto_reply_enabled: formData.auto_reply_enabled,
        session_timeout_minutes: Number(formData.session_timeout_minutes),
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from("whatsapp_cloud_config" as any)
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
          .from("whatsapp_cloud_config" as any)
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
        description: "WhatsApp Cloud configuration saved successfully",
      });

      await fetchConfig();
      onSaved?.();
    } catch (error: any) {
      console.error("Error saving WhatsApp Cloud config:", error);
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
              onClick={() => window.open("https://developers.facebook.com/apps/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Meta Developer Portal
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste this URL in Meta Developer Portal → WhatsApp → Configuration → Webhook.
            Use your Verify Token below when registering.
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
        {/* Phone Number Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Phone Number</h3>

          {/* Phone Number ID */}
          <div className="space-y-2">
            <Label htmlFor="phone_number_id">
              Phone Number ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone_number_id"
              type="text"
              placeholder="123456789012345"
              value={formData.phone_number_id}
              onChange={(e) => handleInputChange("phone_number_id", e.target.value)}
              className={errors.phone_number_id ? "border-destructive font-mono" : "font-mono"}
            />
            {errors.phone_number_id && (
              <p className="text-sm text-destructive">{errors.phone_number_id}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Found in Meta Developer Portal → WhatsApp → API Setup → From (select your number).
            </p>
          </div>
        </div>

        {/* API Credentials */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">API Credentials</h3>

          {/* Access Token */}
          <div className="space-y-2">
            <Label htmlFor="access_token">
              Access Token <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="access_token"
                type={showAccessToken ? "text" : "password"}
                placeholder="EAAxxxxxxxxxx..."
                value={formData.access_token}
                onChange={(e) => handleInputChange("access_token", e.target.value)}
                className={errors.access_token ? "border-destructive pr-10" : "pr-10"}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowAccessToken(!showAccessToken)}
              >
                {showAccessToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.access_token && (
              <p className="text-sm text-destructive">{errors.access_token}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Use a Permanent System User Token from Meta Business Manager → System Users for production.
            </p>
          </div>

          {/* Verify Token */}
          <div className="space-y-2">
            <Label htmlFor="verify_token">
              Verify Token <span className="text-destructive">*</span>
            </Label>
            <Input
              id="verify_token"
              type="text"
              placeholder="lapor_waba_2026"
              value={formData.verify_token}
              onChange={(e) => handleInputChange("verify_token", e.target.value)}
              className={errors.verify_token ? "border-destructive font-mono" : "font-mono"}
            />
            {errors.verify_token && (
              <p className="text-sm text-destructive">{errors.verify_token}</p>
            )}
            <p className="text-sm text-muted-foreground">
              A custom secret string you define. Enter the same value in Meta Developer Portal
              when registering the webhook above.
            </p>
          </div>

          {/* App Secret (optional) */}
          <div className="space-y-2">
            <Label htmlFor="app_secret">
              App Secret{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                id="app_secret"
                type={showAppSecret ? "text" : "password"}
                placeholder="Optional — for webhook payload verification"
                value={formData.app_secret}
                onChange={(e) => handleInputChange("app_secret", e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowAppSecret(!showAppSecret)}
              >
                {showAppSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Found in Meta Developer Portal → App Settings → Basic. Used for payload signature
              verification if enabled.
            </p>
          </div>
        </div>

        {/* Settings */}
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
