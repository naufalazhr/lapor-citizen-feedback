import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimelineEntry {
  id: string;
  timestamp: string;
  action_type: string;
  status_before: string | null;
  status_after: string | null;
  opd: {
    name: string;
    code: string;
  } | null;
  previous_opd: {
    name: string;
    code: string;
  } | null;
}

export interface PublicReportData {
  ticket_id: string;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  type: "lapor" | "aspirasi";
  created_at: string;
  updated_at: string;
  current_opd: {
    name: string;
    code: string;
  } | null;
  timeline: TimelineEntry[];
}

interface UsePublicTrackingReturn {
  data: PublicReportData | null;
  loading: boolean;
  error: string | null;
  trackReport: (ticketId: string) => Promise<void>;
  reset: () => void;
}

export const usePublicTracking = (): UsePublicTrackingReturn => {
  const [data, setData] = useState<PublicReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackReport = useCallback(async (ticketId: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Normalize ticket ID: trim whitespace and convert to uppercase
      const normalizedTicketId = ticketId.trim().toUpperCase();

      if (!normalizedTicketId) {
        setError("ID Tiket tidak boleh kosong");
        return;
      }

      // Call the database function
      const { data: result, error: dbError } = await supabase
        .rpc('get_public_report_tracking', { p_ticket_id: normalizedTicketId });

      if (dbError) {
        console.error("Database error:", dbError);
        setError("Terjadi kesalahan saat mencari laporan. Silakan coba lagi.");
        return;
      }

      if (!result) {
        setError("Laporan tidak ditemukan. Pastikan ID Tiket sudah benar.");
        return;
      }

      setData(result as PublicReportData);
    } catch (err) {
      console.error("Tracking error:", err);
      setError("Terjadi kesalahan saat mencari laporan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, trackReport, reset };
};
