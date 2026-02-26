import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Save, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FlowiseConfig {
  id: string;
  config_name: string;
  is_active: boolean;
  api_url: string;
  api_key: string;
  chatflow_id: string;
  streaming: boolean;
  timeout_seconds: number;
  session_variables: Record<string, any> | null;
  updated_at: string;
}

export const FlowiseConfigManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FlowiseConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    api_url: "",
    api_key: "",
    chatflow_id: "",
    streaming: false,
    timeout_seconds: 30,
    session_variables: "",
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
        .from("flowise_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const configData = {
          ...data,
          session_variables: data.session_variables as Record<string, any> | null
        };
        setConfig(configData);
        setFormData({
          api_url: data.api_url,
          api_key: data.api_key,
          chatflow_id: data.chatflow_id,
          streaming: data.streaming,
          timeout_seconds: data.timeout_seconds,
          session_variables: data.session_variables
            ? JSON.stringify(data.session_variables, null, 2)
            : "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching Flowise config:", error);
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

    // Validate API URL
    if (!formData.api_url.trim()) {
      newErrors.api_url = "API URL is required";
    } else {
      try {
        new URL(formData.api_url);
      } catch {
        newErrors.api_url = "Invalid URL format";
      }
    }

    // Validate API Key
    if (!formData.api_key.trim()) {
      newErrors.api_key = "API Key is required";
    }

    // Validate Chatflow ID
    if (!formData.chatflow_id.trim()) {
      newErrors.chatflow_id = "Chatflow ID is required";
    }

    // Validate timeout
    const timeout = Number(formData.timeout_seconds);
    if (isNaN(timeout) || timeout < 10 || timeout > 120) {
      newErrors.timeout_seconds = "Timeout must be between 10 and 120 seconds";
    }

    // Validate session variables JSON
    if (formData.session_variables.trim()) {
      try {
        JSON.parse(formData.session_variables);
      } catch {
        newErrors.session_variables = "Invalid JSON format";
      }
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
        api_url: formData.api_url.trim(),
        api_key: formData.api_key.trim(),
        chatflow_id: formData.chatflow_id.trim(),
        streaming: formData.streaming,
        timeout_seconds: Number(formData.timeout_seconds),
        session_variables: formData.session_variables.trim()
          ? JSON.parse(formData.session_variables)
          : null,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        // Update existing config
        const { error } = await supabase
          .from("flowise_config")
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
        const { error } = await supabase.from("flowise_config").insert([{
          api_url: formData.api_url.trim(),
          api_key: formData.api_key.trim(),
          chatflow_id: formData.chatflow_id.trim(),
          streaming: formData.streaming,
          timeout_seconds: Number(formData.timeout_seconds),
          session_variables: formData.session_variables.trim()
            ? JSON.parse(formData.session_variables)
            : null,
          config_name: "default",
          is_active: true,
          tenant_id: profile.tenant_id,
        }]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Flowise configuration saved successfully",
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

      <div className="border rounded-lg p-6 space-y-6">
        {/* API Configuration Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">API Configuration</h3>

          <div className="space-y-2">
            <Label htmlFor="api_url">
              API URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="api_url"
              type="url"
              placeholder="https://your-flowise-instance.com"
              value={formData.api_url}
              onChange={(e) => handleInputChange("api_url", e.target.value)}
              className={errors.api_url ? "border-destructive" : ""}
            />
            {errors.api_url && (
              <p className="text-sm text-destructive">{errors.api_url}</p>
            )}
            <p className="text-sm text-muted-foreground">
              The base URL of your Flowise instance
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">
              API Key <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="api_key"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your Flowise API key"
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
              Bearer token for Flowise API authentication
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatflow_id">
              Chatflow ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="chatflow_id"
              type="text"
              placeholder="487749ef-c4cd-4e17-b7a2-ec6376e482ea"
              value={formData.chatflow_id}
              onChange={(e) => handleInputChange("chatflow_id", e.target.value)}
              className={errors.chatflow_id ? "border-destructive" : ""}
            />
            {errors.chatflow_id && (
              <p className="text-sm text-destructive">{errors.chatflow_id}</p>
            )}
            <p className="text-sm text-muted-foreground">
              The ID of the chatflow to use for conversations
            </p>
          </div>
        </div>

        {/* Settings Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Settings</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="streaming">Enable Streaming</Label>
              <p className="text-sm text-muted-foreground">
                Stream responses from Flowise in real-time
              </p>
            </div>
            <Switch
              id="streaming"
              checked={formData.streaming}
              onCheckedChange={(checked) => handleInputChange("streaming", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout_seconds">
              Timeout (seconds) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="timeout_seconds"
              type="number"
              min="10"
              max="120"
              value={formData.timeout_seconds}
              onChange={(e) =>
                handleInputChange("timeout_seconds", e.target.value)
              }
              className={errors.timeout_seconds ? "border-destructive" : ""}
            />
            {errors.timeout_seconds && (
              <p className="text-sm text-destructive">{errors.timeout_seconds}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Maximum time to wait for Flowise response (10-120 seconds)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_variables">
              Session Variables (Optional)
            </Label>
            <Textarea
              id="session_variables"
              placeholder='{"key": "value"}'
              rows={4}
              value={formData.session_variables}
              onChange={(e) =>
                handleInputChange("session_variables", e.target.value)
              }
              className={
                errors.session_variables ? "border-destructive font-mono" : "font-mono"
              }
            />
            {errors.session_variables && (
              <p className="text-sm text-destructive">{errors.session_variables}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Additional variables to pass to Flowise (JSON format)
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
