import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "../Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Loader2,
  Search,
  Download,
  ExternalLink,
  Copy,
  Check,
  Undo2,
  ChevronLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { normalizeIndonesianPhone, sanitizeContactName } from "@/utils/phone";

interface OpdContactRow {
  opd_id: string;
  opd_name: string;
  opd_code: string | null;
  contact_phone: string | null;
  sync_status: "pending" | "synced" | "never";
  synced_at: string | null;
}

// -----------------------------------------------------------------------------
// CSV generation for Fonnte Phone Book import
// Format: Whatsapp,Name,Variable with trailing apostrophe on phone
// -----------------------------------------------------------------------------
function buildFonnteContactsCSV(opds: OpdContactRow[]): string {
  const header = "Whatsapp,Name,Variable";
  const rows = opds
    .filter((o) => o.contact_phone && o.contact_phone.trim().length > 0)
    .map((o) => {
      const phone = normalizeIndonesianPhone(o.contact_phone as string);
      const name = sanitizeContactName(
        o.opd_code ? `${o.opd_code} - ${o.opd_name}` : o.opd_name
      );
      const variable = `LAPOR|${o.opd_code ?? "OPD"}`;
      // Trailing apostrophe forces Excel (and Fonnte's importer) to treat
      // the phone as text rather than a giant integer.
      return `${phone}',${csvEscape(name)},${csvEscape(variable)}`;
    });
  return [header, ...rows].join("\n");
}

function csvEscape(s: string): string {
  if (s == null) return "";
  // Quote if contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const NotificationContactsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OpdContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyOpds, setBusyOpds] = useState<Set<string>>(new Set());
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init();
    return () => {
      if (copyResetTimeoutRef.current) clearTimeout(copyResetTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "owner", "superadmin"])
      .maybeSingle();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya admin yang dapat mengakses sinkron kontak.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    await fetchRows();
    setLoading(false);
  };

  const fetchRows = async () => {
    // Fetch OPDs and all notification_contacts in parallel.
    // Single-tenant deployment: notification_contacts is bounded by number
    // of OPDs (small), so fetching all rows then joining in memory is cheap
    // and removes the data dependency between the two queries.
    const [opdsRes, contactsRes] = await Promise.all([
      supabase
        .from("opds")
        .select("id, name, code, contact_phone")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("notification_contacts" as any)
        .select("opd_id, sync_status, synced_at"),
    ]);

    if (opdsRes.error) {
      toast({
        title: "Gagal memuat daftar OPD",
        description: opdsRes.error.message,
        variant: "destructive",
      });
      return;
    }

    const opds = opdsRes.data ?? [];
    if (opds.length === 0) {
      setRows([]);
      return;
    }

    const contactMap = new Map<
      string,
      { sync_status: string; synced_at: string | null }
    >();
    for (const c of ((contactsRes.data ?? []) as any[])) {
      contactMap.set(c.opd_id, {
        sync_status: c.sync_status,
        synced_at: c.synced_at,
      });
    }

    const next: OpdContactRow[] = opds.map((o) => {
      const c = contactMap.get(o.id);
      let status: OpdContactRow["sync_status"] = "never";
      if (c?.sync_status === "synced") status = "synced";
      else if (c?.sync_status === "pending") status = "pending";
      return {
        opd_id: o.id,
        opd_name: o.name,
        opd_code: o.code,
        contact_phone: o.contact_phone,
        sync_status: status,
        synced_at: c?.synced_at ?? null,
      };
    });

    // Sort: unsynced (never/pending) first, then synced
    next.sort((a, b) => {
      const order: Record<string, number> = {
        never: 0,
        pending: 1,
        synced: 2,
      };
      return (order[a.sync_status] ?? 9) - (order[b.sync_status] ?? 9);
    });

    setRows(next);
  };

  const invokeSync = async (
    body: Record<string, unknown>
  ): Promise<{ data: any; error: any }> => {
    return supabase.functions.invoke("sync-notification-contact", { body });
  };

  const markOpd = async (opdId: string) => {
    setBusyOpds((prev) => new Set(prev).add(opdId));
    try {
      const { data, error } = await invokeSync({ opd_id: opdId, action: "mark" });
      if (error) throw error;

      const result = (data as any)?.results?.[0];
      if (result?.status === "synced") {
        toast({
          title: "Ditandai sudah ditambahkan",
          description: `${result.opd_name} siap menerima notifikasi.`,
        });
      } else if (result?.status === "skipped") {
        const reasonMap: Record<string, string> = {
          no_phone: "OPD belum memiliki contact_phone",
          opd_inactive: "OPD tidak aktif",
          opd_not_found: "OPD tidak ditemukan",
        };
        toast({
          title: "Dilewati",
          description: reasonMap[result.skip_reason] || result.skip_reason || "Dilewati",
          variant: "destructive",
        });
      }

      await fetchRows();
    } catch (err: any) {
      toast({
        title: "Gagal menandai",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setBusyOpds((prev) => {
        const next = new Set(prev);
        next.delete(opdId);
        return next;
      });
    }
  };

  const unmarkOpd = async (opdId: string) => {
    setBusyOpds((prev) => new Set(prev).add(opdId));
    try {
      const { data, error } = await invokeSync({ opd_id: opdId, action: "unmark" });
      if (error) throw error;

      const result = (data as any)?.results?.[0];
      if (result?.status === "unsynced") {
        toast({
          title: "Penandaan dibatalkan",
          description: `${result.opd_name} kembali ke status belum tersinkron.`,
        });
      }

      await fetchRows();
    } catch (err: any) {
      toast({
        title: "Gagal membatalkan",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setBusyOpds((prev) => {
        const next = new Set(prev);
        next.delete(opdId);
        return next;
      });
    }
  };

  const markAll = async () => {
    setBulkBusy(true);
    try {
      const { data, error } = await invokeSync({ sync_all: true, action: "mark" });
      if (error) throw error;

      const summary = (data as any)?.summary ?? {};
      toast({
        title: "Selesai menandai",
        description: `${summary.synced ?? 0} ditandai, ${summary.skipped ?? 0} dilewati.`,
      });

      await fetchRows();
    } catch (err: any) {
      toast({
        title: "Gagal menandai semua",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = () => {
    const eligibleRows = rows.filter(
      (r) => r.contact_phone && r.contact_phone.trim().length > 0
    );

    if (eligibleRows.length === 0) {
      toast({
        title: "Tidak ada kontak untuk diekspor",
        description:
          "Belum ada OPD dengan contact_phone terisi. Isi terlebih dahulu di menu OPD.",
        variant: "destructive",
      });
      return;
    }

    const csv = buildFonnteContactsCSV(eligibleRows);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`lapor-kontak-opd-${today}.csv`, csv);

    toast({
      title: "CSV diunduh",
      description: `${eligibleRows.length} kontak siap diimpor ke Fonnte.`,
    });
  };

  const openFonnteDashboard = () => {
    window.open("https://md.fonnte.com/", "_blank", "noopener,noreferrer");
  };

  const copyPhone = async (phone: string) => {
    try {
      const normalized = normalizeIndonesianPhone(phone);
      await navigator.clipboard.writeText(normalized);
      setCopiedPhone(phone);
      if (copyResetTimeoutRef.current) clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = setTimeout(() => setCopiedPhone(null), 1500);
    } catch {
      toast({
        title: "Gagal menyalin",
        variant: "destructive",
      });
    }
  };

  const filteredRows = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.opd_name.toLowerCase().includes(q) ||
      (r.opd_code ?? "").toLowerCase().includes(q) ||
      (r.contact_phone ?? "").toLowerCase().includes(q)
    );
  });

  const stats = {
    total: rows.length,
    synced: rows.filter((r) => r.sync_status === "synced").length,
    never: rows.filter((r) => r.sync_status === "never" || r.sync_status === "pending").length,
    noPhone: rows.filter((r) => !r.contact_phone).length,
  };

  const renderStatusBadge = (row: OpdContactRow) => {
    if (!row.contact_phone) {
      return (
        <Badge variant="outline" className="border-gray-300 text-gray-500">
          Tanpa HP
        </Badge>
      );
    }
    if (row.sync_status === "synced") {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Sudah ditambahkan
        </Badge>
      );
    }
    if (row.sync_status === "pending") {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
          <Clock className="h-3 w-3 mr-1" />
          Menunggu
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-gray-300 text-gray-600">
        Belum ditambahkan
      </Badge>
    );
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Memuat...</span>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        {/* Back navigation */}
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/admin/notifications/channel/whatsapp")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Kembali ke Channel WhatsApp
        </Button>

        {/* Header with provider context */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
            <span>Channel WhatsApp</span>
            <span>/</span>
            <span className="text-foreground">Provider: Fonnte</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Sinkron Kontak
          </h1>
          <p className="text-muted-foreground mt-1">
            Tambahkan kontak OPD ke Phone Book Fonnte secara manual — langkah
            anti-banned khusus untuk provider Fonnte
          </p>
        </div>

        <Alert className="border-l-4 border-l-primary">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Kenapa Perlu Ditambahkan Sebagai Kontak?</AlertTitle>
          <AlertDescription className="mt-2 text-sm">
            WhatsApp memperlakukan pesan ke nomor yang sudah tersimpan sebagai kontak
            jauh lebih longgar daripada ke nomor asing. Sistem akan{" "}
            <strong>menolak</strong> mengirim notifikasi ke OPD yang belum ditandai
            sebagai pengaman anti-banned.
          </AlertDescription>
        </Alert>

        {/* Step-by-step instructions */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-base">Langkah Sinkron Kontak</CardTitle>
            <CardDescription>
              Fonnte tidak menyediakan API untuk menambah kontak secara otomatis, jadi
              ikuti langkah berikut secara manual (hanya sekali):
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  1
                </span>
                <div>
                  <div className="font-medium">Unduh file CSV</div>
                  <div className="text-muted-foreground">
                    Klik tombol <strong>Unduh CSV</strong> di bawah untuk menyimpan
                    file dalam format yang dikenali Fonnte.
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  2
                </span>
                <div>
                  <div className="font-medium">Buka Dashboard Fonnte</div>
                  <div className="text-muted-foreground">
                    Klik <strong>Buka Fonnte</strong> untuk masuk ke dashboard di tab
                    baru. Gunakan akun perangkat notifikasi (bukan akun percakapan).
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  3
                </span>
                <div>
                  <div className="font-medium">Import di menu Phone Book</div>
                  <div className="text-muted-foreground">
                    Di Fonnte Dashboard: <em>Phone Book → Import Contacts</em> →
                    pilih file CSV yang baru diunduh.
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  4
                </span>
                <div>
                  <div className="font-medium">Kembali ke sini & tandai</div>
                  <div className="text-muted-foreground">
                    Setelah impor berhasil di Fonnte, klik{" "}
                    <strong>Tandai Semua Sudah Ditambahkan</strong> agar sistem
                    membuka gerbang pengiriman notifikasi.
                  </div>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase">Total OPD</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-green-600 uppercase">Sudah Ditambahkan</div>
              <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase">Belum</div>
              <div className="text-2xl font-bold">{stats.never}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 uppercase">Tanpa HP</div>
              <div className="text-2xl font-bold text-gray-500">{stats.noPhone}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-base">Daftar OPD</CardTitle>
                <CardDescription>
                  Semua OPD aktif di tenant ini
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama/kode/HP..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-56"
                  />
                </div>
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Unduh CSV
                </Button>
                <Button variant="outline" onClick={openFonnteDashboard}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Buka Fonnte
                </Button>
                <Button onClick={markAll} disabled={bulkBusy}>
                  {bulkBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menandai...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Tandai Semua Sudah Ditambahkan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama OPD</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nomor HP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terakhir Ditandai</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Tidak ada OPD aktif
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.opd_id}>
                      <TableCell className="font-medium">{row.opd_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.opd_code ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.contact_phone ? (
                          <div className="flex items-center gap-1">
                            <span>{row.contact_phone}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Salin nomor"
                              onClick={() => copyPhone(row.contact_phone as string)}
                            >
                              {copiedPhone === row.contact_phone ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{renderStatusBadge(row)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.synced_at
                          ? formatDistanceToNow(new Date(row.synced_at), { addSuffix: true })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.sync_status === "synced" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unmarkOpd(row.opd_id)}
                            disabled={busyOpds.has(row.opd_id)}
                            title="Batalkan penandaan"
                          >
                            {busyOpds.has(row.opd_id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Undo2 className="h-3 w-3 mr-1" />
                                Batalkan
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markOpd(row.opd_id)}
                            disabled={busyOpds.has(row.opd_id) || !row.contact_phone}
                          >
                            {busyOpds.has(row.opd_id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Tandai
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default NotificationContactsPage;
