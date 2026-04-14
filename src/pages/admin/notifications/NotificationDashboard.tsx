import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "../Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  MessageSquare,
  Mail,
  History,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Send,
} from "lucide-react";

interface DashboardStats {
  settingsEnabled: boolean;
  waConfigured: boolean;
  contactsSynced: number;
  contactsTotal: number;
  sentToday: number;
  failedToday: number;
}

interface DryRunResult {
  dry_run: true;
  blocked: boolean;
  stopped_reason?: string;
  would_send?: number;
  would_skip_cooldown?: number;
  would_skip_unsynced?: number;
  would_skip_no_phone?: number;
  would_cap_clip?: number;
  total_reports_in_send_queue?: number;
  daily_quota_remaining?: number;
  daily_quota_max?: number;
  estimated_duration_seconds?: number;
}

const BLOCKED_REASON_LABELS: Record<string, { title: string; help: string; actionPath?: string; actionLabel?: string }> = {
  no_settings_row: {
    title: "Belum ada pengaturan",
    help: "Buka Pengaturan dan simpan konfigurasi notifikasi terlebih dahulu.",
    actionPath: "/admin/notifications/settings",
    actionLabel: "Buka Pengaturan",
  },
  disabled: {
    title: "Sistem notifikasi dinonaktifkan",
    help: "Master switch di Pengaturan saat ini OFF. Aktifkan untuk mulai mengirim.",
    actionPath: "/admin/notifications/settings",
    actionLabel: "Buka Pengaturan",
  },
  whatsapp_channel_off: {
    title: "Channel WhatsApp dimatikan",
    help: "channel_whatsapp = false. Aktifkan di Pengaturan.",
    actionPath: "/admin/notifications/settings",
    actionLabel: "Buka Pengaturan",
  },
  quiet_hours: {
    title: "Dalam Jam Tenang",
    help: "Waktu saat ini ada di dalam window jam tenang yang Anda atur. Ubah window di Pengaturan, atau tunggu sampai keluar dari jam tenang.",
    actionPath: "/admin/notifications/settings",
    actionLabel: "Atur Jam Tenang",
  },
  no_whatsapp_config: {
    title: "Provider WhatsApp belum dikonfigurasi",
    help: "Buka Channel → WhatsApp, pilih Fonnte, dan isi token serta nomor perangkat notifikasi.",
    actionPath: "/admin/notifications/channel/whatsapp",
    actionLabel: "Konfigurasi Channel",
  },
  daily_cap_reached: {
    title: "Kuota harian tercapai",
    help: "max_daily_messages sudah habis untuk hari ini. Naikkan batas di Pengaturan atau tunggu sampai besok.",
    actionPath: "/admin/notifications/settings",
    actionLabel: "Naikkan Kuota",
  },
};

const NotificationDashboardPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    settingsEnabled: false,
    waConfigured: false,
    contactsSynced: 0,
    contactsTotal: 0,
    sentToday: 0,
    failedToday: 0,
  });

  // Test Kirim dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [actualRunLoading, setActualRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  const openTestKirimDialog = async () => {
    setDryRunLoading(true);
    setDryRunResult(null);
    setDialogOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sla-notifications",
        { body: { dry_run: true, triggered_by: "manual_admin" } }
      );
      if (error) throw error;
      setDryRunResult(data as DryRunResult);
    } catch (err: any) {
      toast({
        title: "Gagal memeriksa status",
        description: err.message || "Tidak dapat terhubung ke fungsi notifikasi.",
        variant: "destructive",
      });
      setDialogOpen(false);
    } finally {
      setDryRunLoading(false);
    }
  };

  const confirmAndSend = async () => {
    setActualRunLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sla-notifications",
        { body: { triggered_by: "manual_admin" } }
      );
      if (error) throw error;
      const result = data as { sent?: number; failed?: number; skipped_cooldown?: number; stopped_reason?: string };
      toast({
        title: "Pengiriman selesai",
        description: `${result.sent ?? 0} terkirim · ${result.failed ?? 0} gagal · ${result.skipped_cooldown ?? 0} dilewati karena cooldown.`,
      });
      await fetchStats();
    } catch (err: any) {
      toast({
        title: "Gagal memicu pengiriman",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setActualRunLoading(false);
      setDialogOpen(false);
    }
  };

  useEffect(() => {
    init();
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
        description: "Hanya admin yang dapat mengakses halaman ini.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    await fetchStats();
    setLoading(false);
  };

  const fetchStats = async () => {
    const [settingsRes, waRes, contactsRes, opdsRes] = await Promise.all([
      supabase.from("notification_settings" as any).select("is_enabled").limit(1).maybeSingle(),
      supabase.from("notification_whatsapp_config" as any).select("is_active, api_token").limit(1).maybeSingle(),
      supabase.from("notification_contacts" as any).select("sync_status"),
      supabase
        .from("opds")
        .select("id, contact_phone")
        .eq("is_active", true),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [sentCountRes, failedCountRes] = await Promise.all([
      supabase
        .from("notification_log" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", todayIso),
      supabase
        .from("notification_log" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", todayIso),
    ]);

    const syncedCount = ((contactsRes.data ?? []) as any[]).filter(
      (c) => c.sync_status === "synced"
    ).length;

    // Count OPDs that have a contact_phone set (eligible for notifications)
    const totalOpdsWithPhone = ((opdsRes.data ?? []) as any[]).filter(
      (o) => o.contact_phone && o.contact_phone.trim().length > 0
    ).length;

    setStats({
      settingsEnabled: !!(settingsRes.data as any)?.is_enabled,
      waConfigured:
        !!(waRes.data as any)?.is_active && !!(waRes.data as any)?.api_token,
      contactsSynced: syncedCount,
      contactsTotal: totalOpdsWithPhone,
      sentToday: sentCountRes.count ?? 0,
      failedToday: failedCountRes.count ?? 0,
    });
  };

  const statusPill = (ok: boolean, label: string) => (
    <Badge
      className={
        ok
          ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
          : "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
      }
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3 mr-1" />
      ) : (
        <XCircle className="h-3 w-3 mr-1" />
      )}
      {label}
    </Badge>
  );

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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Sistem Notifikasi
          </h1>
          <p className="text-muted-foreground mt-1">
            Notifikasi otomatis ke petugas OPD tentang laporan pending/terlambat
          </p>
        </div>

        {/* System Status */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-base">Status Sistem</CardTitle>
            <CardDescription>Kesiapan sistem notifikasi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Sistem Notifikasi</span>
              {statusPill(stats.settingsEnabled, stats.settingsEnabled ? "Aktif" : "Nonaktif")}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Channel WhatsApp</span>
              {statusPill(
                stats.waConfigured,
                stats.waConfigured ? "Terkonfigurasi" : "Belum dikonfigurasi"
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Kontak Tersinkron</span>
              <Badge variant="outline">
                {stats.contactsSynced} / {stats.contactsTotal}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Today's activity */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground uppercase">Terkirim Hari Ini</div>
              <div className="text-3xl font-bold text-green-600 mt-1">{stats.sentToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground uppercase">Gagal Hari Ini</div>
              <div className="text-3xl font-bold text-red-600 mt-1">{stats.failedToday}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate("/admin/notifications/settings")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">Pengaturan</div>
                    <div className="text-sm text-muted-foreground">Jadwal & ambang</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate("/admin/notifications/channel/whatsapp")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">Channel WhatsApp</div>
                    <div className="text-sm text-muted-foreground">Perangkat Fonnte</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate("/admin/notifications/history")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">Riwayat</div>
                    <div className="text-sm text-muted-foreground">Log pengiriman</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="opacity-60 cursor-pointer"
            onClick={() => navigate("/admin/notifications/channel/email")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">Channel Email</div>
                    <div className="text-sm text-muted-foreground">Coming soon</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test run button — opens confirmation dialog */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test Kirim</CardTitle>
            <CardDescription>
              Jalankan cron job secara manual sekarang juga untuk memicu pengiriman.
              Sistem akan menampilkan pratinjau dampak sebelum mengirim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={openTestKirimDialog}>
              <Send className="mr-2 h-4 w-4" />
              Picu Pengiriman Sekarang
            </Button>
          </CardContent>
        </Card>

        {/* Test Kirim confirmation dialog */}
        <AlertDialog open={dialogOpen} onOpenChange={(open) => !actualRunLoading && setDialogOpen(open)}>
          <AlertDialogContent className="max-w-lg">
            {dryRunLoading ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Memeriksa dampak pengiriman…</AlertDialogTitle>
                  <AlertDialogDescription>
                    Menghitung berapa OPD yang akan menerima pesan WhatsApp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </>
            ) : dryRunResult?.blocked ? (
              (() => {
                const reason = dryRunResult.stopped_reason ?? "";
                const meta = BLOCKED_REASON_LABELS[reason] ?? {
                  title: "Pengiriman diblokir",
                  help: `Alasan: ${reason}`,
                };
                return (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        {meta.title}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="pt-2">
                        {meta.help}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Tutup</AlertDialogCancel>
                      {meta.actionPath && (
                        <AlertDialogAction
                          onClick={() => {
                            setDialogOpen(false);
                            navigate(meta.actionPath!);
                          }}
                        >
                          {meta.actionLabel ?? "Perbaiki"}
                        </AlertDialogAction>
                      )}
                    </AlertDialogFooter>
                  </>
                );
              })()
            ) : dryRunResult ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Pengiriman Manual</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini akan mengirim pesan WhatsApp <strong>nyata</strong> ke
                    nomor kontak OPD. Pastikan Anda siap melanjutkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-3 py-2">
                  {/* Primary impact line */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="text-xs text-muted-foreground uppercase">Akan dikirim ke</div>
                    <div className="text-3xl font-bold text-primary mt-1">
                      {dryRunResult.would_send ?? 0}{" "}
                      <span className="text-base font-normal text-muted-foreground">OPD</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Total {dryRunResult.total_reports_in_send_queue ?? 0} laporan dalam digest
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Cooldown</div>
                      <div className="font-semibold">
                        {dryRunResult.would_skip_cooldown ?? 0} OPD
                      </div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Kontak belum disinkron</div>
                      <div className="font-semibold">
                        {dryRunResult.would_skip_unsynced ?? 0} OPD
                      </div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Tanpa HP</div>
                      <div className="font-semibold">
                        {dryRunResult.would_skip_no_phone ?? 0} OPD
                      </div>
                    </div>
                  </div>

                  {/* Quota + duration */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Kuota harian tersisa:{" "}
                      <span className="font-medium text-foreground">
                        {dryRunResult.daily_quota_remaining ?? 0} / {dryRunResult.daily_quota_max ?? 0}
                      </span>
                    </div>
                    {(dryRunResult.would_cap_clip ?? 0) > 0 && (
                      <div className="text-amber-600">
                        ⚠ {dryRunResult.would_cap_clip} OPD akan tertahan karena kuota harian.
                      </div>
                    )}
                    <div>
                      Estimasi waktu: <span className="font-medium text-foreground">
                        ~{dryRunResult.estimated_duration_seconds ?? 0} detik
                      </span>
                    </div>
                  </div>
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={actualRunLoading}>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmAndSend();
                    }}
                    disabled={actualRunLoading || (dryRunResult.would_send ?? 0) === 0}
                  >
                    {actualRunLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Ya, Kirim Sekarang
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : null}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Dashboard>
  );
};

export default NotificationDashboardPage;
