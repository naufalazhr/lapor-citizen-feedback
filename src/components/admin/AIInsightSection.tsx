import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { Sparkles, RefreshCw, Lightbulb, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface AIInsight {
  id: string;
  report_id: string;
  summary_analysis: string;
  key_insights: string[];
  recommended_actions: string[];
  model_used: string;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportData {
  id: string;
  ticket_id: string;
  reporter_name: string;
  phone: string | null;
  address: string;
  description: string;
  type: "lapor" | "aspirasi";
  status: string;
  created_at: string;
  assigned_opd_name?: string | null;
  disposition_notes?: string | null;
}

interface AIInsightSectionProps {
  reportId: string;
  reportData: ReportData;
}

export function AIInsightSection({ reportId, reportData }: AIInsightSectionProps) {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const { role, isSuperadmin, isAdmin, isMember } = useUserRole();

  // Check if user can generate insights
  const canGenerateInsight = isSuperadmin || isAdmin || isMember;

  useEffect(() => {
    fetchInsight();
  }, [reportId]);

  const fetchInsight = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("report_ai_insights")
        .select("*")
        .eq("report_id", reportId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching AI insight:", error);
        return;
      }

      if (data) {
        // Parse JSON fields if they're strings
        const parsedData: AIInsight = {
          ...data,
          key_insights: Array.isArray(data.key_insights)
            ? data.key_insights
            : JSON.parse(data.key_insights as string || '[]'),
          recommended_actions: Array.isArray(data.recommended_actions)
            ? data.recommended_actions
            : JSON.parse(data.recommended_actions as string || '[]'),
        };
        setInsight(parsedData);
      }
    } catch (error) {
      console.error("Error in fetchInsight:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsight = async () => {
    if (!canGenerateInsight) {
      toast({
        title: "Akses Ditolak",
        description: "Anda tidak memiliki izin untuk generate AI insight",
        variant: "destructive",
      });
      return;
    }

    try {
      setGenerating(true);

      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Anda harus login untuk generate insight",
          variant: "destructive",
        });
        return;
      }

      // Call edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-insight`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            report_id: reportId,
            report_data: reportData,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate insight");
      }

      if (result.success && result.data) {
        // Parse the insight data
        const parsedInsight: AIInsight = {
          ...result.data,
          key_insights: Array.isArray(result.data.key_insights)
            ? result.data.key_insights
            : JSON.parse(result.data.key_insights || '[]'),
          recommended_actions: Array.isArray(result.data.recommended_actions)
            ? result.data.recommended_actions
            : JSON.parse(result.data.recommended_actions || '[]'),
        };
        setInsight(parsedInsight);
        toast({
          title: "Berhasil",
          description: "AI Insight berhasil di-generate",
        });
      }
    } catch (error: any) {
      console.error("Error generating insight:", error);
      toast({
        title: "Gagal Generate Insight",
        description: error.message || "Terjadi kesalahan saat generate AI insight",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Don't show the section if user doesn't have permission
  if (!canGenerateInsight) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Insight
          </CardTitle>
          <CardDescription className="text-xs">
            Analisis cerdas untuk laporan ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Memuat...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No insight yet - show generate button
  if (!insight) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Insight
          </CardTitle>
          <CardDescription className="text-xs">
            Analisis cerdas untuk laporan ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-purple-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Belum Ada Insight</p>
              <p className="text-xs text-muted-foreground">
                Generate insight AI untuk mendapatkan analisis, key points, dan rekomendasi aksi
              </p>
            </div>
            <Button
              onClick={generateInsight}
              disabled={generating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Insight
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show existing insight - optimized for quick scanning (20-40 sec read time)
  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI Insight
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(insight.updated_at), {
                addSuffix: true,
                locale: idLocale
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateInsight}
              disabled={generating}
              className="h-6 px-2"
            >
              {generating ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Summary - Most prominent */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border-l-4 border-purple-500">
          <p className="text-sm font-medium text-foreground leading-snug">
            {insight.summary_analysis}
          </p>
        </div>

        {/* Two-column layout for insights and actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Key Insights */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Insights</span>
            </div>
            <ul className="space-y-1">
              {insight.key_insights.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-1.5 text-xs"
                >
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span className="text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Actions */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Aksi</span>
            </div>
            <ul className="space-y-1">
              {insight.recommended_actions.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-1.5 text-xs"
                >
                  <span className="text-green-500 mt-0.5">→</span>
                  <span className="text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
