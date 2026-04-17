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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, Save, Loader2, Plus, X, Clock } from "lucide-react";

type ScheduleMode = "daily" | "specific_times" | "every_n_hours";

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
  schedule_mode: ScheduleMode;
  schedule_times_wib: string[] | null;
  schedule_interval_hours: number | null;
}

const INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 8, 12];
const DEFAULT_DAILY_TIME = "08:00";
const DEFAULT_SPECIFIC_TIMES = ["08:00", "14:00"];
const DEFAULT_INTERVAL_HOURS = 6;

function toHHMM(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : value;
}

// Defensive fallback to raw cron if the expression isn't one of the three
// shapes our RPC emits (shouldn't happen, but avoids misleading output).
function humanReadableSchedule(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minute, hour, dom, month, dow] = parts;

  if (dom !== "*" || month !== "*" || dow !== "*") return cron;

  const intervalMatch = /^\*\/(\d+)$/.exec(hour);
  if (intervalMatch && minute === "0") {
    return `Setiap ${intervalMatch[1]} jam`;
  }

  if (!/^\d+$/.test(minute)) return cron;
  const hourParts = hour.split(",");
  if (!hourParts.every((h) => /^\d+$/.test(h))) return cron;

  const utcMinute = Number(minute);
  const wibTimes = hourParts
    .map((h) => (Number(h) + 7) % 24)
    .sort((a, b) => a - b)
    .map((h) => `${String(h).padStart(2, "0")}:${String(utcMinute).padStart(2, "0")}`);

  if (wibTimes.length === 1) return `Harian pukul ${wibTimes[0]} WIB`;
  return `Setiap hari pukul ${wibTimes.join(", ")} WIB`;
}

const NotificationSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsRow | null>(null);

  // Schedule form state lives separately from `settings` because the schedule
  // is persisted via an RPC (not the table UPDATE that `handleSave` does).
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("daily");
  const [dailyTime, setDailyTime] = useState(DEFAULT_DAILY_TIME);
  const [specificTimes, setSpecificTimes] = useState<string[]>(DEFAULT_SPECIFIC_TIMES);
  const [intervalHours, setIntervalHours] = useState<number>(DEFAULT_INTERVAL_HOURS);
  const [activeSchedule, setActiveSchedule] = useState<
    { status: "loading" } | { status: "unscheduled" } | { status: "active"; cron: string }
  >({ status: "loading" });

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

    await Promise.all([fetchSettings(), fetchActiveSchedule()]);
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

    const row = (data ??
      (await supabase
        .from("notification_settings" as any)
        .insert({ is_enabled: false })
        .select("*")
        .single()).data) as unknown as NotificationSettingsRow | null;
    if (!row) return;

    setSettings(row);
    setScheduleMode((row.schedule_mode ?? "daily") as ScheduleMode);
    if (row.schedule_times_wib && row.schedule_times_wib.length > 0) {
      const normalized = row.schedule_times_wib.map(toHHMM);
      if (row.schedule_mode === "specific_times") {
        setSpecificTimes(normalized.length >= 2 ? normalized : DEFAULT_SPECIFIC_TIMES);
      } else {
        setDailyTime(normalized[0]);
      }
    }
    if (row.schedule_interval_hours) {
      setIntervalHours(row.schedule_interval_hours);
    }
  };

  const fetchActiveSchedule = async () => {
    const { data, error } = await supabase.rpc("get_active_cron_schedule" as any);
    const payload = data as
      | { success: true; scheduled: boolean; schedule?: string }
      | { success: false; error: string }
      | null;
    if (error || !payload?.success) {
      setActiveSchedule({ status: "unscheduled" });
      return;
    }
    setActiveSchedule(
      payload.scheduled && payload.schedule
        ? { status: "active", cron: payload.schedule }
        : { status: "unscheduled" }
    );
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

  const handleSaveSchedule = async () => {
    let times: string[] | null = null;
    let interval: number | null = null;

    if (scheduleMode === "daily") {
      if (!dailyTime) {
        toast({ title: "Jam belum dipilih", variant: "destructive" });
        return;
      }
      times = [dailyTime];
    } else if (scheduleMode === "specific_times") {
      if (specificTimes.length < 2 || specificTimes.length > 4) {
        toast({ title: "Pilih 2 sampai 4 jam", variant: "destructive" });
        return;
      }
      const normalized = specificTimes.map(toHHMM);
      const minute = normalized[0].split(":")[1];
      if (!normalized.every((t) => t.split(":")[1] === minute)) {
        toast({
          title: "Menit harus sama",
          description: "Semua jam yang dipilih harus memiliki menit yang sama.",
          variant: "destructive",
        });
        return;
      }
      times = normalized;
    } else if (scheduleMode === "every_n_hours") {
      if (!INTERVAL_OPTIONS.includes(intervalHours)) {
        toast({ title: "Interval tidak valid", variant: "destructive" });
        return;
      }
      interval = intervalHours;
    }

    setSavingSchedule(true);
    try {
      const { data, error } = await supabase.rpc("set_notification_schedule" as any, {
        p_mode: scheduleMode,
        p_times_wib: times,
        p_interval_hours: interval,
      });

      if (error) throw error;
      const payload = data as { success: boolean; error?: string; cron_expression?: string };
      if (!payload?.success) {
        throw new Error(payload?.error || "Gagal menyimpan jadwal");
      }

      toast({
        title: "Jadwal diperbarui",
        description: payload.cron_expression
          ? `Cron aktif: ${payload.cron_expression}`
          : undefined,
      });
      await fetchActiveSchedule();
    } catch (err: any) {
      toast({
        title: "Gagal menyimpan jadwal",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const addSpecificTime = () => {
    if (specificTimes.length >= 4) return;
    const firstMinute = specificTimes[0]?.split(":")[1] ?? "00";
    const usedHours = new Set(specificTimes.map((t) => Number(t.split(":")[0])));
    let suggested = 0;
    for (let h = 0; h < 24; h++) {
      if (!usedHours.has(h)) {
        suggested = h;
        break;
      }
    }
    const nextTime = `${String(suggested).padStart(2, "0")}:${firstMinute}`;
    setSpecificTimes([...specificTimes, nextTime]);
  };

  const removeSpecificTime = (index: number) => {
    if (specificTimes.length <= 2) return;
    setSpecificTimes(specificTimes.filter((_, i) => i !== index));
  };

  // Minute is pinned to the first entry's minute — that's the invariant the
  // RPC enforces, and the UI mirrors it so users can't save an invalid combo.
  const updateSpecificTime = (index: number, value: string) => {
    const normalized = toHHMM(value);
    const next = [...specificTimes];
    if (index === 0) {
      const minute = normalized.split(":")[1];
      next[0] = normalized;
      for (let i = 1; i < next.length; i++) {
        const [h] = next[i].split(":");
        next[i] = `${h}:${minute}`;
      }
    } else {
      const firstMinute = next[0].split(":")[1];
      const [h] = normalized.split(":");
      next[index] = `${h}:${firstMinute}`;
    }
    setSpecificTimes(next);
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

        {/* Jadwal pengiriman — structured scheduler */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Jadwal Pengiriman
            </CardTitle>
            <CardDescription>
              Pilih kapan pg_cron memicu pengiriman notifikasi (zona waktu: WIB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={scheduleMode}
              onValueChange={(v) => setScheduleMode(v as ScheduleMode)}
              className="space-y-3"
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30">
                <RadioGroupItem value="daily" id="mode-daily" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mode-daily" className="font-medium cursor-pointer">
                    Harian pada jam tertentu
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Satu pengiriman setiap hari di jam yang Anda pilih
                  </p>
                  {scheduleMode === "daily" && (
                    <div className="mt-3">
                      <Input
                        type="time"
                        value={dailyTime}
                        onChange={(e) => setDailyTime(toHHMM(e.target.value))}
                        className="w-40"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30">
                <RadioGroupItem value="specific_times" id="mode-specific" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mode-specific" className="font-medium cursor-pointer">
                    Beberapa jam tertentu dalam sehari
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    2 sampai 4 jam spesifik — semua jam harus di menit yang sama
                  </p>
                  {scheduleMode === "specific_times" && (
                    <div className="mt-3 space-y-2">
                      {specificTimes.map((time, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={time}
                            onChange={(e) => updateSpecificTime(i, e.target.value)}
                            className="w-40"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSpecificTime(i)}
                            disabled={specificTimes.length <= 2}
                            aria-label="Hapus jam"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {specificTimes.length < 4 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addSpecificTime}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Tambah Jam
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30">
                <RadioGroupItem value="every_n_hours" id="mode-interval" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mode-interval" className="font-medium cursor-pointer">
                    Setiap N jam
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Berjalan setiap interval tetap, selalu di menit ke-0
                  </p>
                  {scheduleMode === "every_n_hours" && (
                    <div className="mt-3">
                      <Select
                        value={String(intervalHours)}
                        onValueChange={(v) => setIntervalHours(Number(v))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INTERVAL_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              Setiap {n} jam
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>

            <Separator />

            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="font-medium mb-1">Jadwal aktif saat ini</div>
              {activeSchedule.status === "active" ? (
                <div className="space-y-0.5">
                  <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                    {activeSchedule.cron}
                  </code>
                  <p className="text-muted-foreground">{humanReadableSchedule(activeSchedule.cron)}</p>
                </div>
              ) : activeSchedule.status === "unscheduled" ? (
                <p className="text-muted-foreground">
                  Cron job belum dijadwalkan. Hubungi admin infrastruktur untuk menjalankan setup awal.
                </p>
              ) : (
                <p className="text-muted-foreground">Memuat…</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan Jadwal…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Simpan Jadwal
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Jam tenang + zona waktu */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jam Tenang</CardTitle>
            <CardDescription>
              Pesan tidak dikirim dalam rentang ini meski cron fire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mulai</Label>
                <Input
                  type="time"
                  value={settings.quiet_start ?? ""}
                  onChange={(e) => update("quiet_start", e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Selesai</Label>
                <Input
                  type="time"
                  value={settings.quiet_end ?? ""}
                  onChange={(e) => update("quiet_end", e.target.value || null)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Zona waktu: {settings.timezone}
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
              <Label>Jeda Cooldown Per OPD (jam)</Label>
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
                Satu OPD maksimal menerima 1 notifikasi dalam periode ini
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
