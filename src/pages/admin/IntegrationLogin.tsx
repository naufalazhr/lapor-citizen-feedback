import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoginConfigManager } from "@/components/admin/LoginConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

const IntegrationLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .in('role', ['admin', 'owner'])
      .single();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya admin yang dapat mengakses pengaturan integrasi.",
        variant: "destructive",
      });
      navigate('/admin/dashboard');
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Memuat...</div>
        </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-7 w-7" />
            Konfigurasi Login
          </h1>
          <p className="text-muted-foreground">Personalisasi halaman login aplikasi</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pengaturan Halaman Login</CardTitle>
            <CardDescription>
              Sesuaikan tampilan dan konten halaman login untuk warga
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginConfigManager />
          </CardContent>
        </Card>
      </div>
  );
};

export default IntegrationLogin;
