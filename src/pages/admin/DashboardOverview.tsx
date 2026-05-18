import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard";
import {
  TodaySnapshotCard,
  UrgentIssuesCard,
  TrendingIssuesCard,
  SlowOPDAlertCard,
  AIRecommendationsSummary,
  RegionalHeatmap,
  DateRangeFilter,
} from "@/components/admin/dashboard/executive";
import { exportDashboardToPDF } from "@/utils/dashboard-pdf-export";
import { usePIIMasking } from "@/hooks/use-pii-masking";

const DashboardOverview = () => {
  const { toast } = useToast();
  const { role } = useUserRole();
  const {
    allReports,
    reportsWithLocation,
    todayStats,
    periodStats,
    trendingByType,
    trendingByStatus,
    trendingByOPD,
    slowOPDs,
    urgentIssues,
    recommendations,
    loading: executiveLoading,
    dateRange,
    setDateRange,
  } = useExecutiveDashboard();
  const [exportingPDF, setExportingPDF] = useState(false);
  const { level: maskingLevel } = usePIIMasking();

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      await exportDashboardToPDF({
        dateRange,
        todayStats,
        trendingByType,
        trendingByOPD,
        slowOPDs,
        urgentIssues,
        recommendations,
        allReports,
        exporterRole: role,
      });
      toast({
        title: "Berhasil",
        description: "Dashboard berhasil diekspor ke PDF",
      });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Gagal Export PDF",
        description: error.message || "Terjadi kesalahan saat export PDF",
        variant: "destructive",
      });
    } finally {
      setExportingPDF(false);
    }
  };

  if (executiveLoading) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ringkasan Eksekutif</h1>
          <p className="text-muted-foreground">Analisis dan rekomendasi AI untuk pengambilan keputusan</p>
        </div>

        {/* Executive Summary for Admin/Member/Owner */}
        {(role === 'admin' || role === 'member' || role === 'owner') && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Ringkasan Eksekutif</h2>
                <span className="text-sm text-muted-foreground hidden lg:inline">
                  {new Date().toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <DateRangeFilter
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                />
                <Button
                  onClick={handleExportPDF}
                  disabled={exportingPDF || allReports.length === 0}
                  variant="outline"
                  size="sm"
                  className="h-9"
                >
                  {exportingPDF ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Row 1: Today Snapshot + Urgent Issues */}
            <div className="grid gap-4 md:grid-cols-2">
              <TodaySnapshotCard data={periodStats} />
              <UrgentIssuesCard issues={urgentIssues} />
            </div>

            {/* Row 2: Trending + Heatmap */}
            <div className="grid gap-4 md:grid-cols-2">
              <TrendingIssuesCard
                byType={trendingByType}
                byStatus={trendingByStatus}
                byOPD={trendingByOPD}
              />
              <RegionalHeatmap reports={reportsWithLocation} maskingLevel={maskingLevel} />
            </div>

            {/* Row 3: Slow OPD Alert */}
            <SlowOPDAlertCard slowOPDs={slowOPDs} />

            {/* Row 4: AI Recommendations */}
            <AIRecommendationsSummary
              recommendations={recommendations}
              allReports={allReports}
              todayStats={todayStats}
              slowOPDs={slowOPDs}
              trendingByType={trendingByType}
              urgentIssues={urgentIssues}
              periodLabel={periodStats.periodLabel}
            />
          </div>
        )}

        {/* For roles without executive access */}
        {role && !['admin', 'member', 'owner'].includes(role) && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <LayoutDashboard className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Ringkasan eksekutif tidak tersedia untuk peran Anda</p>
            <p className="text-sm mt-1">Silakan kunjungi halaman Statistik &amp; Analitik untuk melihat data laporan</p>
          </div>
        )}
      </div>
  );
};

export default DashboardOverview;
