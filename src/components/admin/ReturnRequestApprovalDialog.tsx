import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReturnRequest {
  id: string;
  report_id: string;
  requested_by: string;
  requested_at: string;
  notes: string;
  status: string;
  reports: {
    ticket_id: string;
    reporter_name: string;
    description: string;
    type: string;
    status: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

interface ReturnRequestApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ReturnRequest | null;
  onSuccess: () => void;
}

export function ReturnRequestApprovalDialog({
  open,
  onOpenChange,
  request,
  onSuccess,
}: ReturnRequestApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!request) return null;

  const handleApprove = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('approve_report_return', {
        p_request_id: request.id,
        p_approved: true
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve return request');
      }

      toast.success("Permintaan Disetujui", {
        description: "Laporan berhasil dikembalikan ke pool Member",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error approving return request:", error);
      toast.error("Gagal menyetujui permintaan", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Alasan penolakan harus diisi");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('approve_report_return', {
        p_request_id: request.id,
        p_approved: false,
        p_rejection_reason: rejectionReason
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to reject return request');
      }

      toast.success("Permintaan Ditolak", {
        description: "Permintaan pengembalian telah ditolak",
      });

      onSuccess();
      onOpenChange(false);
      setShowRejectForm(false);
      setRejectionReason("");
    } catch (error: any) {
      console.error("Error rejecting return request:", error);
      toast.error("Gagal menolak permintaan", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tinjau Permintaan Pengembalian</DialogTitle>
          <DialogDescription>
            Setujui atau tolak permintaan pengembalian laporan ke pool Member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Info */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{request.reports.ticket_id}</h4>
                <p className="text-sm text-muted-foreground">{request.reports.reporter_name}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{request.reports.type}</Badge>
                <Badge>{request.reports.status}</Badge>
              </div>
            </div>
            <p className="text-sm">{request.reports.description}</p>
          </div>

          {/* Request Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Diajukan oleh:</span>
              <span className="font-medium">{request.profiles.full_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{request.profiles.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tanggal:</span>
              <span className="font-medium">
                {format(new Date(request.requested_at), 'dd MMM yyyy HH:mm')}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan dari OPD Member:</Label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{request.notes}</p>
            </div>
          </div>

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Alasan Penolakan *</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan..."
                rows={3}
              />
            </div>
          )}

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {showRejectForm 
                ? "Permintaan akan ditolak dan OPD tetap menangani laporan ini."
                : "Setelah disetujui, laporan akan dikembalikan ke pool Member dan OPD tidak lagi bertanggung jawab."
              }
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              setShowRejectForm(false);
              setRejectionReason("");
            }}
            disabled={loading}
          >
            Batal
          </Button>
          
          {!showRejectForm ? (
            <>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Tolak
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                Setujui
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason("");
                }}
                disabled={loading}
              >
                Kembali
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Konfirmasi Tolak
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
