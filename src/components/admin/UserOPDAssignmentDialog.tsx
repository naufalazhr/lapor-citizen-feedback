import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Building2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OPD {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface UserOPDAssignmentDialogProps {
  user: {
    id: string;
    email: string;
    full_name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UserOPDAssignmentDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserOPDAssignmentDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [opds, setOpds] = useState<OPD[]>([]);
  const [selectedOPDs, setSelectedOPDs] = useState<Set<string>>(new Set());
  const [currentAssignments, setCurrentAssignments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchOPDs();
      fetchCurrentAssignments();
    }
  }, [open, user.id]);

  const fetchOPDs = async () => {
    try {
      const { data, error } = await supabase
        .from("opds")
        .select("id, name, code, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setOpds(data || []);
    } catch (error: any) {
      console.error("Error fetching OPDs:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data OPD",
        variant: "destructive",
      });
    }
  };

  const fetchCurrentAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("user_opd_assignments")
        .select("opd_id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      
      const assignedOPDIds = new Set(data?.map(a => a.opd_id) || []);
      setCurrentAssignments(assignedOPDIds);
      setSelectedOPDs(new Set(assignedOPDIds));
    } catch (error: any) {
      console.error("Error fetching assignments:", error);
    }
  };

  const toggleOPD = (opdId: string) => {
    const newSelected = new Set(selectedOPDs);
    if (newSelected.has(opdId)) {
      newSelected.delete(opdId);
    } else {
      newSelected.add(opdId);
    }
    setSelectedOPDs(newSelected);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Deactivate all current assignments
      if (currentAssignments.size > 0) {
        const { error: deactivateError } = await supabase
          .from("user_opd_assignments")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (deactivateError) throw deactivateError;
      }

      // Insert new assignments
      if (selectedOPDs.size > 0) {
        const assignments = Array.from(selectedOPDs).map(opdId => ({
          user_id: user.id,
          opd_id: opdId,
          assigned_by: session.user.id,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from("user_opd_assignments")
          .upsert(assignments, {
            onConflict: "user_id,opd_id",
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Berhasil",
        description: "Penugasan OPD berhasil diperbarui",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving assignments:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan penugasan OPD",
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
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tugaskan ke OPD
          </DialogTitle>
          <DialogDescription>
            Pilih OPD untuk {user.full_name || user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedOPDs.size > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
              {Array.from(selectedOPDs).map(opdId => {
                const opd = opds.find(o => o.id === opdId);
                if (!opd) return null;
                return (
                  <Badge key={opdId} variant="secondary" className="gap-1">
                    {opd.code}
                    <button
                      onClick={() => toggleOPD(opdId)}
                      className="ml-1 hover:bg-destructive/20 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <ScrollArea className="h-[300px] border rounded-lg p-4">
            <div className="space-y-3">
              {opds.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Tidak ada OPD aktif
                </p>
              ) : (
                opds.map((opd) => (
                  <div
                    key={opd.id}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => toggleOPD(opd.id)}
                  >
                    <Checkbox
                      checked={selectedOPDs.has(opd.id)}
                      onCheckedChange={() => toggleOPD(opd.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{opd.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {opd.code}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-sm">
            <p className="text-blue-900 dark:text-blue-100">
              <strong>Info:</strong> User dengan role "OPD Member" hanya dapat melihat 
              dan mengelola laporan yang didisposisikan ke OPD mereka.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
