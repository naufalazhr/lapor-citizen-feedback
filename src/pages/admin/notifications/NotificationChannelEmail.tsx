import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "../Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NotificationChannelEmailPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
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
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dashboard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-500" />
            Channel Notifikasi Email
          </h1>
          <p className="text-muted-foreground mt-1">
            Kirim notifikasi SLA via email
          </p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-300 text-blue-600">
                <Clock className="h-3 w-3 mr-1" />
                Coming Soon
              </Badge>
            </div>
            <CardTitle className="mt-2">Segera Hadir</CardTitle>
            <CardDescription>
              Channel notifikasi email sedang dikembangkan dan akan tersedia di fase berikutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Channel WhatsApp sudah siap digunakan — silakan konfigurasikan di menu &ldquo;Channel → WhatsApp&rdquo;.
            </p>
            <p>
              Integrasi email direncanakan menggunakan Resend API dengan template HTML dan
              pengiriman dari domain Anda sendiri.
            </p>
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default NotificationChannelEmailPage;
