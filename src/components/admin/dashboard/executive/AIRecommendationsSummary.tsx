import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Wand2, Brain, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RecommendationSummary, ReportWithLocation, TodayStats, SlowOPD, TrendingItem } from "@/hooks/use-executive-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIRecommendationsSummaryProps {
  recommendations: RecommendationSummary[];
  allReports?: ReportWithLocation[];
  todayStats?: TodayStats;
  slowOPDs?: SlowOPD[];
  trendingByType?: TrendingItem[];
  onInsightGenerated?: () => void;
}

export function AIRecommendationsSummary({
  recommendations,
  allReports = [],
  todayStats,
  slowOPDs = [],
  trendingByType = [],
  onInsightGenerated
}: AIRecommendationsSummaryProps) {
  const [generating, setGenerating] = useState(false);
  const [overallInsight, setOverallInsight] = useState<string | null>(null);
  const { toast } = useToast();

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
        // Include top recommendations for context
        top_recommendations: recommendations.slice(0, 5).map(r => r.action),
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

      if (result.success && result.data?.summary_analysis) {
        setOverallInsight(result.data.summary_analysis);
        toast({
          title: "Berhasil",
          description: "Ringkasan AI dashboard berhasil di-generate",
        });
        onInsightGenerated?.();
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

  // Calculate quick stats for display
  const totalReports = allReports.length;
  const pendingCount = allReports.filter(r => r.status === 'pending').length;
  const resolvedCount = allReports.filter(r => r.status === 'resolved').length;
  const completionRate = totalReports > 0 ? Math.round((resolvedCount / totalReports) * 100) : 0;

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Ringkasan AI Dashboard
          </CardTitle>
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
                {overallInsight ? "Refresh Analisis" : "Generate Analisis"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{totalReports}</p>
            <p className="text-xs text-muted-foreground">Total Laporan</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{resolvedCount}</p>
            <p className="text-xs text-muted-foreground">Selesai</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{completionRate}%</p>
            <p className="text-xs text-muted-foreground">Tingkat Penyelesaian</p>
          </div>
        </div>

        {/* Overall AI Insight Section */}
        {overallInsight ? (
          <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                  Analisis Keseluruhan Dashboard
                </h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {overallInsight}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
                <Brain className="h-7 w-7 text-purple-500" />
              </div>
              <h4 className="font-medium text-foreground mb-1">
                Belum Ada Analisis AI
              </h4>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Klik tombol "Generate Analisis" untuk mendapatkan ringkasan AI berdasarkan data dashboard saat ini, termasuk tren laporan, performa OPD, dan rekomendasi tindak lanjut.
              </p>
              {allReports.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Tidak ada data laporan untuk dianalisis
                </p>
              )}
            </div>
          </div>
        )}

        {/* Key Insights Summary - only show if we have data */}
        {(slowOPDs.length > 0 || (trendingByType.length > 0 && trendingByType.some(t => t.change !== 0))) && (
          <div className="grid gap-3 md:grid-cols-2">
            {/* Slow OPD Alert */}
            {slowOPDs.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    OPD Perlu Perhatian
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {slowOPDs.length} OPD dengan respons lambat atau tingkat penyelesaian rendah
                </p>
              </div>
            )}

            {/* Trending Alert */}
            {trendingByType.length > 0 && trendingByType.some(t => t.change > 0) && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Tren Naik Minggu Ini
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {trendingByType.filter(t => t.change > 0).map(t => `${t.name} (+${t.change})`).join(', ')}
                </p>
              </div>
            )}

            {/* Completion Rate Alert */}
            {completionRate >= 70 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Performa Baik
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tingkat penyelesaian {completionRate}% - di atas target
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-purple-500" />
          Ringkasan ini dianalisis AI berdasarkan seluruh data laporan pada dashboard
        </div>
      </CardContent>
    </Card>
  );
}
