import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Plus,
  Building2,
} from "lucide-react";
import {
  generateLicenseToken,
  getDefaultFeaturesForPlan,
  PLAN_TIER_MAP,
} from "@/utils/license-token-generator";
import { FEATURE_FLAGS, FEATURE_LABELS } from "@/utils/license-features";

const LicenseGenerator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAllowed, setIsAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  // License form state
  const [licenseForm, setLicenseForm] = useState({
    plan_tier: "starter" as keyof typeof PLAN_TIER_MAP,
    max_users: 10,
    duration_days: 365,
    features_bitmap: FEATURE_FLAGS.BASIC,
    notes: "",
  });
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Sync features_bitmap when plan changes
  useEffect(() => {
    setLicenseForm((prev) => ({
      ...prev,
      features_bitmap: getDefaultFeaturesForPlan(prev.plan_tier),
    }));
    setGeneratedToken(null);
  }, [licenseForm.plan_tier]);

  // Check superadmin access
  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "superadmin")
      .single();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya superadmin yang dapat mengakses halaman ini.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    setIsAllowed(true);
    setLoading(false);
  };

  // Fetch all tenants (superadmin can see all)
  const { data: tenants } = useQuery({
    queryKey: ["all-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, status")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAllowed,
  });

  // Fetch issued tokens for selected tenant
  const { data: issuedTokens, refetch: refetchTokens } = useQuery({
    queryKey: ["license-issued-tokens", selectedTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_issued_tokens")
        .select("*")
        .eq("tenant_id", selectedTenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedTenantId,
  });

  // Generate token mutation
  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenantId) throw new Error("Pilih tenant terlebih dahulu.");

      const privateKey = import.meta.env.VITE_LICENSE_PRIVATE_KEY as string | undefined;
      if (!privateKey) {
        throw new Error(
          "VITE_LICENSE_PRIVATE_KEY belum diset. Tambahkan Ed25519 private key (hex) ke file .env."
        );
      }

      // Get next token_id from DB sequence (fallback to random if RPC fails)
      const { data: seqData } = await supabase.rpc(
        "nextval" as any,
        { seq: "license_token_id_seq" } as any
      );
      const tokenId: number = seqData ?? Math.floor(Math.random() * 4294967295) + 1;

      const { data: profile } = await supabase.auth.getUser();

      const payload = {
        version: 1 as const,
        token_id: tokenId,
        customer_id: 0,
        plan_tier: PLAN_TIER_MAP[licenseForm.plan_tier],
        max_users: licenseForm.max_users,
        duration_days: licenseForm.duration_days,
        issued_at: Math.floor(Date.now() / 1000),
        features_bitmap: licenseForm.features_bitmap,
      };

      const tokenCode = await generateLicenseToken(payload, privateKey);

      // Store tracking record
      const { error: insertError } = await supabase
        .from("license_issued_tokens")
        .insert({
          token_id: tokenId,
          tenant_id: selectedTenantId,
          plan_tier: licenseForm.plan_tier,
          max_users: licenseForm.max_users,
          duration_days: licenseForm.duration_days,
          features_bitmap: licenseForm.features_bitmap,
          customer_id: 0,
          notes: licenseForm.notes || null,
          status: "issued",
          issued_at: new Date().toISOString(),
          created_by: profile.user?.id,
        } as any);

      if (insertError) {
        console.error("Failed to save token record:", insertError);
        throw new Error("Gagal menyimpan record token ke database.");
      }

      return tokenCode;
    },
    onSuccess: (tokenCode) => {
      setGeneratedToken(tokenCode);
      setTokenCopied(false);
      refetchTokens();
      toast({
        title: "Token Lisensi Dibuat!",
        description: "Token siap dikirimkan ke tenant.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal Membuat Token",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyToken = async () => {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 3000);
  };

  const toggleFeature = (flag: number) => {
    setLicenseForm((prev) => ({
      ...prev,
      features_bitmap: prev.features_bitmap ^ flag,
    }));
    setGeneratedToken(null);
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Memuat...</div>
        </div>
    );
  }

  if (!isAllowed) return null;

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <KeyRound className="h-7 w-7" />
            License Generator
          </h1>
          <p className="text-muted-foreground">
            Buat token lisensi untuk tenant (superadmin only)
          </p>
        </div>

        {/* Tenant Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5" />
              Pilih Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedTenantId}
              onValueChange={(v) => {
                setSelectedTenantId(v);
                setGeneratedToken(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Token Generator Form */}
        {selectedTenantId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Generate Token Lisensi Baru
              </CardTitle>
              <CardDescription>
                Buat token lisensi yang ditandatangani secara kriptografis (Ed25519).
                Token hanya bisa digunakan sekali.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Private key warning */}
              {!import.meta.env.VITE_LICENSE_PRIVATE_KEY && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  <strong>VITE_LICENSE_PRIVATE_KEY</strong> belum diset. Tambahkan private key
                  Ed25519 (hex) ke file <code>.env</code> sebelum membuat token.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Plan tier */}
                <div className="space-y-2">
                  <Label>Plan Tier</Label>
                  <Select
                    value={licenseForm.plan_tier}
                    onValueChange={(v) =>
                      setLicenseForm((p) => ({ ...p, plan_tier: v as keyof typeof PLAN_TIER_MAP }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (maks. 10 user)</SelectItem>
                      <SelectItem value="pro">Pro (maks. 50 user)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (unlimited)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Max users */}
                <div className="space-y-2">
                  <Label>Maks. Pengguna (0 = unlimited)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={65535}
                    value={licenseForm.max_users}
                    onChange={(e) => {
                      setLicenseForm((p) => ({ ...p, max_users: Number(e.target.value) }));
                      setGeneratedToken(null);
                    }}
                  />
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label>Durasi (hari)</Label>
                  <Select
                    value={String(licenseForm.duration_days)}
                    onValueChange={(v) => {
                      setLicenseForm((p) => ({ ...p, duration_days: Number(v) }));
                      setGeneratedToken(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 hari (1 bulan)</SelectItem>
                      <SelectItem value="90">90 hari (3 bulan)</SelectItem>
                      <SelectItem value="180">180 hari (6 bulan)</SelectItem>
                      <SelectItem value="365">365 hari (1 tahun)</SelectItem>
                      <SelectItem value="730">730 hari (2 tahun)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Feature bitmap checkboxes */}
              <div className="space-y-2">
                <Label>Fitur yang Diaktifkan</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(FEATURE_FLAGS).map(([key, flag]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`feature-${key}`}
                        checked={(licenseForm.features_bitmap & flag) !== 0}
                        onCheckedChange={() => toggleFeature(flag)}
                      />
                      <label
                        htmlFor={`feature-${key}`}
                        className="text-sm cursor-pointer"
                      >
                        {FEATURE_LABELS[key]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="license-notes">Catatan Internal (opsional)</Label>
                <Textarea
                  id="license-notes"
                  placeholder="Contoh: Pembaruan tahun 2026 untuk Pemkab Contoh"
                  value={licenseForm.notes}
                  onChange={(e) => setLicenseForm((p) => ({ ...p, notes: e.target.value }))}
                  className="resize-none h-20"
                />
              </div>

              <Button
                onClick={() => generateTokenMutation.mutate()}
                disabled={generateTokenMutation.isPending || !import.meta.env.VITE_LICENSE_PRIVATE_KEY}
                className="w-full"
              >
                {generateTokenMutation.isPending ? (
                  "Membuat Token..."
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Buat Token Lisensi
                  </>
                )}
              </Button>

              {/* Generated token display */}
              {generatedToken && (
                <div className="rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Token Siap — Kirim ke Tenant
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleCopyToken}
                    >
                      {tokenCopied ? (
                        <><Check className="h-3.5 w-3.5 text-green-500" /> Tersalin!</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5" /> Salin Token</>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-md bg-white dark:bg-black border p-3">
                    <code className="text-xs font-mono break-all leading-relaxed tracking-wide">
                      {generatedToken}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Token bersifat satu kali pakai. Simpan salinan ini — token tidak dapat
                    dilihat ulang setelah halaman ditutup.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Issued tokens history */}
        {selectedTenantId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Token yang Diterbitkan</CardTitle>
              <CardDescription>
                Semua token lisensi yang telah dibuat untuk tenant ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!issuedTokens || issuedTokens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Belum ada token yang dibuat untuk tenant ini.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left pb-2 pr-4">Token ID</th>
                        <th className="text-left pb-2 pr-4">Plan</th>
                        <th className="text-left pb-2 pr-4">Durasi</th>
                        <th className="text-left pb-2 pr-4">Maks. User</th>
                        <th className="text-left pb-2 pr-4">Status</th>
                        <th className="text-left pb-2">Dibuat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {issuedTokens.map((token: any) => (
                        <tr key={token.id} className="py-2">
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                            #{token.token_id}
                          </td>
                          <td className="py-2 pr-4 capitalize">{token.plan_tier}</td>
                          <td className="py-2 pr-4">{token.duration_days} hari</td>
                          <td className="py-2 pr-4">
                            {token.max_users === 0 ? "Unlimited" : token.max_users}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              variant="outline"
                              className={
                                token.status === "issued"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : token.status === "activated"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }
                            >
                              {token.status === "issued"
                                ? "Diterbitkan"
                                : token.status === "activated"
                                ? "Diaktifkan"
                                : "Dicabut"}
                            </Badge>
                          </td>
                          <td className="py-2 text-muted-foreground text-xs">
                            {new Date(token.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
  );
};

export default LicenseGenerator;
