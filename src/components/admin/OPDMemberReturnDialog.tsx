import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const returnFormSchema = z.object({
  notes: z.string().min(1, "Catatan wajib diisi"),
});

type ReturnFormValues = z.infer<typeof returnFormSchema>;

interface Report {
  id: string;
  ticket_id: string;
  status: string;
  assigned_opd_id: string | null;
}

interface OPDMemberReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: Report[];
  onSuccess: () => void;
}

export function OPDMemberReturnDialog({
  open,
  onOpenChange,
  reports,
  onSuccess,
}: OPDMemberReturnDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchTenantId();
      form.reset({ notes: "" });
    }
  }, [open]);

  const fetchTenantId = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        return;
      }
      
      if (!session) {
        console.error("No session found");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error fetching tenant_id:", error);
        toast({
          title: "Error",
          description: "Gagal mengambil informasi tenant",
          variant: "destructive",
        });
        return;
      }

      if (data?.tenant_id) {
        setTenantId(data.tenant_id);
        console.log("Tenant ID fetched successfully:", data.tenant_id);
      } else {
        console.error("No tenant_id found in profile");
        toast({
          title: "Error",
          description: "Profil pengguna tidak memiliki tenant_id. Hubungi administrator.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Unexpected error fetching tenant_id:", error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat mengambil informasi tenant",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: ReturnFormValues) => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "Tenant ID tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Process each report using the secure function
      for (const report of reports) {
        if (!report.assigned_opd_id) {
          console.warn(`Report ${report.id} has no assigned OPD, skipping`);
          continue;
        }

        // Call the secure function to return the report
        const { data, error } = await supabase.rpc('opd_return_report', {
          p_report_id: report.id,
          p_notes: values.notes
        });

        if (error) {
          console.error('Error calling opd_return_report:', error);
          throw error;
        }

        if (data && !data.success) {
          console.error('Function returned error:', data.error);
          throw new Error(data.error || 'Failed to return report');
        }
      }

      toast({
        title: "Berhasil",
        description: `${reports.length} laporan berhasil dikembalikan ke Member`,
      });

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error("Error returning reports:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengembalikan laporan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Kembalikan Laporan ke Member</DialogTitle>
          <DialogDescription>
            Kembalikan laporan yang dipilih kembali ke pool Member untuk ditindaklanjuti
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Warning Alert */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                    Perhatian
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Laporan akan dikembalikan ke pool Member dan status OPD akan dihapus. 
                    Member dapat melakukan disposisi ulang.
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Reports */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Laporan yang Dipilih:</label>
              <div className="flex flex-wrap gap-2">
                {reports.map((report) => (
                  <Badge key={report.id} variant="secondary">
                    {report.ticket_id}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Notes Field - Required */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Catatan Pengembalian <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Jelaskan alasan pengembalian laporan ini ke Member..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Memproses..." : "Kembalikan ke Member"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
