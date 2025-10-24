import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface FieldConfig {
  field_name: string;
  is_required: boolean;
  field_type: string;
  description: string;
}

export const RequestParametersDocs = () => {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFieldConfigs();
  }, []);

  const fetchFieldConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("api_field_configs")
        .select("field_name, is_required, field_type, description")
        .order("field_name");

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error("Error fetching field configs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {fields.map((field) => (
        <div
          key={field.field_name}
          className={`border-l-2 pl-3 ${
            field.is_required ? "border-primary" : "border-muted"
          }`}
        >
          <p className="font-medium">
            {field.field_name}{" "}
            {field.is_required && (
              <span className="text-destructive">*</span>
            )}
          </p>
          <p className="text-muted-foreground">
            {field.field_type} - {field.description}
          </p>
        </div>
      ))}
    </div>
  );
};
