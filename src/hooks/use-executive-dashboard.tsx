import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./use-user-role";
import { startOfWeek, subWeeks, startOfDay, subDays, isWithinInterval, parseISO } from "date-fns";

export interface ReportWithLocation {
  id: string;
  ticket_id: string;
  reporter_name: string;
  type: "lapor" | "aspirasi";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
  updated_at: string;
  assigned_opd_id: string | null;
  description: string;
  geo_location: { lat: number; lng: number } | null;
  opds?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface AIInsightData {
  id: string;
  report_id: string;
  urgency: 'critical' | 'moderate' | 'minor' | null;
  urgency_reason: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentiment_reason: string | null;
  recommended_actions: string[] | string;
  suggested_opd_name: string | null;
  suggested_opd_confidence: 'high' | 'medium' | 'low' | null;
}

export interface DispositionData {
  id: string;
  report_id: string;
  opd_id: string;
  assigned_at: string;
  action_type: string;
}

export interface TodayStats {
  totalToday: number;
  pendingToday: number;
  resolvedToday: number;
  inProgressToday: number;
  totalYesterday: number;
  pendingYesterday: number;
  resolvedYesterday: number;
}

export interface TrendingItem {
  name: string;
  thisWeek: number;
  lastWeek: number;
  change: number;
  changePercent: number;
}

export interface SlowOPD {
  opd_id: string;
  opd_name: string;
  avg_response_hours: number;
  pending_count: number;
  total_assigned: number;
  completion_rate: number;
}

export interface UrgentIssue {
  report_id: string;
  ticket_id: string;
  reporter_name: string;
  description: string;
  created_at: string;
  urgency: 'critical' | 'moderate' | 'minor';
  urgency_reason: string | null;
}

export interface RecommendationSummary {
  action: string;
  count: number;
  reports: string[];
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface ExecutiveDashboardData {
  allReports: ReportWithLocation[];
  reportsWithLocation: ReportWithLocation[];
  aiInsights: AIInsightData[];
  dispositions: DispositionData[];
  todayStats: TodayStats;
  trendingByType: TrendingItem[];
  trendingByStatus: TrendingItem[];
  trendingByOPD: TrendingItem[];
  slowOPDs: SlowOPD[];
  urgentIssues: UrgentIssue[];
  recommendations: RecommendationSummary[];
  loading: boolean;
  error: string | null;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export const useExecutiveDashboard = () => {
  const { role, isSuperadmin } = useUserRole();
  const [allReportsData, setAllReportsData] = useState<ReportWithLocation[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsightData[]>([]);
  const [dispositions, setDispositions] = useState<DispositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Get user's profile with tenant info
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', session.user.id)
        .single();

      // Build the reports query
      let reportsQuery = supabase
        .from("reports")
        .select(`
          id, ticket_id, reporter_name, type, status, created_at, updated_at,
          assigned_opd_id, description, geo_location,
          opds!reports_assigned_opd_id_fkey (id, name, code)
        `);

      // Apply tenant filter only if user has a tenant_id (not superadmin without tenant)
      if (profile?.tenant_id) {
        reportsQuery = reportsQuery.eq('tenant_id', profile.tenant_id);
      }
      // For superadmin without tenant_id, fetch all reports (RLS should handle this)

      const { data: reportsData, error: reportsError } = await reportsQuery;

      if (reportsError) {
        console.error('Reports query error:', reportsError);
        throw reportsError;
      }

      console.log('Fetched reports:', reportsData?.length || 0);

      // Fetch AI insights for all reports
      const reportIds = (reportsData || []).map(r => r.id);
      let aiData: AIInsightData[] = [];

      if (reportIds.length > 0) {
        const { data: insights, error: insightsError } = await supabase
          .from('report_ai_insights')
          .select('id, report_id, urgency, urgency_reason, sentiment, sentiment_reason, recommended_actions, suggested_opd_name, suggested_opd_confidence')
          .in('report_id', reportIds);

        if (!insightsError && insights) {
          aiData = insights as AIInsightData[];
        }
      }

      // Fetch dispositions
      let dispositionsQuery = supabase
        .from('report_dispositions')
        .select('id, report_id, opd_id, assigned_at, action_type');

      if (profile?.tenant_id) {
        dispositionsQuery = dispositionsQuery.eq('tenant_id', profile.tenant_id);
      }

      const { data: dispositionsData, error: dispositionsError } = await dispositionsQuery;

      if (dispositionsError) {
        console.error('Dispositions query error:', dispositionsError);
      }

      setAllReportsData((reportsData || []) as ReportWithLocation[]);
      setAiInsights(aiData);
      setDispositions((dispositionsData || []) as DispositionData[]);
    } catch (err: any) {
      console.error('Error fetching executive dashboard data:', err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, role]);

  // Filter reports by date range
  const reports = useMemo(() => {
    if (!dateRange.from && !dateRange.to) {
      return allReportsData;
    }

    return allReportsData.filter(report => {
      const reportDate = parseISO(report.created_at);

      if (dateRange.from && dateRange.to) {
        return isWithinInterval(reportDate, { start: dateRange.from, end: dateRange.to });
      } else if (dateRange.from) {
        return reportDate >= dateRange.from;
      } else if (dateRange.to) {
        return reportDate <= dateRange.to;
      }
      return true;
    });
  }, [allReportsData, dateRange]);

  // Calculate today's stats
  const todayStats = useMemo((): TodayStats => {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(new Date(), 1));

    const todayReports = reports.filter(r => new Date(r.created_at) >= today);
    const yesterdayReports = reports.filter(r => {
      const date = new Date(r.created_at);
      return date >= yesterday && date < today;
    });

    const resolvedTodayReports = reports.filter(r =>
      r.status === 'resolved' && new Date(r.updated_at) >= today
    );
    const resolvedYesterdayReports = reports.filter(r => {
      const date = new Date(r.updated_at);
      return r.status === 'resolved' && date >= yesterday && date < today;
    });

    return {
      totalToday: todayReports.length,
      pendingToday: todayReports.filter(r => r.status === 'pending').length,
      resolvedToday: resolvedTodayReports.length,
      inProgressToday: todayReports.filter(r => r.status === 'in_progress').length,
      totalYesterday: yesterdayReports.length,
      pendingYesterday: yesterdayReports.filter(r => r.status === 'pending').length,
      resolvedYesterday: resolvedYesterdayReports.length,
    };
  }, [reports]);

  // Calculate trending data
  const calculateTrending = useMemo(() => {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(thisWeekStart, 1);

    const thisWeekReports = reports.filter(r => new Date(r.created_at) >= thisWeekStart);
    const lastWeekReports = reports.filter(r => {
      const date = new Date(r.created_at);
      return date >= lastWeekStart && date < thisWeekStart;
    });

    // By Type
    const trendingByType: TrendingItem[] = ['lapor', 'aspirasi'].map(type => {
      const thisWeek = thisWeekReports.filter(r => r.type === type).length;
      const lastWeek = lastWeekReports.filter(r => r.type === type).length;
      const change = thisWeek - lastWeek;
      const changePercent = lastWeek > 0 ? Math.round((change / lastWeek) * 100) : (thisWeek > 0 ? 100 : 0);
      return {
        name: type === 'lapor' ? 'Laporan' : 'Aspirasi',
        thisWeek,
        lastWeek,
        change,
        changePercent
      };
    });

    // By Status
    const statuses = ['pending', 'in_progress', 'resolved', 'rejected'] as const;
    const statusLabels = { pending: 'Pending', in_progress: 'Dalam Proses', resolved: 'Selesai', rejected: 'Ditolak' };
    const trendingByStatus: TrendingItem[] = statuses.map(status => {
      const thisWeek = thisWeekReports.filter(r => r.status === status).length;
      const lastWeek = lastWeekReports.filter(r => r.status === status).length;
      const change = thisWeek - lastWeek;
      const changePercent = lastWeek > 0 ? Math.round((change / lastWeek) * 100) : (thisWeek > 0 ? 100 : 0);
      return {
        name: statusLabels[status],
        thisWeek,
        lastWeek,
        change,
        changePercent
      };
    });

    // By OPD
    const opdMap = new Map<string, { name: string; thisWeek: number; lastWeek: number }>();
    thisWeekReports.forEach(r => {
      if (r.opds) {
        const existing = opdMap.get(r.opds.id) || { name: r.opds.name, thisWeek: 0, lastWeek: 0 };
        existing.thisWeek++;
        opdMap.set(r.opds.id, existing);
      }
    });
    lastWeekReports.forEach(r => {
      if (r.opds) {
        const existing = opdMap.get(r.opds.id) || { name: r.opds.name, thisWeek: 0, lastWeek: 0 };
        existing.lastWeek++;
        opdMap.set(r.opds.id, existing);
      }
    });

    const trendingByOPD: TrendingItem[] = Array.from(opdMap.entries())
      .map(([_, data]) => {
        const change = data.thisWeek - data.lastWeek;
        const changePercent = data.lastWeek > 0 ? Math.round((change / data.lastWeek) * 100) : (data.thisWeek > 0 ? 100 : 0);
        return {
          name: data.name,
          thisWeek: data.thisWeek,
          lastWeek: data.lastWeek,
          change,
          changePercent
        };
      })
      .sort((a, b) => b.change - a.change)
      .slice(0, 5);

    return { trendingByType, trendingByStatus, trendingByOPD };
  }, [reports]);

  // Calculate slow OPDs
  const slowOPDs = useMemo((): SlowOPD[] => {
    const opdStats = new Map<string, {
      name: string;
      totalResponseTime: number;
      responseCount: number;
      pending: number;
      resolved: number;
      total: number;
    }>();

    // Group reports by OPD
    reports.forEach(r => {
      if (r.assigned_opd_id && r.opds) {
        const existing = opdStats.get(r.assigned_opd_id) || {
          name: r.opds.name,
          totalResponseTime: 0,
          responseCount: 0,
          pending: 0,
          resolved: 0,
          total: 0
        };
        existing.total++;
        if (r.status === 'pending') existing.pending++;
        if (r.status === 'resolved') existing.resolved++;
        opdStats.set(r.assigned_opd_id, existing);
      }
    });

    // Calculate response times from dispositions
    dispositions.forEach(d => {
      if (d.action_type === 'disposition' || d.action_type === 'assigned') {
        const report = reports.find(r => r.id === d.report_id);
        if (report && d.opd_id) {
          const responseTime = new Date(d.assigned_at).getTime() - new Date(report.created_at).getTime();
          const hours = responseTime / (1000 * 60 * 60);

          const existing = opdStats.get(d.opd_id);
          if (existing) {
            existing.totalResponseTime += hours;
            existing.responseCount++;
            opdStats.set(d.opd_id, existing);
          }
        }
      }
    });

    // Calculate metrics and filter slow OPDs
    const result: SlowOPD[] = [];
    opdStats.forEach((stats, opdId) => {
      const avgResponseHours = stats.responseCount > 0
        ? stats.totalResponseTime / stats.responseCount
        : 0;
      const completionRate = stats.total > 0
        ? Math.round((stats.resolved / stats.total) * 100)
        : 0;

      // Include if: response > 24h OR pending > 5 OR completion < 60%
      if (avgResponseHours > 24 || stats.pending > 5 || completionRate < 60) {
        result.push({
          opd_id: opdId,
          opd_name: stats.name,
          avg_response_hours: Math.round(avgResponseHours * 10) / 10,
          pending_count: stats.pending,
          total_assigned: stats.total,
          completion_rate: completionRate
        });
      }
    });

    // Sort by worst performers first
    return result.sort((a, b) => b.avg_response_hours - a.avg_response_hours).slice(0, 5);
  }, [reports, dispositions]);

  // Get urgent issues
  const urgentIssues = useMemo((): UrgentIssue[] => {
    const criticalInsights = aiInsights.filter(ai => ai.urgency === 'critical');

    return criticalInsights
      .map(ai => {
        const report = reports.find(r => r.id === ai.report_id);
        if (!report) return null;
        return {
          report_id: report.id,
          ticket_id: report.ticket_id,
          reporter_name: report.reporter_name,
          description: report.description?.substring(0, 100) + (report.description?.length > 100 ? '...' : '') || '',
          created_at: report.created_at,
          urgency: ai.urgency as 'critical' | 'moderate' | 'minor',
          urgency_reason: ai.urgency_reason
        };
      })
      .filter((item): item is UrgentIssue => item !== null)
      .slice(0, 5);
  }, [reports, aiInsights]);

  // Aggregate recommendations
  const recommendations = useMemo((): RecommendationSummary[] => {
    const actionMap = new Map<string, { count: number; reports: string[] }>();

    aiInsights.forEach(ai => {
      let actions: string[] = [];

      if (Array.isArray(ai.recommended_actions)) {
        actions = ai.recommended_actions;
      } else if (typeof ai.recommended_actions === 'string') {
        try {
          actions = JSON.parse(ai.recommended_actions);
        } catch {
          actions = [];
        }
      }

      const report = reports.find(r => r.id === ai.report_id);
      const ticketId = report?.ticket_id || ai.report_id;

      actions.forEach(action => {
        const key = action.trim().toLowerCase();
        const existing = actionMap.get(key) || { count: 0, reports: [] };
        existing.count++;
        if (!existing.reports.includes(ticketId)) {
          existing.reports.push(ticketId);
        }
        actionMap.set(key, existing);
      });
    });

    return Array.from(actionMap.entries())
      .map(([action, data]) => ({
        action: action.charAt(0).toUpperCase() + action.slice(1),
        count: data.count,
        reports: data.reports
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [aiInsights, reports]);

  // All reports for map (show all locations, not just filtered)
  const reportsWithLocation = useMemo(() => {
    return reports.filter(r => {
      // Check if geo_location exists and has valid lat/lng
      if (!r.geo_location) return false;
      const loc = r.geo_location;
      return typeof loc.lat === 'number' && typeof loc.lng === 'number' &&
             !isNaN(loc.lat) && !isNaN(loc.lng) &&
             loc.lat !== 0 && loc.lng !== 0;
    });
  }, [reports]);

  return {
    allReports: reports,
    reportsWithLocation,
    aiInsights,
    dispositions,
    todayStats,
    trendingByType: calculateTrending.trendingByType,
    trendingByStatus: calculateTrending.trendingByStatus,
    trendingByOPD: calculateTrending.trendingByOPD,
    slowOPDs,
    urgentIssues,
    recommendations,
    loading,
    error,
    dateRange,
    setDateRange,
    refetch: fetchData
  };
};
