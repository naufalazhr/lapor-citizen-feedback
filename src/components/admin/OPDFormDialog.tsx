import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const opdFormSchema = z.object({
  name: z.string().min(1, "Nama OPD harus diisi"),
  code: z.string().min(1, "Kode OPD harus diisi").max(20, "Kode maksimal 20 karakter"),
  description: z.string().optional(),
  head_name: z.string().optional(),
  contact_email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  is_active: z.boolean().default(true),
});

type OPDFormValues = z.infer<typeof opdFormSchema>;

interface OPD {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  head_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

interface OPDFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opd: OPD | null;
  onSuccess: () => void;
}

export function OPDFormDialog({ open, onOpenChange, opd, onSuccess }: OPDFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const form = useForm<OPDFormValues>({
    resolver: zodResolver(opdFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      head_name: "",
      contact_email: "",
      contact_phone: "",
      is_active: true,
    },
  });

  useEffect(() => {
    fetchTenantId();
  }, []);

  useEffect(() => {
    if (opd) {
      form.reset({
        name: opd.name,
        code: opd.code,
        description: opd.description || "",
        head_name: opd.head_name || "",
        contact_email: opd.contact_email || "",
        contact_phone: opd.contact_phone || "",
        is_active: opd.is_active,
      });
    } else {
      form.reset({
        name: "",
        code: "",
        description: "",
        head_name: "",
        contact_email: "",
        contact_phone: "",
        is_active: true,
      });
    }
  }, [opd, form]);

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

  const onSubmit = async (values: OPDFormValues) => {
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

      const opdData = {
        name: values.name,
        code: values.code,
        is_active: values.is_active,
        tenant_id: tenantId,
        description: values.description || null,
        head_name: values.head_name || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
      };

      if (opd) {
        // Update existing OPD
        const { error } = await supabase
          .from("opds")
          .update(opdData)
          .eq("id", opd.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "OPD berhasil diperbarui",
        });
      } else {
        // Create new OPD
        const { error } = await supabase
          .from("opds")
          .insert([opdData]);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "OPD berhasil ditambahkan",
        });
      }

      onSuccess();
      form.reset();
    } catch (error: any) {
      console.error("Error saving OPD:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan OPD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{opd ? "Edit OPD" : "Tambah OPD Baru"}</DialogTitle>
          <DialogDescription>
            {opd ? "Perbarui informasi OPD" : "Masukkan informasi OPD baru"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode OPD *</FormLabel>
                    <FormControl>
                      <Input placeholder="DISDIK" {...field} />
                    </FormControl>
                    <FormDescription>Kode singkat (maks. 20 karakter)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama OPD *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dinas Pendidikan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Deskripsi singkat tentang OPD..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="head_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Kepala OPD</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Ahmad Suryadi, M.Pd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Telepon</FormLabel>
                    <FormControl>
                      <Input placeholder="0271-123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="disdik@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Status Aktif</FormLabel>
                    <FormDescription>
                      OPD yang aktif dapat menerima disposisi laporan
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
                {loading ? "Menyimpan..." : opd ? "Perbarui" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
