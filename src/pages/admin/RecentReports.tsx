import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileText, Clock, CheckCircle, TrendingUp, AlertCircle } from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { OPDProgressChart } from "@/components/admin/dashboard/OPDProgressChart";
import { DispositionTimelineChart } from "@/components/admin/dashboard/DispositionTimelineChart";
import { OPDResponseTimeChart } from "@/components/admin/dashboard/OPDResponseTimeChart";
import { TopOPDsCard } from "@/components/admin/dashboard/TopOPDsCard";
import { usePIIMasking } from "@/hooks/use-pii-masking";
import { maskName } from "@/utils/pii-masking";

type DashboardStats = {
  total_reports: number;
  pending_reports: number;
  in_progress_reports: number;
  resolved_reports: number;
  rejected_reports: number;
  reports_this_month: number;
  resolved_this_month: number;
  lapor_count: number;
  aspirasi_count: number;
};

type Report = {
  id: string;
  ticket_id: string;
  reporter_name: string;
  type: "lapor" | "aspirasi";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
};

const RecentReports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { reports, dispositions, loading: dashboardLoading, error: dashboardError } = useDashboardData();
  const { level: maskingLevel } = usePIIMasking();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("*");

      if (reportsError) throw reportsError;

      const allReports = reportsData || [];
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const calculatedStats: DashboardStats = {
        total_reports: allReports.length,
        pending_reports: allReports.filter((r: any) => r.status === "pending").length,
        in_progress_reports: allReports.filter((r: any) => r.status === "in_progress").length,
        resolved_reports: allReports.filter((r: any) => r.status === "resolved").length,
        rejected_reports: allReports.filter((r: any) => r.status === "rejected").length,
        reports_this_month: allReports.filter((r: any) => new Date(r.created_at) >= thisMonth).length,
        resolved_this_month: allReports.filter(
          (r: any) => r.status === "resolved" && new Date(r.updated_at) >= thisMonth
        ).length,
        lapor_count: allReports.filter((r: any) => r.type === "lapor").length,
        aspirasi_count: allReports.filter((r: any) => r.type === "aspirasi").length,
      };

      setStats(calculatedStats);

      const { data: recent, error: recentError } = await supabase
        .from("reports")
        .select("id, ticket_id, reporter_name, type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentError) throw recentError;
      setRecentReports((recent || []) as Report[]);
    } catch (error: any) {
      toast({
        title: "Error mengambil data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-secondary text-secondary-foreground";
      case "in_progress":
        return "bg-primary text-primary-foreground";
      case "resolved":
        return "bg-success text-success-foreground";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeColor = (type: string) => {
    return type === "lapor" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground";
  };

  if (loading || dashboardLoading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Dashboard>
    );
  }

  if (dashboardError) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="h-5 w-5 mr-2" />
          {dashboardError}
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Statistik &amp; Analitik</h1>
          <p className="text-muted-foreground">Ringkasan statistik laporan dan analitik performa OPD</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Laporan</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_reports || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.lapor_count || 0} Lapor, {stats?.aspirasi_count || 0} Aspirasi
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Menunggu Tindakan</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats?.pending_reports || 0) + (stats?.in_progress_reports || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.pending_reports || 0} Pending, {stats?.in_progress_reports || 0} Proses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terselesaikan Bulan Ini</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats?.resolved_this_month || 0}</div>
              <p className="text-xs text-muted-foreground">
                Dari {stats?.reports_this_month || 0} laporan bulan ini
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tingkat Penyelesaian</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.total_reports
                  ? Math.round(((stats?.resolved_reports || 0) / stats.total_reports) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.resolved_reports || 0} dari {stats?.total_reports || 0} laporan
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Reports Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Laporan Terbaru</CardTitle>
                <CardDescription>10 laporan terakhir yang masuk ke sistem</CardDescription>
              </div>
              <Button onClick={() => navigate("/admin/reports")} variant="outline">
                Lihat Semua
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Belum ada laporan</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Tiket</TableHead>
                    <TableHead>Pelapor</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReports.map((report) => (
                    <TableRow
                      key={report.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/reports/${report.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{report.ticket_id}</TableCell>
                      <TableCell className="font-medium">{maskName(report.reporter_name, maskingLevel)}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(report.type)} variant="outline">
                          {report.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(report.created_at).toLocaleDateString("id-ID")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* OPD & Disposition Analytics */}
        {!dashboardLoading && !dashboardError && (
          <>
            {/* Admin/Member/Owner View - Full Analytics */}
            {(role === 'admin' || role === 'member' || role === 'owner') && (
              <>
                <OPDProgressChart reports={reports} />

                <div className="grid gap-4 md:grid-cols-2">
                  <DispositionTimelineChart dispositions={dispositions} />
                  <TopOPDsCard reports={reports} />
                </div>

                <OPDResponseTimeChart reports={reports} dispositions={dispositions} />
              </>
            )}

            {/* OPD Member View - Simplified Analytics */}
            {role === 'opd_member' && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <OPDProgressChart reports={reports} />
                  <OPDResponseTimeChart reports={reports} dispositions={dispositions} />
                </div>

                <DispositionTimelineChart dispositions={dispositions} />
              </>
            )}
          </>
        )}
      </div>
    </Dashboard>
  );
};

export default RecentReports;
