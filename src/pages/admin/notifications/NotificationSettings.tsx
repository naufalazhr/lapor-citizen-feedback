import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "../Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, Save, Loader2 } from "lucide-react";

interface NotificationSettingsRow {
  id: string;
  notify_pending: boolean;
  notify_overdue: boolean;
  pending_threshold_hours: number;
  overdue_threshold_hours: number;
  channel_whatsapp: boolean;
  frequency_label: string;
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
  max_daily_messages: number;
  delay_between_sends_ms: number;
  cooldown_hours: number;
  is_enabled: boolean;
}

const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "daily_8am", label: "Harian — 08:00 WIB" },
  { value: "twice_daily", label: "Dua kali sehari — 08:00 & 14:00 WIB" },
  { value: "every_6h", label: "Setiap 6 jam" },
  { value: "every_4h", label: "Setiap 4 jam" },
  { value: "custom", label: "Kustom (atur via SQL)" },
];

const NotificationSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsRow | null>(null);

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
        description: "Hanya admin yang dapat mengakses pengaturan notifikasi.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    await fetchSettings();
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("notification_settings" as any)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      toast({
        title: "Gagal memuat pengaturan",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setSettings(data as unknown as NotificationSettingsRow);
    } else {
      // Insert a default row if missing
      const { data: inserted } = await supabase
        .from("notification_settings" as any)
        .insert({ is_enabled: false })
        .select("*")
        .single();
      if (inserted) setSettings(inserted as unknown as NotificationSettingsRow);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings" as any)
        .update({
          notify_pending: settings.notify_pending,
          notify_overdue: settings.notify_overdue,
          pending_threshold_hours: settings.pending_threshold_hours,
          overdue_threshold_hours: settings.overdue_threshold_hours,
          channel_whatsapp: settings.channel_whatsapp,
          frequency_label: settings.frequency_label,
          quiet_start: settings.quiet_start,
          quiet_end: settings.quiet_end,
          timezone: settings.timezone,
          max_daily_messages: settings.max_daily_messages,
          delay_between_sends_ms: settings.delay_between_sends_ms,
          cooldown_hours: settings.cooldown_hours,
          is_enabled: settings.is_enabled,
        } as any)
        .eq("id", settings.id);

      if (error) throw error;

      toast({
        title: "Tersimpan",
        description: "Pengaturan notifikasi berhasil disimpan.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal menyimpan",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof NotificationSettingsRow>(
    key: K,
    value: NotificationSettingsRow[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading || !settings) {
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
            Pengaturan Notifikasi
          </h1>
          <p className="text-muted-foreground mt-1">
            Atur kapan dan bagaimana pengingat SLA dikirim ke petugas OPD.
          </p>
        </div>

        {/* Master Switch */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Status Sistem</CardTitle>
            <CardDescription>
              Aktifkan atau matikan seluruh sistem notifikasi SLA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Sistem Notifikasi Aktif</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Jika dimatikan, cron job tetap berjalan tapi tidak akan mengirim apapun.
                </p>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(v) => update("is_enabled", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Apa yang dinotifikasi */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jenis Laporan</CardTitle>
            <CardDescription>Pilih jenis laporan yang akan di-push</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Laporan Pending</Label>
                <p className="text-sm text-muted-foreground">
                  Laporan yang belum dikerjakan sama sekali
                </p>
              </div>
              <Switch
                checked={settings.notify_pending}
                onCheckedChange={(v) => update("notify_pending", v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ambang Pending (jam)</Label>
              <Input
                type="number"
                min={1}
                max={720}
                value={settings.pending_threshold_hours}
                onChange={(e) =>
                  update("pending_threshold_hours", Number(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                Laporan pending yang lebih lama dari ini akan masuk digest
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Laporan Terlambat</Label>
                <p className="text-sm text-muted-foreground">
                  Laporan sedang diproses tapi tidak ada pembaruan lama
                </p>
              </div>
              <Switch
                checked={settings.notify_overdue}
                onCheckedChange={(v) => update("notify_overdue", v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ambang Terlambat (jam)</Label>
              <Input
                type="number"
                min={1}
                max={2160}
                value={settings.overdue_threshold_hours}
                onChange={(e) =>
                  update("overdue_threshold_hours", Number(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Jadwal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jadwal Pengiriman</CardTitle>
            <CardDescription>
              Kapan notifikasi dikirim (jadwal nyata diatur di pg_cron)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preset Frekuensi</Label>
              <Select
                value={settings.frequency_label}
                onValueChange={(v) => update("frequency_label", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Label ini hanya untuk UI. Jadwal sebenarnya diatur via SQL
                <code className="mx-1 px-1 bg-muted rounded">cron.alter_job()</code>
                — default: setiap hari 08:00 WIB.
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jam Tenang Mulai</Label>
                <Input
                  type="time"
                  value={settings.quiet_start ?? ""}
                  onChange={(e) => update("quiet_start", e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Jam Tenang Selesai</Label>
                <Input
                  type="time"
                  value={settings.quiet_end ?? ""}
                  onChange={(e) => update("quiet_end", e.target.value || null)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Pesan tidak dikirim antara jam ini (zona waktu: {settings.timezone})
            </p>

            <div className="space-y-2">
              <Label>Zona Waktu</Label>
              <Input
                value={settings.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                placeholder="Asia/Jakarta"
              />
            </div>
          </CardContent>
        </Card>

        {/* Anti-ban controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaman Anti-Banned</CardTitle>
            <CardDescription>
              Batas volume dan jeda antar pesan — jangan ubah kalau tidak yakin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max Pesan Per Hari</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={settings.max_daily_messages}
                onChange={(e) =>
                  update("max_daily_messages", Number(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                Total pesan yang dikirim hari ini tidak akan melebihi angka ini
              </p>
            </div>
            <div className="space-y-2">
              <Label>Jeda Antar Pesan (ms)</Label>
              <Input
                type="number"
                min={0}
                max={60000}
                value={settings.delay_between_sends_ms}
                onChange={(e) =>
                  update("delay_between_sends_ms", Number(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                Rekomendasi: 3000-5000 ms + jitter acak
              </p>
            </div>
            <div className="space-y-2">
              <Label>Jeda Cooldown Per User (jam)</Label>
              <Input
                type="number"
                min={0}
                max={168}
                value={settings.cooldown_hours}
                onChange={(e) =>
                  update("cooldown_hours", Number(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                Satu OPD user maksimal menerima 1 notifikasi dalam periode ini
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Simpan Pengaturan
              </>
            )}
          </Button>
        </div>
      </div>
    </Dashboard>
  );
};

export default NotificationSettingsPage;
