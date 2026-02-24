import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import {
  Sparkles,
  RefreshCw,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Smile,
  Frown,
  Meh,
  Building2,
} from "lucide-react";
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
  // Classification fields
  urgency: 'critical' | 'moderate' | 'minor' | null;
  urgency_reason: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentiment_reason: string | null;
  suggested_opd_name: string | null;
  suggested_opd_confidence: 'high' | 'medium' | 'low' | null;
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

const urgencyConfig = {
  critical: {
    label: "Kritis",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  moderate: {
    label: "Sedang",
    icon: AlertCircle,
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    iconClassName: "text-yellow-600 dark:text-yellow-400",
  },
  minor: {
    label: "Ringan",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    iconClassName: "text-green-600 dark:text-green-400",
  },
};

const sentimentConfig = {
  positive: {
    label: "Positif",
    icon: Smile,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  negative: {
    label: "Negatif",
    icon: Frown,
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
  neutral: {
    label: "Netral",
    icon: Meh,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    iconClassName: "text-slate-600 dark:text-slate-400",
  },
};

const confidenceConfig = {
  high: {
    label: "Tinggi",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  medium: {
    label: "Sedang",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  low: {
    label: "Rendah",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function AIInsightSection({ reportId, reportData }: AIInsightSectionProps) {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingUrgency, setUpdatingUrgency] = useState(false);
  const { toast } = useToast();
  const { isSuperadmin, isAdmin, isMember } = useUserRole();

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

  const updateUrgency = async (newUrgency: 'critical' | 'moderate' | 'minor') => {
    setUpdatingUrgency(true);
    const { error } = await supabase
      .from("report_ai_insights")
      .update({
        urgency: newUrgency,
        urgency_reason: "Diubah secara manual",
      })
      .eq("report_id", reportId);

    if (error) {
      toast({
        title: "Gagal mengubah urgensi",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setInsight((prev) =>
        prev ? { ...prev, urgency: newUrgency, urgency_reason: "Diubah secara manual" } : prev
      );
      toast({ title: "Urgensi berhasil diperbarui" });
    }
    setUpdatingUrgency(false);
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
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-purple-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Belum Ada Insight</p>
              <p className="text-xs text-muted-foreground">
                Generate insight AI untuk mendapatkan analisis, klasifikasi, dan rekomendasi
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

  // Get classification configs
  const urgency = insight.urgency ? urgencyConfig[insight.urgency] : null;
  const sentiment = insight.sentiment ? sentimentConfig[insight.sentiment] : null;
  const confidence = insight.suggested_opd_confidence
    ? confidenceConfig[insight.suggested_opd_confidence]
    : null;

  // Show existing insight with classification
  return (
    <TooltipProvider>
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
          {/* Classification Section - Inside the same card */}
          {(urgency || sentiment || insight.suggested_opd_name) && (
            <>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Klasifikasi</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400">
                    AI
                  </Badge>
                </div>

                {/* Urgency and Sentiment Row */}
                <div className="flex flex-wrap gap-3">
                  {/* Urgency - Editable Select */}
                  {insight.urgency && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Urgensi:</span>
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={insight.urgency}
                          onValueChange={(v) => updateUrgency(v as 'critical' | 'moderate' | 'minor')}
                          disabled={updatingUrgency}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs px-2 py-0 min-w-[90px] border font-medium ${urgencyConfig[insight.urgency].className}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                                Kritis
                              </div>
                            </SelectItem>
                            <SelectItem value="moderate">
                              <div className="flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3 text-yellow-600" />
                                Sedang
                              </div>
                            </SelectItem>
                            <SelectItem value="minor">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                Ringan
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {updatingUrgency && (
                          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {insight.urgency_reason && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] text-muted-foreground cursor-help underline decoration-dotted">
                              {insight.urgency_reason === "Diubah secara manual" ? "manual" : "AI"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[250px]">
                            <p className="text-xs">{insight.urgency_reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}

                  {/* Sentiment */}
                  {sentiment && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Sentimen:</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`gap-1 cursor-help ${sentiment.className}`}
                          >
                            <sentiment.icon className={`h-3 w-3 ${sentiment.iconClassName}`} />
                            {sentiment.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px]">
                          <p className="text-xs">{insight.sentiment_reason || "Tidak ada penjelasan"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {/* OPD Recommendation */}
                {insight.suggested_opd_name && (
                  <div className="flex items-center gap-2 pt-1">
                    <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Rekomendasi OPD:</span>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {insight.suggested_opd_name}
                    </span>
                    {confidence && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${confidence.className}`}
                      >
                        {confidence.label}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <Separator />
            </>
          )}

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
    </TooltipProvider>
  );
}
