import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Trash2, Eye, RefreshCw, Copy, Search, ChevronLeft, ChevronRight, Building2, CheckSquare, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ReportDispositionDialog } from "@/components/admin/ReportDispositionDialog";
import { OPDMemberReturnDialog } from "@/components/admin/OPDMemberReturnDialog";
import { ReturnRequestCard } from "@/components/admin/ReturnRequestCard";
import { ReturnRequestApprovalDialog } from "@/components/admin/ReturnRequestApprovalDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

const Reports = () => {
  const navigate = useNavigate();
  const { role, isOPDMember, loading: roleLoading } = useUserRole();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [opdFilter, setOpdFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [opds, setOpds] = useState<OPD[]>([]);
  const [opdMap, setOpdMap] = useState<Map<string, OPD>>(new Map());
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showReturnApprovalDialog, setShowReturnApprovalDialog] = useState(false);
  const [selectedReturnRequest, setSelectedReturnRequest] = useState<any>(null);
  const [userOpdIds, setUserOpdIds] = useState<string[]>([]);
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
  }, [reports, searchTerm, statusFilter, typeFilter, opdFilter]);

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
      }
      
      setReports(reports);
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

  const filterReports = () => {
    let filtered = [...reports];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (report) =>
          report.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.reporter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          report.phone.includes(searchTerm) ||
          report.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((report) => report.status === statusFilter);
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

    setFilteredReports(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const updateStatus = async (id: string, status: "pending" | "in_progress" | "resolved" | "rejected") => {
    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({
        title: "Gagal mengubah status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status berhasil diperbarui",
        description: "Status laporan telah diubah",
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

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter & Pencarian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari ID Tiket, Nama, Telepon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  <SelectItem value="lapor">Lapor</SelectItem>
                  <SelectItem value="aspirasi">Aspirasi</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">Dalam Proses</SelectItem>
                  <SelectItem value="resolved">Selesai</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>

              <Select value={opdFilter} onValueChange={setOpdFilter}>
                <SelectTrigger>
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

              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per halaman</SelectItem>
                  <SelectItem value="20">20 per halaman</SelectItem>
                  <SelectItem value="50">50 per halaman</SelectItem>
                  <SelectItem value="100">100 per halaman</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
              {selectedReports.size > 0 && (
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
                      <TableHead className="w-12"></TableHead>
                      <TableHead>ID Tiket</TableHead>
                      <TableHead>Pelapor</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>OPD</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReports.map((report) => (
                      <TableRow key={report.id}>
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
                        <TableCell className="font-medium">{report.reporter_name}</TableCell>
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
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
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
    </Dashboard>
  );
};

export default Reports;
