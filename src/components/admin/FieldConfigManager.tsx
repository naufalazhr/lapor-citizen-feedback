import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface FieldConfig {
  id: string;
  field_name: string;
  is_required: boolean;
  field_type: string;
  description: string;
}

export const FieldConfigManager = () => {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
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
          className="flex items-center justify-between p-4 border rounded-lg"
        >
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
      ))}
    </div>
  );
};
