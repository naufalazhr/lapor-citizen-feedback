import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Save, AlertCircle, CheckCircle, Copy, Check, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FonnteConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  api_token: string | null;
  device_numbers: string[];
  auto_reply_enabled: boolean;
  session_timeout_minutes: number;
  updated_at: string;
}

export const FonnteConfigManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FonnteConfig | null>(null);
  const [showApiToken, setShowApiToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [formData, setFormData] = useState({
    api_token: "",
    device_numbers: "",
    auto_reply_enabled: true,
    session_timeout_minutes: 30,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const webhookUrl = "https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook";

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fonnte_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        const configData = {
          ...data,
          api_token: (data as any).api_token || null
        };
        setConfig(configData);
        setFormData({
          api_token: (data as any).api_token || "",
          device_numbers: data.device_numbers.join(", "),
          auto_reply_enabled: data.auto_reply_enabled,
          session_timeout_minutes: data.session_timeout_minutes,
        });
      }
    } catch (error: any) {
      console.error("Error fetching Fonnte config:", error);
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

    // Validate API Token
    if (!formData.api_token.trim()) {
      newErrors.api_token = "API Token is required";
    }

    // Validate device numbers
    if (!formData.device_numbers.trim()) {
      newErrors.device_numbers = "At least one device number is required";
    } else {
      const numbers = formData.device_numbers
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      if (numbers.length === 0) {
        newErrors.device_numbers = "At least one device number is required";
      }
    }

    // Validate session timeout
    const timeout = Number(formData.session_timeout_minutes);
    if (isNaN(timeout) || timeout < 5 || timeout > 1440) {
      newErrors.session_timeout_minutes =
        "Timeout must be between 5 and 1440 minutes (1 day)";
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

      // Parse device numbers
      const deviceNumbers = formData.device_numbers
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      const updateData = {
        api_token: formData.api_token.trim(),
        device_numbers: deviceNumbers,
        auto_reply_enabled: formData.auto_reply_enabled,
        session_timeout_minutes: Number(formData.session_timeout_minutes),
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from("fonnte_config")
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
        const { error } = await supabase.from("fonnte_config").insert([{
          api_token: formData.api_token.trim(),
          device_numbers: deviceNumbers,
          auto_reply_enabled: formData.auto_reply_enabled,
          session_timeout_minutes: Number(formData.session_timeout_minutes),
          config_name: "default",
          is_active: true,
          tenant_id: profile.tenant_id,
        }]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Fonnte configuration saved successfully",
      });

      // Refresh config
      await fetchConfig();
    } catch (error: any) {
      console.error("Error saving config:", error);
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
    // Clear error for this field
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
              onClick={() => window.open("https://fonnte.com/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Fonnte Dashboard
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure this URL in your Fonnte dashboard webhook settings
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

          <div className="space-y-2">
            <Label htmlFor="api_token">
              API Token <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="api_token"
                type={showApiToken ? "text" : "password"}
                placeholder="Enter your Fonnte API token"
                value={formData.api_token}
                onChange={(e) => handleInputChange("api_token", e.target.value)}
                className={errors.api_token ? "border-destructive pr-10" : "pr-10"}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowApiToken(!showApiToken)}
              >
                {showApiToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.api_token && (
              <p className="text-sm text-destructive">{errors.api_token}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Your Fonnte API token for authentication
            </p>
          </div>
        </div>

        {/* Device Configuration Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Device Configuration</h3>

          <div className="space-y-2">
            <Label htmlFor="device_numbers">
              Device Numbers <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="device_numbers"
              placeholder="628123456789, 628987654321"
              rows={3}
              value={formData.device_numbers}
              onChange={(e) => handleInputChange("device_numbers", e.target.value)}
              className={errors.device_numbers ? "border-destructive font-mono" : "font-mono"}
            />
            {errors.device_numbers && (
              <p className="text-sm text-destructive">{errors.device_numbers}</p>
            )}
            <p className="text-sm text-muted-foreground">
              WhatsApp device numbers (comma-separated)
            </p>
          </div>

          {config && config.device_numbers.length > 0 && (
            <div className="space-y-2">
              <Label>Configured Devices:</Label>
              <div className="flex flex-wrap gap-2">
                {config.device_numbers.map((number, index) => (
                  <Badge key={index} variant="secondary">
                    {number}
                  </Badge>
                ))}
              </div>
            </div>
          )}
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
              Time before a conversation session expires (5-1440 minutes)
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
