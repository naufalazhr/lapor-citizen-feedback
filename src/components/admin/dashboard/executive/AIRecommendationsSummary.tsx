import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle, Lightbulb, RefreshCw, Wand2 } from "lucide-react";
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

      // Prepare summary data for AI
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
        existing_recommendations: recommendations.slice(0, 5).map(r => r.action),
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
          description: "Insight dashboard berhasil di-generate",
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

  if (recommendations.length === 0 && !overallInsight) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Rekomendasi AI
            </CardTitle>
            {allReports.length > 0 && (
              <Button
                onClick={generateOverallInsight}
                disabled={generating}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Generate Insight
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
              <Lightbulb className="h-6 w-6 text-purple-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              Belum ada rekomendasi AI. Klik "Generate Insight" untuk mendapatkan analisis keseluruhan.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Rekomendasi Tindak Lanjut AI
            {recommendations.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                {recommendations.length} Aksi
              </Badge>
            )}
          </CardTitle>
          {allReports.length > 0 && (
            <Button
              onClick={generateOverallInsight}
              disabled={generating}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-3 w-3 mr-1" />
                  Ringkasan AI
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Overall Insight Section */}
        {overallInsight && (
          <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border-l-4 border-purple-500">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide mb-1">
                  Ringkasan Analisis Dashboard
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {overallInsight}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Individual Recommendations */}
        {recommendations.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {rec.action}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {rec.count}x disarankan
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        dari {rec.reports.length} laporan
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-purple-500" />
          Rekomendasi digenerate dari analisis AI pada setiap laporan
        </div>
      </CardContent>
    </Card>
  );
}
