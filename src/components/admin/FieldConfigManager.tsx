import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface FieldConfig {
  id: string;
  field_name: string;
  is_required: boolean;
  field_type: string;
  description: string;
  default_value: any;
}

export const FieldConfigManager = () => {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDefaults, setEditingDefaults] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchFieldConfigs();
  }, []);

  const fetchFieldConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("api_field_configs")
        .select("*")
        .order("field_name");

      if (error) throw error;
      setFields(data || []);
      
      // Initialize editing defaults
      const defaults: Record<string, string> = {};
      data?.forEach(field => {
        if (field.default_value !== null) {
          defaults[field.id] = typeof field.default_value === 'string' 
            ? field.default_value 
            : JSON.stringify(field.default_value);
        }
      });
      setEditingDefaults(defaults);
    } catch (error) {
      console.error("Error fetching field configs:", error);
      toast({
        title: "Error",
        description: "Failed to load field configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRequired = async (fieldId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("api_field_configs")
        .update({ is_required: !currentValue })
        .eq("id", fieldId);

      if (error) throw error;

      setFields(
        fields.map((field) =>
          field.id === fieldId
            ? { ...field, is_required: !currentValue }
            : field
        )
      );

      toast({
        title: "Updated",
        description: "Field requirement updated successfully",
      });
    } catch (error) {
      console.error("Error updating field:", error);
      toast({
        title: "Error",
        description: "Failed to update field configuration",
        variant: "destructive",
      });
    }
  };

  const updateDefaultValue = async (fieldId: string, fieldName: string) => {
    try {
      const defaultValue = editingDefaults[fieldId];
      let parsedValue = null;

      if (defaultValue && defaultValue.trim()) {
        try {
          // Try to parse as JSON for objects
          parsedValue = JSON.parse(defaultValue);
        } catch {
          // If parsing fails, treat as string
          parsedValue = defaultValue;
        }
      }

      const { error } = await supabase
        .from("api_field_configs")
        .update({ default_value: parsedValue })
        .eq("id", fieldId);

      if (error) throw error;

      setFields(
        fields.map((field) =>
          field.id === fieldId
            ? { ...field, default_value: parsedValue }
            : field
        )
      );

      toast({
        title: "Updated",
        description: `Default value for ${fieldName} updated successfully`,
      });
    } catch (error) {
      console.error("Error updating default value:", error);
      toast({
        title: "Error",
        description: "Failed to update default value",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Configure which fields are required for API submissions. Changes apply immediately to all API requests.
      </div>
      {fields.map((field) => (
        <div
          key={field.id}
          className="p-4 border rounded-lg space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor={field.id} className="font-medium cursor-pointer">
                  {field.field_name}
                </Label>
                <span className="text-xs text-muted-foreground">
                  ({field.field_type})
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {field.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor={field.id}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Required
              </Label>
              <Switch
                id={field.id}
                checked={field.is_required}
                onCheckedChange={() => toggleRequired(field.id, field.is_required)}
              />
            </div>
          </div>
          
          {/* Default Value Configuration */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Default Value (when empty)
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={
                  field.field_type === 'object' 
                    ? '{"lat": -6.2088, "lng": 106.8456}' 
                    : 'Enter default value'
                }
                value={editingDefaults[field.id] || ''}
                onChange={(e) =>
                  setEditingDefaults({
                    ...editingDefaults,
                    [field.id]: e.target.value,
                  })
                }
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => updateDefaultValue(field.id, field.field_name)}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
            {field.default_value && (
              <p className="text-xs text-muted-foreground">
                Current: {typeof field.default_value === 'string' 
                  ? field.default_value 
                  : JSON.stringify(field.default_value)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
