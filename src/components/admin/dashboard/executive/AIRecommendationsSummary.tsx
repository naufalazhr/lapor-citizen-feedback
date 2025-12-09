import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ChevronUp
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
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case 'warning':
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      default:
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    }
  };

  const getAlertTitleColor = (level: string) => {
    switch (level) {
      case 'critical':
        return "text-red-700 dark:text-red-400";
      case 'warning':
        return "text-amber-700 dark:text-amber-400";
      default:
        return "text-blue-700 dark:text-blue-400";
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Ringkasan AI Dashboard
            {insight && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (tersimpan)
              </span>
            )}
          </CardTitle>
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
            {/* Executive Summary */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                    Ringkasan Eksekutif
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {insight.executive_summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Priority Alerts */}
            {insight.priority_alerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Priority Alerts
                </h4>
                <div className="space-y-2">
                  {insight.priority_alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg border",
                        getAlertStyles(alert.level)
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getAlertIcon(alert.level)}
                        <span className={cn("font-semibold text-sm", getAlertTitleColor(alert.level))}>
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-sm text-foreground ml-6">{alert.message}</p>
                      <p className="text-xs text-muted-foreground ml-6 mt-2 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {alert.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottlenecks and Trends Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Bottlenecks */}
              {insight.bottlenecks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-orange-500" />
                    Hambatan Terdeteksi
                  </h4>
                  <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    {insight.bottlenecks.map((bottleneck, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-orange-700 dark:text-orange-400">
                            {bottleneck.area}:
                          </span>
                          <span className="text-foreground">{bottleneck.issue}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-0 mt-0.5">
                          Dampak: {bottleneck.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trends */}
              {insight.trends.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Interpretasi Tren
                  </h4>
                  <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    {insight.trends.map((trend, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {getTrendIcon(trend.direction)}
                        <span className="text-foreground">
                          <span className="font-medium">{trend.indicator}:</span>{' '}
                          {trend.interpretation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations Today */}
            {insight.recommendations_today.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Rekomendasi Hari Ini
                </h4>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <ol className="list-decimal list-inside space-y-2">
                    {insight.recommendations_today.map((rec, idx) => (
                      <li key={idx} className="text-sm text-foreground">
                        {rec}
                      </li>
                    ))}
                  </ol>
                </div>
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
