import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseISO } from "date-fns";
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
import { DateRangeFilter } from "@/components/admin/dashboard/executive";
import { usePIIMasking } from "@/hooks/use-pii-masking";
import { maskName } from "@/utils/pii-masking";

type DashboardStats = {
  total_reports: number;
  pending_reports: number;
  in_progress_reports: number;
  resolved_reports: number;
  rejected_reports: number;
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
  const { reports: dashboardReports, dispositions, loading: dashboardLoading, error: dashboardError } = useDashboardData();
  const { level: maskingLevel } = usePIIMasking();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  // Filter reports by date range
  const filteredReports = useMemo(() => {
    if (!dashboardReports) return [];
    if (!dateRange.from && !dateRange.to) return dashboardReports;

    return dashboardReports.filter(report => {
      const reportDate = parseISO(report.created_at);
      if (dateRange.from && dateRange.to) {
        return reportDate >= dateRange.from && reportDate <= dateRange.to;
      } else if (dateRange.from) {
        return reportDate >= dateRange.from;
      } else if (dateRange.to) {
        return reportDate <= dateRange.to;
      }
      return true;
    });
  }, [dashboardReports, dateRange]);

  // Derive stats from the filtered data source to ensure consistency
  const stats = useMemo((): DashboardStats | null => {
    if (dashboardLoading || !filteredReports) return null;

    return {
      total_reports: filteredReports.length,
      pending_reports: filteredReports.filter(r => r.status === "pending").length,
      in_progress_reports: filteredReports.filter(r => r.status === "in_progress").length,
      resolved_reports: filteredReports.filter(r => r.status === "resolved").length,
      rejected_reports: filteredReports.filter(r => r.status === "rejected").length,
      lapor_count: filteredReports.filter(r => r.type === "lapor").length,
      aspirasi_count: filteredReports.filter(r => r.type === "aspirasi").length,
    };
  }, [filteredReports, dashboardLoading]);

  // Derive recent reports from the filtered data source
  const recentReports = useMemo((): Report[] => {
    if (!filteredReports) return [];
    return [...filteredReports]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        ticket_id: r.ticket_id,
        reporter_name: r.reporter_name,
        type: r.type,
        status: r.status,
        created_at: r.created_at,
      }));
  }, [filteredReports]);

  // Use filtered reports as the single source for OPD charts
  const reports = filteredReports;

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

  if (dashboardLoading) {
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Statistik &amp; Analitik</h1>
            <p className="text-muted-foreground">Ringkasan statistik laporan dan analitik performa OPD</p>
          </div>
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
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
              <CardTitle className="text-sm font-medium">Terselesaikan</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats?.resolved_reports || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.rejected_reports || 0} Ditolak
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
