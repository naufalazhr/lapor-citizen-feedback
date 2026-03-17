import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./use-user-role";

// Helper to fetch all rows from a Supabase table (bypasses 1000-row default limit)
const fetchAllRows = async <T,>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> => {
  const allRows: T[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allRows.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allRows;
};

export interface DashboardReport {
  id: string;
  ticket_id: string;
  reporter_name: string;
  type: "lapor" | "aspirasi";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
  updated_at: string;
  assigned_opd_id: string | null;
  geo_location?: { lat: number; lng: number } | null;
  opds?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface DashboardDisposition {
  id: string;
  report_id: string;
  opd_id: string;
  previous_opd_id: string | null;
  assigned_by: string;
  assigned_at: string;
  action_type: string;
  status_before: string | null;
  status_after: string | null;
  notes: string | null;
  opds?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface DashboardData {
  reports: DashboardReport[];
  dispositions: DashboardDisposition[];
  loading: boolean;
  error: string | null;
}

export const useDashboardData = () => {
  const { role } = useUserRole();
  const [data, setData] = useState<DashboardData>({
    reports: [],
    dispositions: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  const fetchDashboardData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setData(prev => ({ ...prev, loading: false, error: "Not authenticated" }));
        return;
      }

      // Get user's tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single();

      if (!profile?.tenant_id) {
        setData(prev => ({ ...prev, loading: false, error: "No tenant found" }));
        return;
      }

      // Role-based filtering for OPD members
      let opdIds: string[] | null = null;
      if (role === 'opd_member') {
        const { data: assignments } = await supabase
          .from('user_opd_assignments')
          .select('opd_id')
          .eq('user_id', session.user.id)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          opdIds = assignments.map(a => a.opd_id);
        } else {
          // OPD member with no assignments sees nothing
          setData({
            reports: [],
            dispositions: [],
            loading: false,
            error: null,
          });
          return;
        }
      }

      const tenantId = profile.tenant_id;

      // Fetch ALL reports and dispositions (paginated to bypass 1000-row limit)
      const [reports, dispositions] = await Promise.all([
        fetchAllRows<DashboardReport>((from, to) => {
          let q = supabase
            .from("reports")
            .select(`
              *,
              opds!reports_assigned_opd_id_fkey (id, name, code)
            `)
            .eq('tenant_id', tenantId)
            .range(from, to);
          if (opdIds) q = q.in('assigned_opd_id', opdIds);
          return q;
        }),
        fetchAllRows<DashboardDisposition>((from, to) => {
          let q = supabase
            .from('report_dispositions')
            .select(`
              *,
              opds!report_dispositions_opd_id_fkey (id, name, code)
            `)
            .eq('tenant_id', tenantId)
            .range(from, to);
          if (opdIds) q = q.in('opd_id', opdIds);
          return q;
        }),
      ]);

      setData({
        reports,
        dispositions,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to fetch dashboard data",
      }));
    }
  };

  return { ...data, refetch: fetchDashboardData };
};
