import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Download, Trash2 } from "lucide-react";
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
};

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalNote, setInternalNote] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast({
        title: "Gagal mengambil data laporan",
        description: error.message,
        variant: "destructive",
      });
      navigate("/admin/reports");
    } else {
      setReport(data as unknown as Report);
    }
    setLoading(false);
  };

  const updateStatus = async (status: "pending" | "in_progress" | "resolved" | "rejected") => {
    if (!report) return;

    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", report.id);

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
    return (
      <Dashboard>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Laporan tidak ditemukan</p>
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
          <Button variant="destructive" onClick={deleteReport}>
            <Trash2 className="h-4 w-4 mr-2" />
            Hapus Laporan
          </Button>
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
                  <p className="text-sm font-medium text-muted-foreground">Telepon</p>
                  <p className="text-lg">{report.phone}</p>
                </div>
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
      </div>
    </Dashboard>
  );
};

export default ReportDetail;
