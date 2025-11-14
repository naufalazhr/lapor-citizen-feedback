import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Download, Trash2, Building2, Edit, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { lazy, Suspense } from "react";
import { DispositionTimeline } from "@/components/admin/DispositionTimeline";
import { ReportDispositionDialog } from "@/components/admin/ReportDispositionDialog";
import { OPDMemberReturnDialog } from "@/components/admin/OPDMemberReturnDialog";
import { useUserRole } from "@/hooks/use-user-role";

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
  const [showDispositionDialog, setShowDispositionDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const { toast } = useToast();
  const { isOPDMember, role } = useUserRole();

  console.log("🎨 ReportDetail render - ID:", id, "Loading:", loading, "Report:", report ? "exists" : "null");

  useEffect(() => {
    console.log("🚀 ReportDetail component mounted/updated. ID:", id);
    if (id) {
      fetchReport();
    } else {
      console.error("❌ No ID provided in URL params");
    }
  }, [id]);

  const fetchReport = async () => {
    console.log("🔍 Fetching report with ID:", id);
    setLoading(true);

    try {
      // Fetch report data
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("id", id)
        .single();

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

  const updateStatus = async (status: "pending" | "in_progress" | "resolved" | "rejected") => {
    if (!report) return;

    const { data, error } = await supabase.rpc('update_report_status', {
      p_report_id: report.id,
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

  return (
    <Dashboard>
      <div className="space-y-6">
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
          {(role === 'admin' || role === 'superadmin') && (
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
                <code className="text-2xl font-mono font-bold bg-muted px-4 py-2 rounded-lg">
                  {report.ticket_id}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(report.ticket_id)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={getTypeColor(report.type)} variant="outline">
                  {report.type}
                </Badge>
                <Badge className={getStatusColor(report.status)}>
                  {report.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Report Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informasi Pelapor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nama Pelapor</p>
                  <p className="text-lg font-semibold">{report.reporter_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nomor Pengguna</p>
                  <p className="text-lg font-mono">
                    {conversation?.device_number || report.phone || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Nomor yang diinput pengguna</p>
                </div>
                {conversation?.phone_number && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nomor Device WhatsApp</p>
                    <p className="text-lg font-mono">{conversation.phone_number}</p>
                    <p className="text-xs text-muted-foreground mt-1">Nomor device yang menerima pesan</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Alamat</p>
                  <p className="text-base">{report.address}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deskripsi Laporan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base whitespace-pre-wrap">{report.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ubah Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={report.status}
                  onValueChange={(value) => updateStatus(value as "pending" | "in_progress" | "resolved" | "rejected")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">Dalam Proses</SelectItem>
                    <SelectItem value="resolved">Selesai</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Catatan Internal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="internal-note">Tambah Catatan</Label>
                  <Textarea
                    id="internal-note"
                    placeholder="Tulis catatan internal untuk laporan ini..."
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button className="w-full" disabled>
                  Simpan Catatan (Segera Hadir)
                </Button>
              </CardContent>
            </Card>

            {/* OPD Disposition Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Disposisi OPD
                  </CardTitle>
                  {isOPDMember ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReturnDialog(true)}
                      disabled={!assignedOPD}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Kembalikan ke Member
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDispositionDialog(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {assignedOPD ? "Ubah" : "Disposisikan"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {assignedOPD ? (
                  <div className="space-y-3">
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">{assignedOPD.code}</Badge>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="font-medium">{assignedOPD.name}</span>
                      </div>
                      {assignedOPD.head_name && (
                        <p className="text-sm text-muted-foreground">
                          Kepala: {assignedOPD.head_name}
                        </p>
                      )}
                    </div>
                    {report.disposition_notes && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Catatan Disposisi:</p>
                        <p className="text-sm text-muted-foreground">
                          {report.disposition_notes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Belum didisposisikan ke OPD</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informasi Waktu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Dibuat</p>
                  <p className="text-base">{new Date(report.created_at).toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Terakhir Diperbarui</p>
                  <p className="text-base">{new Date(report.updated_at).toLocaleString("id-ID")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Photo & Map */}
          <div className="space-y-6">
            {report.photo_url && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Foto Laporan</CardTitle>
                    <Button variant="outline" size="sm" onClick={downloadImage}>
                      <Download className="h-4 w-4 mr-2" />
                      Unduh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <img
                    src={report.photo_url}
                    alt="Report"
                    className="w-full rounded-lg border object-cover"
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Lokasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.geo_location && 
                 report.geo_location.lat !== null && 
                 report.geo_location.lng !== null ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Latitude</p>
                        <p className="text-base font-mono">{report.geo_location.lat.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Longitude</p>
                        <p className="text-base font-mono">{report.geo_location.lng.toFixed(6)}</p>
                      </div>
                    </div>
                    
                    <Suspense fallback={
                      <div className="rounded-lg overflow-hidden border h-[400px] flex items-center justify-center bg-muted">
                        <p className="text-muted-foreground">Loading map...</p>
                      </div>
                    }>
                      <LeafletMap 
                        latitude={report.geo_location.lat} 
                        longitude={report.geo_location.lng} 
                      />
                    </Suspense>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Tidak ada data lokasi untuk laporan ini
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Disposition Timeline - Full Width */}
        <DispositionTimeline reportId={report.id} />
      </div>

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
    </Dashboard>
  );
};

export default ReportDetail;
