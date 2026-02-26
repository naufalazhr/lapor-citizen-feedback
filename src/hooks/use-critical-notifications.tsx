import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const THRESHOLD_HOURS = 24;
const DISMISSED_KEY = "critical-notifications-dismissed";

export interface OverdueReport {
  id: string;
  ticket_id: string;
  description: string;
  created_at: string;
  status: string;
  urgency_reason?: string;
}

export interface CriticalNotificationState {
  overdueCount: number;
  overdueReports: OverdueReport[];
  loading: boolean;
  dismiss: (reportId: string) => void;
  dismissAll: () => void;
}

function getDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function useCriticalNotifications(): CriticalNotificationState {
  const [overdueReports, setOverdueReports] = useState<OverdueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedIds());

  const fetchCriticalReports = useCallback(async () => {
    try {
      // TENANT ISOLATION: get session + profile.tenant_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', session.user.id)
        .maybeSingle();

      const thresholdDate = new Date();
      thresholdDate.setHours(thresholdDate.getHours() - THRESHOLD_HOURS);

      // Step 1: fetch overdue reports for this tenant only (no !inner join — avoids 502 in prod)
      let reportsQuery = supabase
        .from('reports')
        .select('id, ticket_id, description, created_at, status')
        .in('status', ['pending', 'in_progress'])
        .lt('created_at', thresholdDate.toISOString())
        .order('created_at', { ascending: true });

      if (profile?.tenant_id) {
        reportsQuery = reportsQuery.eq('tenant_id', profile.tenant_id);
      }

      const { data: reportsData, error: reportsError } = await reportsQuery;

      if (reportsError) {
        console.warn('Error fetching overdue reports:', reportsError.message);
        setLoading(false);
        return;
      }

      const overdueList = reportsData || [];
      if (overdueList.length === 0) {
        setOverdueReports([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch AI insights for those report IDs — only critical
      const reportIds = overdueList.map((r: any) => r.id);
      const { data: insightsData } = await supabase
        .from('report_ai_insights')
        .select('report_id, urgency, urgency_reason')
        .in('report_id', reportIds)
        .eq('urgency', 'critical');

      const criticalReportIds = new Set((insightsData || []).map((i: any) => i.report_id));
      const insightMap = new Map((insightsData || []).map((i: any) => [i.report_id, i]));

      // Step 3: merge — only keep reports that have a critical insight
      const critical: OverdueReport[] = overdueList
        .filter((r: any) => criticalReportIds.has(r.id))
        .map((r: any) => ({
          id: r.id,
          ticket_id: r.ticket_id,
          description: r.description,
          created_at: r.created_at,
          status: r.status,
          urgency_reason: insightMap.get(r.id)?.urgency_reason,
        }));

      setOverdueReports(critical);
    } catch (err) {
      console.warn('Error in useCriticalNotifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriticalReports();
    const interval = setInterval(fetchCriticalReports, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCriticalReports]);

  const dismiss = useCallback((reportId: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(reportId);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      overdueReports.forEach(r => next.add(r.id));
      saveDismissedIds(next);
      return next;
    });
  }, [overdueReports]);

  const visibleReports = overdueReports.filter(r => !dismissedIds.has(r.id));

  return {
    overdueCount: visibleReports.length,
    overdueReports: visibleReports,
    loading,
    dismiss,
    dismissAll,
  };
}
