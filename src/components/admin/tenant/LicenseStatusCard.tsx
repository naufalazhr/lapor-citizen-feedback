import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  Users,
  Calendar,
  Clock,
  Star,
  AlertTriangle,
} from "lucide-react";
import {
  computeLicenseStatus,
  getDaysRemaining,
  getEnabledFeatures,
  getPlanLabel,
  getPlanColorClass,
  type LicenseStatus,
} from "@/utils/license-features";

interface TenantLicenseData {
  license_status: string | null;
  license_plan: string | null;
  license_max_users: number | null;
  license_features_bitmap: number | null;
  license_activated_at: string | null;
  license_expires_at: string | null;
}

interface LicenseStatusCardProps {
  refreshTrigger?: number;
}

const STATUS_CONFIG: Record<
  LicenseStatus,
  { label: string; color: string; icon: React.ElementType; badgeClass: string }
> = {
  active: {
    label: "Aktif",
    color: "text-green-600",
    icon: ShieldCheck,
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  grace_period: {
    label: "Grace Period",
    color: "text-orange-500",
    icon: ShieldAlert,
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
  },
  expired: {
    label: "Kadaluarsa",
    color: "text-red-500",
    icon: ShieldX,
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
  unlicensed: {
    label: "Belum Berlisensi",
    color: "text-gray-500",
    icon: Shield,
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

export function LicenseStatusCard({ refreshTrigger }: LicenseStatusCardProps) {
  const [licenseData, setLicenseData] = useState<TenantLicenseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLicenseData();
  }, [refreshTrigger]);

  const fetchLicenseData = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.user.id)
      .single();

    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from("tenants")
      .select(
        "license_status, license_plan, license_max_users, license_features_bitmap, license_activated_at, license_expires_at"
      )
      .eq("id", profile.tenant_id)
      .single();

    setLicenseData(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Memuat data lisensi...
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = computeLicenseStatus(
    licenseData?.license_expires_at ?? null,
    licenseData?.license_status ?? null
  );
  const daysRemaining = getDaysRemaining(licenseData?.license_expires_at ?? null);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const features = getEnabledFeatures(licenseData?.license_features_bitmap ?? 1);

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Expiry banners */}
      {status === "active" && daysRemaining <= 7 && daysRemaining > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700">
            <strong>Peringatan kritis!</strong> Lisensi Anda akan habis dalam{" "}
            <strong>{daysRemaining} hari</strong>. Segera masukkan token pembaruan.
          </AlertDescription>
        </Alert>
      )}
      {status === "active" && daysRemaining > 7 && daysRemaining <= 30 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            Lisensi Anda akan habis dalam <strong>{daysRemaining} hari</strong>. Pertimbangkan
            untuk memperbarui lisensi.
          </AlertDescription>
        </Alert>
      )}
      {status === "grace_period" && (
        <Alert className="border-orange-200 bg-orange-50">
          <ShieldAlert className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-700">
            <strong>Masa tenggang (grace period)!</strong> Lisensi Anda sudah habis. Akses dibatasi
            hanya untuk membaca data. Masukkan token pembaruan segera.
          </AlertDescription>
        </Alert>
      )}
      {status === "expired" && (
        <Alert className="border-red-200 bg-red-50">
          <ShieldX className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700">
            <strong>Lisensi kadaluarsa!</strong> Silakan masukkan token lisensi baru untuk
            mengaktifkan kembali akses penuh.
          </AlertDescription>
        </Alert>
      )}

      {/* Main status card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            Status Lisensi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status + Plan row */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className={config.badgeClass}>
              {config.label}
            </Badge>
            {licenseData?.license_plan && (
              <Badge
                variant="outline"
                className={getPlanColorClass(licenseData.license_plan)}
              >
                <Star className="h-3 w-3 mr-1" />
                {getPlanLabel(licenseData.license_plan)}
              </Badge>
            )}
          </div>

          {status !== "unlicensed" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Max users */}
              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Maks. Pengguna</p>
                  <p className="text-sm font-medium">
                    {licenseData?.license_max_users === 0
                      ? "Tidak Terbatas"
                      : `${licenseData?.license_max_users} pengguna`}
                  </p>
                </div>
              </div>

              {/* Days remaining */}
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Sisa Masa Aktif</p>
                  <p
                    className={`text-sm font-medium ${
                      daysRemaining <= 0
                        ? "text-red-500"
                        : daysRemaining <= 7
                        ? "text-orange-500"
                        : daysRemaining <= 30
                        ? "text-yellow-600"
                        : ""
                    }`}
                  >
                    {daysRemaining > 0
                      ? `${daysRemaining} hari`
                      : status === "grace_period"
                      ? `Grace period`
                      : "Kadaluarsa"}
                  </p>
                </div>
              </div>

              {/* Activated at */}
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Aktivasi</p>
                  <p className="text-sm font-medium">
                    {formatDate(licenseData?.license_activated_at ?? null)}
                  </p>
                </div>
              </div>

              {/* Expires at */}
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Kadaluarsa</p>
                  <p className="text-sm font-medium">
                    {formatDate(licenseData?.license_expires_at ?? null)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada lisensi aktif. Masukkan token lisensi di bawah ini untuk mengaktifkan
              sistem.
            </p>
          )}

          {/* Features */}
          {status !== "unlicensed" && features.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Fitur Aktif</p>
              <div className="flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
