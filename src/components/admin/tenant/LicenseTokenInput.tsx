import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { formatTokenCode } from "@/utils/license-features";

interface LicenseTokenInputProps {
  onActivated?: () => void;
}

export function LicenseTokenInput({ onActivated }: LicenseTokenInputProps) {
  const { toast } = useToast();
  const [tokenValue, setTokenValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTokenChange = (value: string) => {
    // Normalize: strip non-alphanumeric, uppercase, re-format in 8-char groups
    const clean = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
    const formatted = clean.match(/.{1,8}/g)?.join("-") ?? clean;
    setTokenValue(formatted);
    setError(null);
    setSuccess(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    handleTokenChange(pasted);
  };

  const handleActivate = async () => {
    const rawToken = tokenValue.replace(/-/g, "").trim();
    if (!rawToken) {
      setError("Token tidak boleh kosong.");
      return;
    }

    // Minimum length sanity check (84 bytes → 135 base32 chars)
    if (rawToken.length < 100) {
      setError("Token terlalu pendek. Pastikan Anda menempelkan token yang lengkap.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Sesi tidak valid. Silakan login ulang.");
        setLoading(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/redeem-license`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token_code: rawToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessages: Record<string, string> = {
          TOKEN_ALREADY_USED: "Token ini sudah pernah digunakan.",
          TOKEN_SIGNATURE_INVALID: "Token tidak valid. Pastikan token yang dimasukkan benar.",
          TOKEN_FORMAT_INVALID: "Format token tidak dikenali.",
          TOKEN_LENGTH_INVALID: "Panjang token tidak sesuai.",
          TOKEN_VERSION_UNSUPPORTED: "Versi token tidak didukung oleh sistem ini.",
          ACCESS_DENIED: "Anda tidak memiliki izin untuk mengaktifkan lisensi.",
        };
        setError(
          errorMessages[result.error] ??
            result.message ??
            "Terjadi kesalahan saat mengaktifkan token."
        );
        return;
      }

      setSuccess(true);
      setTokenValue("");
      toast({
        title: "Lisensi Berhasil Diaktifkan!",
        description: `Plan ${result.license?.plan?.toUpperCase()} aktif hingga ${new Date(
          result.license?.expires_at
        ).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`,
      });

      onActivated?.();
    } catch (err) {
      setError("Gagal terhubung ke server. Periksa koneksi internet Anda.");
      console.error("redeem-license error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-5 w-5" />
          Aktivasi / Pembaruan Lisensi
        </CardTitle>
        <CardDescription>
          Tempelkan (paste) kode token lisensi yang Anda terima dari administrator Lapor.
          Token bersifat satu kali pakai — seperti token listrik PLN.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="license-token">Kode Token Lisensi</Label>
          <Textarea
            id="license-token"
            placeholder="Tempelkan token di sini, contoh:&#10;A3F7K9X2-M4P1Q8R5-W2Y6B8D3-N5T7J1H4-..."
            value={tokenValue}
            onChange={(e) => handleTokenChange(e.target.value)}
            onPaste={handlePaste}
            className={`font-mono text-sm min-h-24 resize-none tracking-wide ${
              error ? "border-red-400 focus-visible:ring-red-400" : ""
            } ${success ? "border-green-400 bg-green-50" : ""}`}
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Lisensi berhasil diaktifkan!
            </p>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground max-w-sm">
            Token dapat mengandung tanda hubung (-) atau tidak — keduanya diterima.
            Token bersifat sensitif terhadap karakter.
          </p>
          <Button
            onClick={handleActivate}
            disabled={loading || !tokenValue.trim()}
            className="shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memvalidasi...
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4 mr-2" />
                Aktifkan Token
              </>
            )}
          </Button>
        </div>

        {/* Info box */}
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/70">Cara penggunaan:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Hubungi administrator Lapor untuk mendapatkan token lisensi</li>
            <li>Salin (copy) seluruh kode token yang diberikan</li>
            <li>Tempelkan (paste) ke kolom di atas</li>
            <li>Klik "Aktifkan Token"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
