import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
        Berikut adalah field yang tersedia dalam payload API pengiriman laporan. Konfigurasi field bersifat tetap dan tidak dapat diubah.
      </div>
      {fields.map((field) => (
        <div
          key={field.id}
          className="p-4 border rounded-lg space-y-1"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {field.field_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({field.field_type})
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {field.description}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              field.is_required
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {field.is_required ? 'Wajib' : 'Opsional'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
