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
      const thresholdDate = new Date();
      thresholdDate.setHours(thresholdDate.getHours() - THRESHOLD_HOURS);

      const { data, error } = await supabase
        .from('reports')
        .select(`
          id, ticket_id, description, created_at, status,
          report_ai_insights!inner(urgency, urgency_reason)
        `)
        .in('status', ['pending', 'in_progress'])
        .lt('created_at', thresholdDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        // report_ai_insights may not exist for all reports — swallow the error gracefully
        console.warn('Error fetching critical reports:', error.message);
        setLoading(false);
        return;
      }

      const critical: OverdueReport[] = (data || [])
        .filter((r: any) => {
          const insights = r.report_ai_insights;
          if (Array.isArray(insights)) {
            return insights.some((i: any) => i.urgency === 'critical');
          }
          return insights?.urgency === 'critical';
        })
        .map((r: any) => {
          const insights = Array.isArray(r.report_ai_insights)
            ? r.report_ai_insights.find((i: any) => i.urgency === 'critical')
            : r.report_ai_insights;
          return {
            id: r.id,
            ticket_id: r.ticket_id,
            description: r.description,
            created_at: r.created_at,
            status: r.status,
            urgency_reason: insights?.urgency_reason,
          };
        });

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
