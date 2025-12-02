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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const dispositionFormSchema = z.object({
  opd_id: z.string().min(1, "Pilih OPD tujuan"),
  notes: z.string().optional(),
  status_after: z.string().optional(),
});

type DispositionFormValues = z.infer<typeof dispositionFormSchema>;

interface OPD {
  id: string;
  name: string;
  code: string;
}

interface Report {
  id: string;
  ticket_id: string;
  status: string;
  assigned_opd_id: string | null;
}

interface ReportDispositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: Report[];
  onSuccess: () => void;
}

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "Dalam Proses" },
  { value: "resolved", label: "Selesai" },
  { value: "rejected", label: "Ditolak" },
];

export function ReportDispositionDialog({
  open,
  onOpenChange,
  reports,
  onSuccess,
}: ReportDispositionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [opds, setOpds] = useState<OPD[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const form = useForm<DispositionFormValues>({
    resolver: zodResolver(dispositionFormSchema),
    defaultValues: {
      opd_id: "",
      notes: "",
      status_after: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchOPDs();
      fetchTenantId();
      form.reset({
        opd_id: "",
        notes: "",
        status_after: "",
      });
    }
  }, [open]);

  const fetchTenantId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setTenantId(data.tenant_id);
    }
  };

  const fetchOPDs = async () => {
    try {
      console.log("🔍 Fetching OPDs...");
      const { data, error, status, statusText } = await supabase
        .from("opds")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name", { ascending: true });

      console.log("📊 OPDs fetch result:", {
        data,
        error,
        status,
        statusText,
        count: data?.length || 0
      });

      if (error) {
        console.error("❌ OPDs fetch error:", error);
        throw error;
      }
      setOpds(data || []);
      console.log("✅ OPDs set:", data?.length || 0, "items");
    } catch (error: any) {
      console.error("❌ Error fetching OPDs:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data OPD: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: DispositionFormValues) => {
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

      // Process each report
      for (const report of reports) {
        const previousOPDId = report.assigned_opd_id;
        const statusBefore = report.status;
        const statusAfter = values.status_after || statusBefore;

        // Update report
        const { error: updateError } = await supabase
          .from("reports")
          .update({
            assigned_opd_id: values.opd_id,
            disposition_notes: values.notes || null,
            status: statusAfter as any,
          })
          .eq("id", report.id);

        if (updateError) throw updateError;

        // Create disposition record (timeline entry)
        const { error: dispositionError } = await supabase
          .from("report_dispositions")
          .insert({
            report_id: report.id,
            opd_id: values.opd_id,
            previous_opd_id: previousOPDId,
            assigned_by: session.user.id,
            status_before: statusBefore,
            status_after: statusAfter,
            notes: values.notes || null,
            action_type: "disposition",
            tenant_id: tenantId,
          });

        if (dispositionError) throw dispositionError;
      }

      toast({
        title: "Berhasil",
        description: `${reports.length} laporan berhasil didisposisikan`,
      });

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error("Error creating disposition:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal mendisposisikan laporan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Disposisi Laporan</DialogTitle>
          <DialogDescription>
            Disposisikan {reports.length} laporan ke OPD
          </DialogDescription>
        </DialogHeader>

        {reports.length > 0 && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-2">Laporan yang dipilih:</p>
            <div className="flex flex-wrap gap-2">
              {reports.slice(0, 5).map((report) => (
                <Badge key={report.id} variant="secondary">
                  {report.ticket_id}
                </Badge>
              ))}
              {reports.length > 5 && (
                <Badge variant="secondary">+{reports.length - 5} lainnya</Badge>
              )}
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="opd_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OPD Tujuan *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih OPD..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {opds.map((opd) => (
                        <SelectItem key={opd.id} value={opd.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{opd.code}</span>
                            <span className="text-muted-foreground">-</span>
                            <span>{opd.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Pilih OPD yang akan menangani laporan</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status_after"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubah Status (Opsional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Biarkan status saat ini..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Kosongkan untuk mempertahankan status saat ini</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan Disposisi</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tambahkan catatan atau instruksi untuk OPD..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Catatan akan ditampilkan di timeline disposisi
                  </FormDescription>
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
              <Button type="submit" disabled={loading || opds.length === 0}>
                {loading ? "Memproses..." : "Disposisikan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
