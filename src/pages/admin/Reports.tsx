import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { useUserRole } from "@/hooks/use-user-role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Eye, RefreshCw, Copy, Search, ChevronLeft, ChevronRight, Building2, CheckSquare, Square, Sparkles, AlertTriangle, AlertCircle, CheckCircle2, Tag, Loader2, X, CalendarDays, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ReportDispositionDialog } from "@/components/admin/ReportDispositionDialog";
import { OPDMemberReturnDialog } from "@/components/admin/OPDMemberReturnDialog";
import { ReturnRequestCard } from "@/components/admin/ReturnRequestCard";
import { ReturnRequestApprovalDialog } from "@/components/admin/ReturnRequestApprovalDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { usePIIMasking } from "@/hooks/use-pii-masking";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Report = {
  id: string;
  ticket_id: string;
  reporter_name: string;
  phone: string;
  address: string;
  description: string;
  photo_url: string | null;
  geo_location: { lat: number; lng: number } | null;
  type: "lapor" | "aspirasi";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
  updated_at: string;
  assigned_opd_id: string | null;
  was_returned?: boolean;
  return_request?: {
    id: string;
    status: string;
    requested_at: string;
    notes: string;
  };
};

interface OPD {
  id: string;
  name: string;
  code: string;
}

const REPORT_CATEGORY_LABELS: Record<string, string> = {
  flood: "Banjir",
  fire: "Kebakaran",
  accident: "Kecelakaan",
  road_damage: "Jalan Rusak",
  waste: "Sampah",
  public_facility: "Fasilitas Umum",
  security: "Keamanan",
  health: "Kesehatan",
  education: "Pendidikan",
  drainage: "Drainase",
  street_lighting: "Penerangan",
  licensing: "Perizinan",
  aspiration: "Aspirasi",
  other: "Lainnya",
};

const URGENCY_DOT_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  moderate: "bg-yellow-500",
  minor: "bg-green-500",
};

const URGENCY_LABEL: Record<string, string> = {
  critical: "Kritis",
  moderate: "Sedang",
  minor: "Ringan",
};

const Reports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role, isOPDMember, loading: roleLoading } = useUserRole();
  const { level, maskReport } = usePIIMasking();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [opdFilter, setOpdFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [opds, setOpds] = useState<OPD[]>([]);
  const [opdMap, setOpdMap] = useState<Map<string, OPD>>(new Map());
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showReturnApprovalDialog, setShowReturnApprovalDialog] = useState(false);
  const [selectedReturnRequest, setSelectedReturnRequest] = useState<any>(null);
  const [userOpdIds, setUserOpdIds] = useState<string[]>([]);
  // Date range filter
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  // Urgency filter + map
  const [aiInsightsMap, setAiInsightsMap] = useState<Map<string, { urgency: string | null; urgency_reason: string | null }>>(new Map());
  const [urgencyFilter, setUrgencyFilter] = useState<string>(searchParams.get("urgency") ?? "all");
  // AI Summary dialog
  const [showAISummaryDialog, setShowAISummaryDialog] = useState(false);
  const [aiSummaryReport, setAiSummaryReport] = useState<Report | null>(null);
  const [aiSummaryInsight, setAiSummaryInsight] = useState<any>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  // AI Snippets map for table display (batch-fetched after reports load)
  const [aiSnippetsMap, setAiSnippetsMap] = useState<Map<string, {
    urgency: string | null;
    report_category: string | null;
    summary_analysis: string;
  }>>(new Map());

  // Date range popover
  const [showDatePopover, setShowDatePopover] = useState(false);

  // Bulk generate state
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkLog, setBulkLog] = useState<{ ticket_id: string; status: 'success' | 'error' | 'pending' }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!roleLoading) {
      if (isOPDMember) {
        // First fetch user OPDs, then reports
        fetchUserOPDs().then(() => {
          fetchReports();
        });
      } else {
        fetchReports();
      }
      fetchOPDs();
    }
  }, [roleLoading, isOPDMember]);

  useEffect(() => {
    // Refetch reports when userOpdIds changes
    if (isOPDMember && userOpdIds.length > 0) {
      fetchReports();
    }
  }, [userOpdIds]);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, statusFilter, typeFilter, opdFilter, dateFrom, dateTo, aiInsightsMap, urgencyFilter]);

  const fetchUserOPDs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("user_opd_assignments")
      .select("opd_id")
      .eq("user_id", session.user.id)
      .eq("is_active", true);

    if (!error && data) {
      setUserOpdIds(data.map(assignment => assignment.opd_id));
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    
    let query = supabase
      .from("reports")
      .select("*");

    // Filter for OPD members - only show reports assigned to their OPD(s)
    if (isOPDMember && userOpdIds.length > 0) {
      query = query.in("assigned_opd_id", userOpdIds);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Gagal mengambil data laporan",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const reports = (data || []) as unknown as Report[];
      
      // Check which reports were returned by fetching latest dispositions with action_type = 'return'
      const reportIds = reports.map(r => r.id);
      if (reportIds.length > 0) {
        const { data: dispositions } = await supabase
          .from("report_dispositions")
          .select("report_id, action_type")
          .in("report_id", reportIds)
          .in("action_type", ["return", "return_to_member"])
          .order("assigned_at", { ascending: false });
        
        const returnedReportIds = new Set(
          (dispositions || []).map(d => d.report_id)
        );
        
        // Fetch pending return requests for these reports
        const { data: returnRequests } = await supabase
          .from("report_return_requests")
          .select("id, report_id, status, requested_at, notes")
          .in("report_id", reportIds);
        
        const returnRequestMap = new Map(
          (returnRequests || []).map(req => [req.report_id, req])
        );
        
        // Mark reports that were returned and attach return request status
        reports.forEach(report => {
          if (!report.assigned_opd_id && returnedReportIds.has(report.id)) {
            report.was_returned = true;
          }

          const returnRequest = returnRequestMap.get(report.id);
          if (returnRequest) {
            report.return_request = returnRequest;
          }
        });

        // Fetch AI insights for urgency display
        const { data: insights } = await supabase
          .from("report_ai_insights")
          .select("report_id, urgency, urgency_reason")
          .in("report_id", reportIds);

        const insightsMap = new Map(
          (insights || []).map(ins => [ins.report_id, { urgency: ins.urgency, urgency_reason: ins.urgency_reason }])
        );
        setAiInsightsMap(insightsMap);
      } else {
        setAiInsightsMap(new Map());
      }

      setReports(reports);
      // Batch-fetch AI snippets for all loaded reports (non-blocking)
      fetchAISnippets(reportIds);
    }
    setLoading(false);
  };

  const fetchOPDs = async () => {
    const { data, error } = await supabase
      .from("opds")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching OPDs:", error);
    } else {
      const opdList = data || [];
      setOpds(opdList);
      const map = new Map(opdList.map(opd => [opd.id, opd]));
      setOpdMap(map);
    }
  };

  const startBulkGenerate = async () => {
    // Determine target reports: selected if any, otherwise unprocessed on current page
    const targetReports = selectedReports.size > 0
      ? paginatedReports.filter((r) => selectedReports.has(r.id) && !aiSnippetsMap.has(r.id))
      : paginatedReports.filter((r) => !aiSnippetsMap.has(r.id));

    if (!targetReports.length) {
      toast({ title: "Tidak ada laporan", description: "Semua laporan di halaman ini sudah memiliki insight." });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Error", description: "Sesi tidak ditemukan.", variant: "destructive" }); return; }

    const { data: opdList } = await supabase.from("opds").select("id, code, name, description").eq("is_active", true);

    setBulkLog(targetReports.map((r) => ({ ticket_id: r.ticket_id, status: 'pending' })));
    setBulkProgress({ current: 0, total: targetReports.length, errors: 0 });
    setBulkRunning(true);

    let errors = 0;
    for (let i = 0; i < targetReports.length; i++) {
      const report = targetReports[i];
      setBulkLog((prev) => prev.map((l) => l.ticket_id === report.ticket_id ? { ...l, status: 'pending' } : l));
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-insight`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({
              report_id: report.id,
              report_data: {
                id: report.id,
                ticket_id: report.ticket_id,
                reporter_name: report.reporter_name,
                phone: report.phone,
                address: report.address,
                description: report.description,
                type: report.type,
                status: report.status,
                created_at: report.created_at,
              },
              available_opds: opdList || [],
            }),
          }
        );
        if (response.ok) {
          setBulkLog((prev) => prev.map((l) => l.ticket_id === report.ticket_id ? { ...l, status: 'success' } : l));
        } else {
          errors++;
          setBulkLog((prev) => prev.map((l) => l.ticket_id === report.ticket_id ? { ...l, status: 'error' } : l));
        }
      } catch {
        errors++;
        setBulkLog((prev) => prev.map((l) => l.ticket_id === report.ticket_id ? { ...l, status: 'error' } : l));
      }
      setBulkProgress({ current: i + 1, total: targetReports.length, errors });
      if (i < targetReports.length - 1) await new Promise((r) => setTimeout(r, 250));
    }

    setBulkRunning(false);
    // Refresh snippets in table
    fetchAISnippets(reports.map((r) => r.id));
    toast({ title: `Selesai: ${targetReports.length - errors} berhasil, ${errors} gagal` });
  };

  const fetchAISnippets = async (reportIds: string[]) => {
    if (!reportIds.length) return;
    const { data } = await supabase
      .from("report_ai_insights")
      .select("report_id, urgency, report_category, summary_analysis")
      .in("report_id", reportIds);
    if (data) {
      setAiSnippetsMap(new Map(data.map((i) => [i.report_id, i])));
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter([]);
    setTypeFilter("all");
    setOpdFilter("all");
    setUrgencyFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const filterReports = () => {
    let filtered = [...reports];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((report) => {
        const ticketMatch = report.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const nameMatch = report.reporter_name.toLowerCase().includes(searchTerm.toLowerCase());
        // Phone search only available at L0 (admin/owner/superadmin) — not for L1/L2 masked roles
        const phoneMatch = level === 'L0' ? report.phone.includes(searchTerm) : false;
        const addressMatch = report.address.toLowerCase().includes(searchTerm.toLowerCase());
        return ticketMatch || nameMatch || phoneMatch || addressMatch;
      });
    }

    // Apply status filter (multi-select: empty array = all)
    if (statusFilter.length > 0) {
      filtered = filtered.filter((report) => statusFilter.includes(report.status));
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((report) => report.type === typeFilter);
    }

    // Apply OPD filter
    if (opdFilter !== "all") {
      if (opdFilter === "unassigned") {
        filtered = filtered.filter((report) => !report.assigned_opd_id);
      } else {
        filtered = filtered.filter((report) => report.assigned_opd_id === opdFilter);
      }
    }

    // Apply date range filter
    if (dateFrom) {
      filtered = filtered.filter(
        (report) => new Date(report.created_at) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      filtered = filtered.filter(
        (report) => new Date(report.created_at) < toDate
      );
    }

    // Apply urgency filter
    if (urgencyFilter !== "all") {
      filtered = filtered.filter((report) => {
        const insight = aiInsightsMap.get(report.id);
        return insight?.urgency === urgencyFilter;
      });
    }

    setFilteredReports(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const updateStatus = async (id: string, status: "pending" | "in_progress" | "resolved" | "rejected") => {
    const { data, error } = await supabase.rpc('update_report_status', {
      p_report_id: id,
      p_new_status: status,
      p_notes: null
    });

    if (error) {
      toast({
        title: "Gagal mengubah status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status berhasil diperbarui",
        description: "Status laporan telah diubah dan tercatat di timeline",
      });
      fetchReports();
    }
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase.from("reports").delete().eq("id", id);

    if (error) {
      toast({
        title: "Gagal menghapus laporan",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Laporan berhasil dihapus",
        description: "Laporan telah dihapus dari sistem",
      });
      fetchReports();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Tersalin",
      description: "ID Tiket berhasil disalin ke clipboard",
    });
  };

  const fetchAISummary = async (report: Report) => {
    setAiSummaryReport(report);
    setAiSummaryInsight(null);
    setAiSummaryLoading(true);
    setShowAISummaryDialog(true);

    const { data } = await supabase
      .from("report_ai_insights")
      .select("summary_analysis, key_insights, urgency, urgency_reason, report_category")
      .eq("report_id", report.id)
      .maybeSingle();

    if (data) {
      setAiSummaryInsight({
        ...data,
        key_insights: Array.isArray(data.key_insights)
          ? data.key_insights
          : JSON.parse((data.key_insights as string) || "[]"),
      });
    }
    setAiSummaryLoading(false);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredReports.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedReports = filteredReports.slice(startIndex, endIndex);

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

  return (
    <Dashboard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manajemen Laporan</h1>
            <p className="text-muted-foreground">Kelola dan pantau laporan warga</p>
          </div>
          <Button onClick={fetchReports} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Muat Ulang
          </Button>
        </div>

        {/* Filter Toolbar */}
        <div className="space-y-2">
          {/* Row 1: Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={level === 'L0' ? "Cari ID Tiket, Nama, Telepon, Alamat..." : "Cari ID Tiket, Nama, Alamat..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-9"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Row 2: Inline filter selects */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status — multi-select */}
            {(() => {
              const STATUS_OPTIONS = [
                { value: "pending", label: "Pending" },
                { value: "in_progress", label: "Dalam Proses" },
                { value: "resolved", label: "Selesai" },
                { value: "rejected", label: "Ditolak" },
              ];
              const label =
                statusFilter.length === 0
                  ? "Semua Status"
                  : statusFilter.length === 1
                  ? STATUS_OPTIONS.find(o => o.value === statusFilter[0])?.label ?? statusFilter[0]
                  : `${statusFilter.length} Status`;
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-8 text-sm gap-1.5 font-normal ${statusFilter.length > 0 ? "border-primary text-primary" : ""}`}
                    >
                      {label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start">
                    {STATUS_OPTIONS.map(({ value, label: optLabel }) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm select-none"
                      >
                        <Checkbox
                          checked={statusFilter.includes(value)}
                          onCheckedChange={(checked) => {
                            setStatusFilter(prev =>
                              checked ? [...prev, value] : prev.filter(s => s !== value)
                            );
                          }}
                        />
                        {optLabel}
                      </label>
                    ))}
                    {statusFilter.length > 0 && (
                      <>
                        <div className="border-t my-1" />
                        <button
                          className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive rounded hover:bg-accent"
                          onClick={() => setStatusFilter([])}
                        >
                          Hapus filter status
                        </button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })()}

            {/* Jenis */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[110px] text-sm">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="lapor">Lapor</SelectItem>
                <SelectItem value="aspirasi">Aspirasi</SelectItem>
              </SelectContent>
            </Select>

            {/* Urgensi */}
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-sm">
                <SelectValue placeholder="Semua Urgensi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Urgensi</SelectItem>
                <SelectItem value="critical">🔴 Kritis</SelectItem>
                <SelectItem value="moderate">🟡 Sedang</SelectItem>
                <SelectItem value="minor">🟢 Ringan</SelectItem>
              </SelectContent>
            </Select>

            {/* OPD */}
            <Select value={opdFilter} onValueChange={setOpdFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[130px] text-sm">
                <SelectValue placeholder="Semua OPD" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua OPD</SelectItem>
                <SelectItem value="unassigned">Belum Didisposisi</SelectItem>
                {opds.map((opd) => (
                  <SelectItem key={opd.id} value={opd.id}>
                    {opd.code} - {opd.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Rentang Tanggal — popover */}
            <Popover open={showDatePopover} onOpenChange={setShowDatePopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 gap-1.5 text-sm font-normal ${(dateFrom || dateTo) ? "border-primary text-primary" : "text-muted-foreground"}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dateFrom || dateTo
                    ? (() => {
                        const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
                        if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
                        if (dateFrom) return `Dari ${fmt(dateFrom)}`;
                        return `S/d ${fmt(dateTo)}`;
                      })()
                    : "Rentang Tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rentang Tanggal Laporan</p>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Dari Tanggal</label>
                      <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Sampai Tanggal</label>
                      <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
                      onClick={() => { setDateFrom(""); setDateTo(""); setShowDatePopover(false); }}>
                      <X className="h-3 w-3 mr-1" />Hapus Filter Tanggal
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Hapus Filter — only shown when any filter is active */}
            {(statusFilter.length > 0 || typeFilter !== "all" || urgencyFilter !== "all" || opdFilter !== "all" || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1" onClick={clearAllFilters}>
                <X className="h-3 w-3" />
                Hapus Filter
              </Button>
            )}
          </div>

          {/* Row 3 (conditional): Active filter chips */}
          {(() => {
            const chips: { key: string; label: string; onRemove: () => void }[] = [];
            const statusLabels: Record<string, string> = { pending: "Pending", in_progress: "Dalam Proses", resolved: "Selesai", rejected: "Ditolak" };
            const urgencyLabels: Record<string, string> = { critical: "Kritis", moderate: "Sedang", minor: "Ringan" };
            if (statusFilter.length > 0) chips.push({ key: "status", label: `Status: ${statusFilter.map(s => statusLabels[s] ?? s).join(", ")}`, onRemove: () => setStatusFilter([]) });
            if (typeFilter !== "all") chips.push({ key: "type", label: `Jenis: ${typeFilter === "lapor" ? "Lapor" : "Aspirasi"}`, onRemove: () => setTypeFilter("all") });
            if (urgencyFilter !== "all") chips.push({ key: "urgency", label: `Urgensi: ${urgencyLabels[urgencyFilter] ?? urgencyFilter}`, onRemove: () => setUrgencyFilter("all") });
            if (opdFilter !== "all") chips.push({ key: "opd", label: `OPD: ${opdFilter === "unassigned" ? "Belum Didisposisi" : (opdMap.get(opdFilter)?.code ?? opdFilter)}`, onRemove: () => setOpdFilter("all") });
            if (dateFrom || dateTo) {
              const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
              const dateLabel = dateFrom && dateTo ? `${fmt(dateFrom)} – ${fmt(dateTo)}` : dateFrom ? `Dari ${fmt(dateFrom)}` : `S/d ${fmt(dateTo)}`;
              chips.push({ key: "date", label: dateLabel, onRemove: () => { setDateFrom(""); setDateTo(""); } });
            }
            if (!chips.length) return null;
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                {chips.map(chip => (
                  <span key={chip.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted border border-border">
                    {chip.label}
                    <button onClick={chip.onRemove} className="ml-0.5 text-muted-foreground hover:text-foreground" aria-label={`Hapus filter ${chip.key}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 ml-1">
                  Hapus Semua
                </button>
              </div>
            );
          })()}
        </div>

        {/* Return Requests Card - Only show for Members/Admins */}
        {!isOPDMember && <ReturnRequestCard />}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Semua Laporan</CardTitle>
                <CardDescription>
                  Menampilkan {startIndex + 1}-{Math.min(endIndex, filteredReports.length)} dari {filteredReports.length} laporan
                  {selectedReports.size > 0 && ` • ${selectedReports.size} dipilih`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Select mode toggle */}
              {!isSelectMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsSelectMode(true)}
                >
                  <CheckSquare className="h-4 w-4" />
                  Pilih
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setSelectedReports(new Set(filteredReports.map((r) => r.id)))}
                  >
                    <CheckSquare className="h-4 w-4" />
                    Pilih Semua
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setSelectedReports(new Set())}
                  >
                    <Square className="h-4 w-4" />
                    Batalkan Semua
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => { setIsSelectMode(false); setSelectedReports(new Set()); }}
                  >
                    <X className="h-4 w-4" />
                    Batal
                  </Button>
                </>
              )}

              {/* Bulk Generate — admin/member only */}
              {!isOPDMember && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
                  onClick={() => setShowBulkDialog(true)}
                >
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Generate Insight ({
                    selectedReports.size > 0
                      ? paginatedReports.filter((r) => selectedReports.has(r.id) && !aiSnippetsMap.has(r.id)).length
                      : paginatedReports.filter((r) => !aiSnippetsMap.has(r.id)).length
                  })
                </Button>
              )}

              {isSelectMode && selectedReports.size > 0 && (
                isOPDMember ? (
                  <Button
                    onClick={() => setShowReturnDialog(true)}
                    className="gap-2"
                    variant="outline"
                  >
                    <Building2 className="h-4 w-4" />
                    Kembalikan ke Member ({selectedReports.size})
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowDispositionDialog(true)}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Disposisikan ({selectedReports.size})
                  </Button>
                )
              )}
            </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredReports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Tidak ada laporan ditemukan</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSelectMode && <TableHead className="w-12"></TableHead>}
                      <TableHead>ID Tiket</TableHead>
                      <TableHead>Pelapor</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Urgensi</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>OPD</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReports.map((report) => {
                      const maskedReport = maskReport(report);
                      return (
                      <TableRow key={report.id}>
                        {isSelectMode && (
                          <TableCell>
                            <Checkbox
                              checked={selectedReports.has(report.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedReports);
                                if (checked) {
                                  newSelected.add(report.id);
                                } else {
                                  newSelected.delete(report.id);
                                }
                                setSelectedReports(newSelected);
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                              {report.ticket_id}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(report.ticket_id)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{maskedReport.reporter_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Badge className={getTypeColor(report.type)} variant="outline">
                              {report.type}
                            </Badge>
                            {report.return_request && (
                              <Badge 
                                variant={
                                  report.return_request.status === 'pending' ? 'default' : 
                                  report.return_request.status === 'approved' ? 'outline' : 
                                  'destructive'
                                }
                                className={
                                  report.return_request.status === 'pending' 
                                    ? 'bg-orange-500 hover:bg-orange-600' 
                                    : ''
                                }
                              >
                                {report.return_request.status === 'pending' && '⏳ Permintaan Dikembalikan'}
                                {report.return_request.status === 'approved' && '✓ Dikembalikan ke Member'}
                                {report.return_request.status === 'rejected' && '✗ Pengembalian Ditolak'}
                              </Badge>
                            )}
                            {!isOPDMember && report.return_request?.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                                onClick={async () => {
                                  try {
                                    // 1) Fetch the base request first (ensures RLS passes)
                                    const { data: req, error: reqErr } = await supabase
                                      .from("report_return_requests")
                                      .select("id, report_id, requested_by, requested_at, notes, status")
                                      .eq("id", report.return_request!.id)
                                      .single();

                                    if (reqErr || !req) throw reqErr || new Error("not_found");

                                    // 2) Fetch related report and requester profile in parallel
                                    const [reportRes, profileRes] = await Promise.all([
                                      supabase
                                        .from("reports")
                                        .select("ticket_id, reporter_name, description, type, status")
                                        .eq("id", req.report_id)
                                        .single(),
                                      supabase
                                        .from("profiles")
                                        .select("full_name, email")
                                        .eq("id", req.requested_by)
                                        .single(),
                                    ]);

                                    // 3) Compose the payload expected by the Approval Dialog
                                    const composed = {
                                      ...req,
                                      reports: reportRes.data || { ticket_id: "-", reporter_name: "-", description: "", type: "lapor", status: "pending" },
                                      profiles: profileRes.data || { full_name: "-", email: "-" },
                                    } as any;

                                    setSelectedReturnRequest(composed);
                                    setShowReturnApprovalDialog(true);
                                  } catch (e) {
                                    toast({
                                      title: "Error",
                                      description: "Gagal memuat data permintaan pengembalian",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Setujui
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={report.status}
                            onValueChange={(value) => updateStatus(report.id, value as "pending" | "in_progress" | "resolved" | "rejected")}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">Dalam Proses</SelectItem>
                              <SelectItem value="resolved">Selesai</SelectItem>
                              <SelectItem value="rejected">Ditolak</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const insight = aiInsightsMap.get(report.id);
                            if (!insight?.urgency) return <span className="text-xs text-muted-foreground">-</span>;
                            const urgencyMap = {
                              critical: { label: "Kritis", icon: AlertTriangle, className: "bg-red-100 text-red-700 border-red-200", iconClassName: "text-red-600" },
                              moderate: { label: "Sedang", icon: AlertCircle, className: "bg-yellow-100 text-yellow-700 border-yellow-200", iconClassName: "text-yellow-600" },
                              minor: { label: "Ringan", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200", iconClassName: "text-green-600" },
                            };
                            const cfg = urgencyMap[insight.urgency as keyof typeof urgencyMap];
                            if (!cfg) return <span className="text-xs text-muted-foreground">-</span>;
                            const Icon = cfg.icon;
                            return (
                              <Badge variant="outline" className={`gap-1 text-xs ${cfg.className}`}>
                                <Icon className={`h-3 w-3 ${cfg.iconClassName}`} />
                                {cfg.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const snippet = aiSnippetsMap.get(report.id);
                            if (!snippet?.report_category) return <span className="text-xs text-muted-foreground">-</span>;
                            return (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Tag className="h-3 w-3" />
                                {REPORT_CATEGORY_LABELS[snippet.report_category] ?? snippet.report_category}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {report.assigned_opd_id && opdMap.has(report.assigned_opd_id) ? (
                            <Badge variant="outline" className="gap-1">
                              <Building2 className="h-3 w-3" />
                              {opdMap.get(report.assigned_opd_id)?.code}
                            </Badge>
                          ) : report.was_returned ? (
                            <Badge variant="secondary" className="gap-1">
                              Dikembalikan
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {new Date(report.created_at).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/reports/${report.id}`)}
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!isOPDMember && (() => {
                              const snippet = aiSnippetsMap.get(report.id);
                              if (snippet) {
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => fetchAISummary(report)}
                                          className="gap-1.5 px-2 border-purple-200 hover:bg-purple-50 dark:border-purple-800"
                                        >
                                          <Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-[260px]">
                                        <p className="text-xs font-medium mb-0.5">
                                          {snippet.urgency && `${URGENCY_LABEL[snippet.urgency]} · `}
                                          {snippet.report_category && (REPORT_CATEGORY_LABELS[snippet.report_category] ?? snippet.report_category)}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-3">{snippet.summary_analysis}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              }
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => fetchAISummary(report)}
                                  title="Lihat Ringkasan AI"
                                >
                                  <Sparkles className="h-4 w-4 text-purple-500" />
                                </Button>
                              );
                            })()}
                            {(role === 'admin' || role === 'superadmin') && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteReport(report.id)}
                                title="Hapus Laporan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination + Page Size */}
                <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                  {/* Page size selector */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Tampilkan</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="h-8 w-[75px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>per halaman</span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        Halaman {currentPage} dari {totalPages}
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Sebelumnya
                            </Button>
                          </PaginationItem>

                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}

                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Selanjutnya
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disposition Dialog */}
      <ReportDispositionDialog
        open={showDispositionDialog}
        onOpenChange={setShowDispositionDialog}
        reports={Array.from(selectedReports)
          .map(id => reports.find(r => r.id === id))
          .filter((r): r is Report => r !== undefined)}
        onSuccess={() => {
          setShowDispositionDialog(false);
          setSelectedReports(new Set());
          fetchReports();
        }}
      />

      {/* OPD Member Return Dialog */}
      <OPDMemberReturnDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        reports={Array.from(selectedReports)
          .map(id => reports.find(r => r.id === id))
          .filter((r): r is Report => r !== undefined)}
        onSuccess={() => {
          setShowReturnDialog(false);
          setSelectedReports(new Set());
          fetchReports();
        }}
      />

      {/* Member Return Request Approval Dialog */}
      <ReturnRequestApprovalDialog
        open={showReturnApprovalDialog}
        onOpenChange={setShowReturnApprovalDialog}
        request={selectedReturnRequest}
        onSuccess={() => {
          setSelectedReturnRequest(null);
          setShowReturnApprovalDialog(false);
          fetchReports();
        }}
      />

      {/* Bulk Generate Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={(open) => { if (!bulkRunning) setShowBulkDialog(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Generate AI Insight
            </DialogTitle>
          </DialogHeader>

          {!bulkRunning && bulkProgress.current === 0 ? (
            /* Pre-run: confirmation */
            <div className="space-y-4 py-2">
              {(() => {
                const count = selectedReports.size > 0
                  ? paginatedReports.filter((r) => selectedReports.has(r.id) && !aiSnippetsMap.has(r.id)).length
                  : paginatedReports.filter((r) => !aiSnippetsMap.has(r.id)).length;
                return (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Akan memproses <span className="font-bold">{count}</span> laporan
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Estimasi: ~{count} API call (Gemini 2.5 Flash)
                      {selectedReports.size > 0 ? " — dari laporan yang dipilih" : " — laporan belum ber-insight di halaman ini"}
                    </p>
                  </div>
                );
              })()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Batal</Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={startBulkGenerate}
                  disabled={
                    (selectedReports.size > 0
                      ? paginatedReports.filter((r) => selectedReports.has(r.id) && !aiSnippetsMap.has(r.id)).length
                      : paginatedReports.filter((r) => !aiSnippetsMap.has(r.id)).length) === 0
                  }
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Mulai Generate
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Progress view */
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Memproses AI Insight...</span>
                  <span className="font-medium">{bulkProgress.current} / {bulkProgress.total}</span>
                </div>
                <Progress value={(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100} className="h-2" />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 rounded border bg-muted/30 p-2">
                {bulkLog.map((entry) => (
                  <div key={entry.ticket_id} className="flex items-center gap-2 text-xs">
                    {entry.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
                    {entry.status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                    {entry.status === 'error' && <X className="h-3 w-3 text-red-500 flex-shrink-0" />}
                    <code className="font-mono text-[10px] bg-muted px-1 rounded">{entry.ticket_id}</code>
                    <span className="text-muted-foreground">
                      {entry.status === 'pending' ? 'Menunggu...' : entry.status === 'success' ? 'Berhasil' : 'Gagal'}
                    </span>
                  </div>
                ))}
              </div>

              {!bulkRunning && (
                <div className="text-xs text-muted-foreground text-center">
                  Selesai: {bulkProgress.total - bulkProgress.errors} berhasil, {bulkProgress.errors} gagal
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={bulkRunning}
                  onClick={() => {
                    setShowBulkDialog(false);
                    setBulkProgress({ current: 0, total: 0, errors: 0 });
                    setBulkLog([]);
                  }}
                >
                  {bulkRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {bulkRunning ? "Sedang berjalan..." : "Tutup"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Summary Quick View Dialog */}
      <Dialog open={showAISummaryDialog} onOpenChange={setShowAISummaryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Ringkasan AI — {aiSummaryReport?.ticket_id}
            </DialogTitle>
          </DialogHeader>

          {aiSummaryLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat insight...</span>
            </div>
          ) : !aiSummaryInsight ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Insight belum dibuat untuk laporan ini.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAISummaryDialog(false);
                  if (aiSummaryReport) navigate(`/admin/reports/${aiSummaryReport.id}`);
                }}
              >
                Buka Detail untuk Generate Insight
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Urgency + Category badges */}
              <div className="flex flex-wrap items-center gap-2">
                {aiSummaryInsight.urgency && (() => {
                  const urgencyMap = {
                    critical: { label: "Kritis", icon: AlertTriangle, className: "bg-red-100 text-red-700 border-red-200", iconClassName: "text-red-600" },
                    moderate: { label: "Sedang", icon: AlertCircle, className: "bg-yellow-100 text-yellow-700 border-yellow-200", iconClassName: "text-yellow-600" },
                    minor: { label: "Ringan", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200", iconClassName: "text-green-600" },
                  };
                  const cfg = urgencyMap[aiSummaryInsight.urgency as keyof typeof urgencyMap];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Urgensi:</span>
                      <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                        <Icon className={`h-3 w-3 ${cfg.iconClassName}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })()}
                {aiSummaryInsight.report_category && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Kategori:</span>
                    <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                      <Tag className="h-3 w-3" />
                      {REPORT_CATEGORY_LABELS[aiSummaryInsight.report_category] ?? aiSummaryInsight.report_category}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Summary */}
              {aiSummaryInsight.summary_analysis && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border-l-4 border-purple-500">
                  <p className="text-sm text-foreground leading-snug">
                    {aiSummaryInsight.summary_analysis}
                  </p>
                </div>
              )}

              {/* Key Insights (top 3) */}
              {aiSummaryInsight.key_insights?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Insights</p>
                  <ul className="space-y-1">
                    {aiSummaryInsight.key_insights.slice(0, 3).map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Open Detail link */}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setShowAISummaryDialog(false);
                  if (aiSummaryReport) navigate(`/admin/reports/${aiSummaryReport.id}`);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Buka Detail
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dashboard>
  );
};

export default Reports;
