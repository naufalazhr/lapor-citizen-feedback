import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  RefreshCw,
  Wand2,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Circle,
} from "lucide-react";
import { RecommendationSummary, ReportWithLocation, TodayStats, SlowOPD, TrendingItem, UrgentIssue } from "@/hooks/use-executive-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Types for AI Dashboard Insight - exported for PDF export
export interface PriorityAlert {
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
}

export interface Bottleneck {
  area: string;
  issue: string;
  impact: string;
}

export interface TrendInsight {
  indicator: string;
  direction: 'up' | 'down' | 'stable';
  interpretation: string;
}

export interface DashboardAIInsight {
  executive_summary: string;
  priority_alerts: PriorityAlert[];
  bottlenecks: Bottleneck[];
  trends: TrendInsight[];
  recommendations_today: string[];
}

// LocalStorage keys
const STORAGE_KEY_INSIGHT = 'ai-dashboard-insight';
const STORAGE_KEY_COLLAPSED = 'ai-dashboard-collapsed';

// Helper function to get insight from localStorage (for PDF export)
export function getStoredAIInsight(): DashboardAIInsight | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_INSIGHT);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading AI insight from localStorage:', e);
  }
  return null;
}

interface AIRecommendationsSummaryProps {
  recommendations: RecommendationSummary[];
  allReports?: ReportWithLocation[];
  todayStats?: TodayStats;
  slowOPDs?: SlowOPD[];
  trendingByType?: TrendingItem[];
  urgentIssues?: UrgentIssue[];
  periodLabel?: string;
}

export function AIRecommendationsSummary({
  recommendations,
  allReports = [],
  todayStats,
  slowOPDs = [],
  trendingByType = [],
  urgentIssues = [],
  periodLabel,
}: AIRecommendationsSummaryProps) {
  const [generating, setGenerating] = useState(false);
  const [insight, setInsight] = useState<DashboardAIInsight | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const { toast } = useToast();

  // Load insight and collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const storedInsight = localStorage.getItem(STORAGE_KEY_INSIGHT);
      if (storedInsight) {
        setInsight(JSON.parse(storedInsight));
      }
      const storedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED);
      if (storedCollapsed) {
        setIsCollapsed(JSON.parse(storedCollapsed));
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }, []);

  // Save insight to localStorage when it changes
  useEffect(() => {
    if (insight) {
      try {
        localStorage.setItem(STORAGE_KEY_INSIGHT, JSON.stringify(insight));
      } catch (e) {
        console.error('Error saving insight to localStorage:', e);
      }
    }
  }, [insight]);

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(isCollapsed));
    } catch (e) {
      console.error('Error saving collapsed state to localStorage:', e);
    }
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Derive system condition from priority alerts
  const getSystemCondition = () => {
    if (!insight) return null;
    if (insight.priority_alerts.some(a => a.level === 'critical')) return 'critical';
    if (insight.priority_alerts.some(a => a.level === 'warning')) return 'warning';
    return 'good';
  };

  const generateOverallInsight = async () => {
    try {
      setGenerating(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Anda harus login untuk generate insight",
          variant: "destructive",
        });
        return;
      }

      // Prepare comprehensive summary data for AI
      const summaryData = {
        total_reports: allReports.length,
        reports_by_status: {
          pending: allReports.filter(r => r.status === 'pending').length,
          in_progress: allReports.filter(r => r.status === 'in_progress').length,
          resolved: allReports.filter(r => r.status === 'resolved').length,
          rejected: allReports.filter(r => r.status === 'rejected').length,
        },
        reports_by_type: {
          lapor: allReports.filter(r => r.type === 'lapor').length,
          aspirasi: allReports.filter(r => r.type === 'aspirasi').length,
        },
        today_stats: todayStats,
        slow_opds: slowOPDs.map(opd => ({
          name: opd.opd_name,
          response_hours: opd.avg_response_hours,
          pending: opd.pending_count,
          completion_rate: opd.completion_rate
        })),
        trending: trendingByType,
        top_recommendations: recommendations.slice(0, 5).map(r => r.action),
        urgent_issues_count: urgentIssues.length,
        period_label: periodLabel,
      };

      // Call edge function for overall insight
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-insight`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            dashboard_summary: true,
            summary_data: summaryData,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate insight");
      }

      if (result.success && result.data) {
        const insightData = result.data as DashboardAIInsight;
        setInsight(insightData);
        toast({
          title: "Berhasil",
          description: "Ringkasan AI dashboard berhasil di-generate",
        });
      } else {
        console.error("Unexpected response structure:", result);
        toast({
          title: "Error",
          description: "Response tidak memiliki struktur yang diharapkan",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error generating overall insight:", error);
      toast({
        title: "Gagal Generate Insight",
        description: error.message || "Terjadi kesalahan saat generate insight",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Info className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const getPillStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400";
      case 'warning':
        return "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400";
      default:
        return "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400";
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
      case 'down':
        return <TrendingDown className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />;
    }
  };

  const systemCondition = getSystemCondition();

  const conditionConfig = {
    good: {
      dot: "bg-green-500",
      text: "text-green-700 dark:text-green-400",
      label: "Sistem berjalan baik",
    },
    warning: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      label: "Perlu perhatian",
    },
    critical: {
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      label: "Butuh tindakan segera",
    },
  };

  const condition = systemCondition ? conditionConfig[systemCondition] : null;

  // For alerts: show pills if ≤3, show first 3 + expand if >3
  const ALERT_PILL_LIMIT = 3;
  const visibleAlerts = insight
    ? alertsExpanded
      ? insight.priority_alerts
      : insight.priority_alerts.slice(0, ALERT_PILL_LIMIT)
    : [];
  const hasMoreAlerts = insight && insight.priority_alerts.length > ALERT_PILL_LIMIT;

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Ringkasan AI Dashboard
              {insight && (
                <span className="text-xs font-normal text-muted-foreground">
                  (tersimpan)
                </span>
              )}
            </CardTitle>
            {/* Kondisi Sistem pill */}
            {condition && (
              <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", condition.text)}>
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", condition.dot, "animate-pulse")} />
                {condition.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {insight && (
              <Button
                onClick={toggleCollapse}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                title={isCollapsed ? "Tampilkan detail" : "Sembunyikan detail"}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              onClick={generateOverallInsight}
              disabled={generating || allReports.length === 0}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Menganalisis...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {insight ? "Refresh Analisis" : "Generate Analisis"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", isCollapsed && insight && "hidden")}>
        {insight ? (
          <>
            {/* Executive Summary — compact with left border accent */}
            <div className="pl-4 border-l-4 border-purple-400 dark:border-purple-600">
              <p className="text-sm text-foreground leading-relaxed">
                {insight.executive_summary}
              </p>
            </div>

            {/* Priority Alerts — pill row */}
            {insight.priority_alerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Priority Alerts
                </h4>
                <div className="flex flex-wrap gap-2">
                  {visibleAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                        getPillStyles(alert.level)
                      )}
                      title={`${alert.message}\n→ ${alert.action}`}
                    >
                      {getAlertIcon(alert.level)}
                      {alert.title}
                    </div>
                  ))}
                  {hasMoreAlerts && (
                    <button
                      onClick={() => setAlertsExpanded(!alertsExpanded)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-muted-foreground transition-colors"
                    >
                      {alertsExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Sembunyikan
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          +{insight.priority_alerts.length - ALERT_PILL_LIMIT} lainnya
                        </>
                      )}
                    </button>
                  )}
                </div>
                {/* Expanded alert details */}
                {alertsExpanded && (
                  <div className="space-y-1.5 pt-1">
                    {insight.priority_alerts.map((alert, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2 pl-1">
                        <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                        <span>
                          <span className="font-medium text-foreground">{alert.title}:</span>{" "}
                          {alert.message}{" "}
                          <span className="text-muted-foreground/70">— {alert.action}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottlenecks + Trends — tabbed */}
            {(insight.bottlenecks.length > 0 || insight.trends.length > 0) && (
              <Tabs defaultValue={insight.bottlenecks.length > 0 ? "hambatan" : "tren"} className="w-full">
                <TabsList className="h-8 text-xs">
                  <TabsTrigger value="hambatan" className="text-xs h-7 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-orange-500" />
                    Hambatan
                    {insight.bottlenecks.length > 0 && (
                      <span className="ml-0.5 text-muted-foreground">({insight.bottlenecks.length})</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tren" className="text-xs h-7 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                    Tren
                    {insight.trends.length > 0 && (
                      <span className="ml-0.5 text-muted-foreground">({insight.trends.length})</span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="hambatan" className="mt-2">
                  {insight.bottlenecks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">Tidak ada hambatan terdeteksi.</p>
                  ) : (
                    <div className="space-y-2">
                      {insight.bottlenecks.map((bottleneck, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Circle className="h-1.5 w-1.5 mt-2 flex-shrink-0 fill-orange-400 text-orange-400" />
                          <div>
                            <span className="font-medium text-orange-700 dark:text-orange-400">
                              {bottleneck.area}:
                            </span>{" "}
                            <span className="text-foreground">{bottleneck.issue}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Dampak: {bottleneck.impact}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tren" className="mt-2">
                  {insight.trends.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">Tidak ada tren signifikan.</p>
                  ) : (
                    <div className="space-y-2">
                      {insight.trends.map((trend, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          {getTrendIcon(trend.direction)}
                          <span className="text-foreground">
                            <span className="font-medium">{trend.indicator}:</span>{" "}
                            {trend.interpretation}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Recommendations — clean checklist, no box */}
            {insight.recommendations_today.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  Rekomendasi Hari Ini
                </h4>
                <ul className="space-y-1.5">
                  {insight.recommendations_today.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                      <Circle className="h-1.5 w-1.5 mt-2 flex-shrink-0 fill-green-500 text-green-500" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
                <Brain className="h-7 w-7 text-purple-500" />
              </div>
              <h4 className="font-medium text-foreground mb-1">
                Belum Ada Analisis AI
              </h4>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Klik tombol "Generate Analisis" untuk mendapatkan insight eksekutif berdasarkan data dashboard,
                termasuk priority alerts, deteksi hambatan, interpretasi tren, dan rekomendasi tindakan hari ini.
              </p>
              {allReports.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Tidak ada data laporan untuk dianalisis
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-purple-500" />
          Insight AI untuk pengambilan keputusan eksekutif
        </div>
      </CardContent>
    </Card>
  );
}
