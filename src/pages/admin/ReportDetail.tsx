import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Download, Trash2, Building2, Edit, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lazy, Suspense } from "react";
import { DispositionTimeline } from "@/components/admin/DispositionTimeline";
import { ReportDispositionDialog } from "@/components/admin/ReportDispositionDialog";
import { OPDMemberReturnDialog } from "@/components/admin/OPDMemberReturnDialog";
import { ReturnRequestApprovalDialog } from "@/components/admin/ReturnRequestApprovalDialog";
import { AIInsightSection } from "@/components/admin/AIInsightSection";
import { useUserRole } from "@/hooks/use-user-role";
import { usePIIMasking } from "@/hooks/use-pii-masking";
import { maskPhone } from "@/utils/pii-masking";

const LeafletMap = lazy(() => import("@/components/LeafletMap"));

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
  session_id: string | null;
  assigned_opd_id: string | null;
  disposition_notes: string | null;
};

type OPD = {
  id: string;
  name: string;
  code: string;
  head_name: string | null;
};

type Conversation = {
  phone_number: string | null; // WhatsApp device number
  device_number: string | null; // User's actual phone number
};

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [assignedOPD, setAssignedOPD] = useState<OPD | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalNote, setInternalNote] = useState("");
  const [internalNotes, setInternalNotes] = useState<Array<{
    id: string;
    comment: string;
    created_at: string;
    user_id: string;
    user_name?: string;
  }>>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showReturnApprovalDialog, setShowReturnApprovalDialog] = useState(false);
  const [pendingReturnRequest, setPendingReturnRequest] = useState<any>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const { toast } = useToast();
  const { isOPDMember, role } = useUserRole();
  const { level, maskReport, logAccess } = usePIIMasking();

  console.log("🎨 ReportDetail render - ID:", id, "Loading:", loading, "Report:", report ? "exists" : "null");

  useEffect(() => {
    console.log("🚀 ReportDetail component mounted/updated. ID:", id);
    if (id) {
      fetchReport();
    } else {
      console.error("❌ No ID provided in URL params");
    }
  }, [id]);

  // Audit log: record PII access whenever the report is loaded
  useEffect(() => {
    if (report?.id) {
      logAccess(report.id, 'view');
    }
  }, [report?.id]);

  const fetchReport = async () => {
    console.log("🔍 Fetching report with ID:", id);
    setLoading(true);

    try {
      // Fetch report data
      const { data: reportData, error: reportError } = await supabase.from("reports").select("*").eq("id", id).single();

      console.log("📊 Report query result:", { reportData, reportError });

      if (reportError) {
        console.error("❌ Error fetching report:", reportError);
        toast({
          title: "Gagal mengambil data laporan",
          description: reportError.message,
          variant: "destructive",
        });
        setReport(null);
        setLoading(false);
        return;
      }

      if (!reportData) {
        console.warn("⚠️ No data returned for report ID:", id);
        setReport(null);
        setLoading(false);
        return;
      }

      console.log("✅ Report fetched successfully:", reportData);
      const typedReport = reportData as unknown as Report;
      setReport(typedReport);

      // Fetch assigned OPD if exists
      if (typedReport.assigned_opd_id) {
        const { data: opdData } = await supabase
          .from("opds")
          .select("id, name, code, head_name")
          .eq("id", typedReport.assigned_opd_id)
          .maybeSingle();

        if (opdData) {
          setAssignedOPD(opdData);
        }
      }

      // Fetch conversation data if session_id exists
      if (typedReport.session_id) {
        const { data: conversationData, error: conversationError } = await supabase
          .from("conversations")
          .select("phone_number, device_number")
          .eq("session_id", typedReport.session_id)
          .maybeSingle();

        console.log("📞 Conversation query result:", { conversationData, conversationError });

        if (conversationError) {
          console.error("⚠️ Error fetching conversation:", conversationError);
        } else if (conversationData) {
          console.log("✅ Conversation fetched successfully:", conversationData);
          setConversation(conversationData);
        }
      }

      // Fetch pending return request for this report
      await fetchReturnRequest(typedReport.id);

      // Fetch internal notes
      console.log("📝 Fetching internal notes for report:", id);
      await fetchInternalNotes();
    } catch (error) {
      console.error("💥 Unexpected error in fetchReport:", error);
      toast({
        title: "Terjadi kesalahan",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnRequest = async (reportId: string) => {
    try {
      const { data: req } = await supabase
        .from("report_return_requests")
        .select("id, report_id, requested_by, requested_at, notes, status")
        .eq("report_id", reportId)
        .eq("status", "pending")
        .maybeSingle();

      if (!req) {
        setPendingReturnRequest(null);
        return;
      }

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

      setPendingReturnRequest({
        ...req,
        reports: reportRes.data || { ticket_id: "-", reporter_name: "-", description: "", type: "lapor", status: "pending" },
        profiles: profileRes.data || { full_name: "-", email: "-" },
      });
    } catch (error) {
      console.error("Error fetching return request:", error);
      setPendingReturnRequest(null);
    }
  };

  const updateStatus = async (status: "pending" | "in_progress" | "resolved" | "rejected") => {
    if (!report) return;

    const { data, error } = await supabase.rpc("update_report_status", {
      p_report_id: report.id,
      p_new_status: status,
      p_notes: null,
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
      fetchReport();
    }
  };

  const deleteReport = async () => {
    if (!report) return;

    const confirmed = window.confirm("Yakin ingin menghapus laporan ini?");
    if (!confirmed) return;

    const { error } = await supabase.from("reports").delete().eq("id", report.id);

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
      navigate("/admin/reports");
    }
  };

  const fetchInternalNotes = async () => {
    if (!id) return;

    console.log("🔍 Starting fetchInternalNotes for report:", id);

    try {
      // Fetch comments
      const { data: comments, error: commentsError } = await supabase
        .from("report_comments")
        .select("id, comment, created_at, user_id")
        .eq("report_id", id)
        .eq("is_internal", true)
        .order("created_at", { ascending: false });

      console.log("📊 Internal notes query result:", { 
        count: comments?.length || 0, 
        commentsError,
        comments 
      });

      if (commentsError) {
        console.error("❌ Error fetching internal notes:", commentsError);
        return;
      }

      if (!comments || comments.length === 0) {
        console.log("ℹ️ No internal notes found");
        setInternalNotes([]);
        return;
      }

      // Fetch user profiles for the comments
      const userIds = [...new Set(comments.map(c => c.user_id))];
      console.log("👥 Fetching profiles for user IDs:", userIds);
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      console.log("👤 Profiles query result:", { profiles, profilesError });

      // Map profiles to comments
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const notesWithUsers = comments.map(comment => {
        const profile = profilesMap.get(comment.user_id);
        return {
          ...comment,
          user_name: profile?.full_name || profile?.email || 'User'
        };
      });

      console.log("✅ Setting internal notes:", notesWithUsers);
      setInternalNotes(notesWithUsers);
    } catch (error) {
      console.error("💥 Error fetching internal notes:", error);
    }
  };

  const saveInternalNote = async () => {
    if (!internalNote.trim() || !id || !report) return;

    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Anda harus login untuk menyimpan catatan",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("report_comments").insert({
        report_id: id,
        comment: internalNote.trim(),
        is_internal: true,
        user_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Catatan internal berhasil disimpan",
      });

      setInternalNote("");
      await fetchInternalNotes();
    } catch (error: any) {
      console.error("Error saving internal note:", error);
      toast({
        title: "Gagal menyimpan catatan",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Tersalin",
      description: "ID Tiket berhasil disalin ke clipboard",
    });
  };

  const downloadImage = async () => {
    if (!report?.photo_url) return;

    try {
      const response = await fetch(report.photo_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${report.ticket_id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Berhasil",
        description: "Foto berhasil diunduh",
      });
    } catch (error) {
      toast({
        title: "Gagal mengunduh foto",
        description: "Terjadi kesalahan saat mengunduh foto",
        variant: "destructive",
      });
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

  if (loading) {
    return (
      <Dashboard>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Dashboard>
    );
  }

  if (!report) {
    console.log("⚠️ Rendering 'not found' state. Report is null. ID:", id);
    return (
      <Dashboard>
        <div className="text-center py-12 space-y-4">
          <p className="text-xl font-semibold text-muted-foreground">Laporan tidak ditemukan</p>
          <p className="text-sm text-muted-foreground">ID: {id}</p>
          <div className="text-xs text-muted-foreground bg-muted p-4 rounded-lg max-w-md mx-auto">
            <p className="font-mono">Silakan periksa console browser (F12) untuk detail error</p>
          </div>
          <Button onClick={() => navigate("/admin/reports")} variant="outline">
            Kembali ke Daftar Laporan
          </Button>
        </div>
      </Dashboard>
    );
  }

  // Apply PII masking based on current user's role (L0=full, L1=partial, L2=de-id)
  const displayReport = maskReport(report);

  const maskingLevelBadge = {
    L0: { label: 'Akses Penuh', className: 'bg-green-100 text-green-700 border border-green-200' },
    L1: { label: 'Data Disamarkan', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
    L2: { label: 'Anonim', className: 'bg-red-100 text-red-700 border border-red-200' },
    L3: { label: 'Anonim', className: 'bg-red-100 text-red-700 border border-red-200' },
  }[level];

  return (
    <Dashboard>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/admin/reports")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Detail Laporan</h1>
              <p className="text-muted-foreground">Informasi lengkap tentang laporan ini</p>
            </div>
          </div>
          {(role === "admin" || role === "superadmin") && (
            <Button variant="destructive" onClick={deleteReport}>
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus Laporan
            </Button>
          )}
        </div>

        {/* Ticket ID Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <code className="text-2xl font-mono font-bold bg-muted px-4 py-2 rounded-lg">{report.ticket_id}</code>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(report.ticket_id)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={getTypeColor(report.type)} variant="outline">
                  {report.type}
                </Badge>
                <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT COLUMN (60%) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Reporter Information Card - Compact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Informasi Pelapor</CardTitle>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${maskingLevelBadge.className}`}>
                    {maskingLevelBadge.label}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Nama Pelapor</p>
                    <p className="text-sm font-semibold">{displayReport.reporter_name}</p>
                  </div>
                  {conversation?.phone_number && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Nomor WhatsApp</p>
                      <p className="text-sm font-mono">{maskPhone(conversation.phone_number, level)}</p>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Alamat</p>
                  <p className="text-sm">{displayReport.address}</p>
                </div>
              </CardContent>
            </Card>

            {/* Description Card - Compact */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Deskripsi Laporan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* AI Insight Section (includes Classification) */}
            <AIInsightSection
              reportId={report.id}
              reportData={{
                id: report.id,
                ticket_id: report.ticket_id,
                reporter_name: displayReport.reporter_name,
                phone: displayReport.phone,
                address: displayReport.address,
                description: report.description,
                type: report.type,
                status: report.status,
                created_at: report.created_at,
                assigned_opd_name: assignedOPD?.name || null,
                disposition_notes: report.disposition_notes,
              }}
            />

            {/* Timeline - Moved Here */}
            <DispositionTimeline reportId={report.id} />

            {/* Location Card - Smaller */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lokasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayReport.geo_location && displayReport.geo_location.lat !== null && displayReport.geo_location.lng !== null ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Latitude</p>
                        <p className="text-sm font-mono">{displayReport.geo_location.lat.toFixed(level === 'L0' ? 6 : 2)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Longitude</p>
                        <p className="text-sm font-mono">{displayReport.geo_location.lng.toFixed(level === 'L0' ? 6 : 2)}</p>
                      </div>
                    </div>
                    <div className="h-[280px] rounded-lg overflow-hidden border">
                      <Suspense
                        fallback={
                          <div className="h-full flex items-center justify-center bg-muted">
                            <p className="text-sm text-muted-foreground">Memuat peta...</p>
                          </div>
                        }
                      >
                        <LeafletMap latitude={displayReport.geo_location.lat} longitude={displayReport.geo_location.lng} />
                      </Suspense>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">Tidak ada data lokasi</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN (40%) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pending Return Request — prominent card, visible to Member/Admin only */}
            {!isOPDMember && pendingReturnRequest && (
              <Card className="border-orange-300 bg-orange-50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-900 flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-orange-600" />
                    Permintaan Pengembalian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-orange-800">
                    <span className="font-semibold">{pendingReturnRequest.profiles?.full_name || "OPD Member"}</span> meminta laporan ini dikembalikan ke pool Member.
                  </p>
                  {pendingReturnRequest.notes && (
                    <p className="text-xs text-orange-700 italic bg-orange-100 rounded p-2">"{pendingReturnRequest.notes}"</p>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white mt-1"
                    onClick={() => setShowReturnApprovalDialog(true)}
                  >
                    Tinjau &amp; Setujui Pengembalian
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Photo Thumbnail Card */}
            {report.photo_url && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Foto Laporan</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div
                    className="relative group cursor-pointer rounded-lg overflow-hidden"
                    onClick={() => setShowImageModal(true)}
                  >
                    <img
                      src={report.photo_url}
                      alt="Report Thumbnail"
                      className="w-full h-auto object-cover rounded-lg transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white text-center">
                        <p className="text-sm font-medium">Klik untuk memperbesar</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Unduh Foto
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions Panel - Consolidated */}
            <Card className="lg:sticky lg:top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Panel Aksi</CardTitle>
                <CardDescription className="text-xs">Kelola laporan ini</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Section 1: Status Update */}
                <div className="space-y-2">
                  <Label htmlFor="status-select" className="text-xs font-semibold">Ubah Status</Label>
                  <Select
                    value={report.status}
                    onValueChange={(value) => updateStatus(value as "pending" | "in_progress" | "resolved" | "rejected")}
                  >
                    <SelectTrigger id="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">Dalam Proses</SelectItem>
                      <SelectItem value="resolved">Selesai</SelectItem>
                      <SelectItem value="rejected">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Section 2: OPD Disposition */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Disposisi OPD
                    </Label>
                  </div>
                  {assignedOPD ? (
                    <div className="space-y-2">
                      <div className="bg-primary/5 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="default" className="text-xs">{assignedOPD.code}</Badge>
                          <span className="text-xs font-medium">{assignedOPD.name}</span>
                        </div>
                        {assignedOPD.head_name && (
                          <p className="text-xs text-muted-foreground">Kepala: {assignedOPD.head_name}</p>
                        )}
                      </div>
                      {report.disposition_notes && (
                        <div className="bg-muted p-2 rounded-lg">
                          <p className="text-xs font-medium mb-1">Catatan:</p>
                          <p className="text-xs text-muted-foreground">{report.disposition_notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-muted/30 rounded-lg">
                      <Building2 className="h-8 w-8 mx-auto mb-1 opacity-30" />
                      <p className="text-xs text-muted-foreground">Belum didisposisikan</p>
                    </div>
                  )}
                  {isOPDMember ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowReturnDialog(true)}
                      disabled={!assignedOPD}
                    >
                      <RotateCcw className="h-3 w-3 mr-2" />
                      Kembalikan ke Member
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowDispositionDialog(true)}
                    >
                      <Edit className="h-3 w-3 mr-2" />
                      {assignedOPD ? "Ubah Disposisi" : "Disposisikan"}
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Section 3: Internal Notes */}
                <div className="space-y-3">
                  <Label htmlFor="internal-note" className="text-xs font-semibold">Catatan Internal</Label>
                  
                  {/* Existing Notes Display */}
                  {internalNotes.length > 0 && (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                      {internalNotes.map((note) => (
                        <div key={note.id} className="bg-muted/50 rounded-md p-2 space-y-1">
                          <p className="text-xs text-foreground">{note.comment}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{note.user_name || 'User'}</span>
                            <span>{new Date(note.created_at).toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Note */}
                  <Textarea
                    id="internal-note"
                    placeholder="Tulis catatan internal..."
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <Button 
                    size="sm" 
                    className="w-full" 
                    onClick={saveInternalNote}
                    disabled={!internalNote.trim() || savingNote}
                  >
                    {savingNote ? "Menyimpan..." : "Simpan Catatan"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metadata Card - Time Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informasi Waktu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Dibuat</p>
                  <p className="text-xs font-medium">{new Date(report.created_at).toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terakhir Diperbarui</p>
                  <p className="text-xs font-medium">{new Date(report.updated_at).toLocaleString("id-ID")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Image Modal Dialog */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-4">
          <DialogHeader>
            <DialogTitle>Foto Laporan</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img
              src={report.photo_url || ""}
              alt="Report Full Size"
              className="max-w-full max-h-[calc(95vh-10rem)] object-contain rounded-lg"
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={downloadImage} variant="secondary" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Unduh Foto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disposition Dialog */}
      {!isOPDMember && (
        <ReportDispositionDialog
          open={showDispositionDialog}
          onOpenChange={setShowDispositionDialog}
          reports={[report]}
          onSuccess={() => {
            setShowDispositionDialog(false);
            fetchReport();
          }}
        />
      )}

      {/* Return Dialog for OPD Members */}
      {isOPDMember && (
        <OPDMemberReturnDialog
          open={showReturnDialog}
          onOpenChange={setShowReturnDialog}
          reports={[report]}
          onSuccess={() => {
            setShowReturnDialog(false);
            fetchReport();
          }}
        />
      )}

      {/* Return Request Approval Dialog for Members/Admins */}
      {!isOPDMember && (
        <ReturnRequestApprovalDialog
          open={showReturnApprovalDialog}
          onOpenChange={setShowReturnApprovalDialog}
          request={pendingReturnRequest}
          onSuccess={() => {
            setShowReturnApprovalDialog(false);
            setPendingReturnRequest(null);
            fetchReport();
          }}
        />
      )}
    </Dashboard>
  );
};

export default ReportDetail;
