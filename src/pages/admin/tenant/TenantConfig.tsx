import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LicenseStatusCard } from "@/components/admin/tenant/LicenseStatusCard";
import { LicenseTokenInput } from "@/components/admin/tenant/LicenseTokenInput";
import {
  Building2,
  Shield,
  Globe,
  Mail,
  Phone,
  Calendar,
  Tag,
} from "lucide-react";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  subscription_tier: string | null;
  created_at: string;
}

const TenantConfig = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAllowed, setIsAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [licenseRefresh, setLicenseRefresh] = useState(0);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "owner", "superadmin"])
      .single();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya admin atau owner yang dapat mengakses konfigurasi tenant.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    // Fetch tenant info
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.user.id)
      .single();

    if (profile?.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, slug, status, domain, contact_email, contact_phone, subscription_tier, created_at")
        .eq("id", profile.tenant_id)
        .single();
      setTenantInfo(tenant);
    }

    setIsAllowed(true);
    setLoading(false);
  };

  const handleLicenseActivated = () => {
    setLicenseRefresh((n) => n + 1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const statusBadge: Record<string, { label: string; class: string }> = {
    trial:     { label: "Trial",    class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    activated: { label: "Aktif",    class: "bg-green-100 text-green-700 border-green-200" },
    suspended: { label: "Suspend",  class: "bg-red-100 text-red-700 border-red-200" },
    cancelled: { label: "Batal",    class: "bg-gray-100 text-gray-600 border-gray-200" },
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Memuat...</div>
        </div>
    );
  }

  if (!isAllowed) return null;

  const tenantStatus = tenantInfo?.status ?? "trial";
  const statusDisplay = statusBadge[tenantStatus] ?? { label: tenantStatus, class: "bg-gray-100 text-gray-600" };

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            Konfigurasi Tenant
          </h1>
          <p className="text-muted-foreground">
            Informasi tenant dan manajemen lisensi sistem
          </p>
        </div>

        <Tabs defaultValue="informasi">
          <TabsList>
            <TabsTrigger value="informasi" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Informasi Tenant
            </TabsTrigger>
            <TabsTrigger value="lisensi" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Lisensi
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Informasi Tenant ── */}
          <TabsContent value="informasi" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Informasi Organisasi</span>
                  {tenantInfo && (
                    <Badge variant="outline" className={statusDisplay.class}>
                      {statusDisplay.label}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Detail informasi tenant Anda yang terdaftar di sistem Lapor.
                  Untuk mengubah data ini, hubungi administrator Lapor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tenantInfo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Name */}
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nama Organisasi</p>
                        <p className="text-sm font-medium">{tenantInfo.name}</p>
                      </div>
                    </div>

                    {/* Slug */}
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Slug / Kode Tenant</p>
                        <p className="text-sm font-mono font-medium">{tenantInfo.slug}</p>
                      </div>
                    </div>

                    {/* Domain */}
                    <div className="flex items-start gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Domain</p>
                        <p className="text-sm font-medium">
                          {tenantInfo.domain ?? (
                            <span className="text-muted-foreground italic">Belum diatur</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Contact email */}
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email Kontak</p>
                        <p className="text-sm font-medium">
                          {tenantInfo.contact_email ?? (
                            <span className="text-muted-foreground italic">Belum diatur</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Contact phone */}
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nomor Telepon Kontak</p>
                        <p className="text-sm font-medium">
                          {tenantInfo.contact_phone ?? (
                            <span className="text-muted-foreground italic">Belum diatur</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Subscription tier */}
                    <div className="flex items-start gap-3">
                      <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tier Langganan</p>
                        <p className="text-sm font-medium capitalize">
                          {tenantInfo.subscription_tier ?? "basic"}
                        </p>
                      </div>
                    </div>

                    {/* Registered date */}
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Terdaftar Sejak</p>
                        <p className="text-sm font-medium">{formatDate(tenantInfo.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Informasi tenant tidak tersedia.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Lisensi ── */}
          <TabsContent value="lisensi" className="mt-4 space-y-4">
            <LicenseStatusCard refreshTrigger={licenseRefresh} />
            <LicenseTokenInput onActivated={handleLicenseActivated} />
          </TabsContent>
        </Tabs>
      </div>
  );
};

export default TenantConfig;
