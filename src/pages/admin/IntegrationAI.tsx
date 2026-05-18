import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AIAssistantConfigManager } from "@/components/admin/AIAssistantConfigManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bot } from "lucide-react";

const IntegrationAI = () => {
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
            <Bot className="h-7 w-7" />
            Konfigurasi AI Asisten
          </h1>
          <p className="text-muted-foreground">
            Kontrol status AI dan pesan balasan preset (Human-in-the-Loop)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pengaturan AI Asisten</CardTitle>
            <CardDescription>
              Aktifkan atau nonaktifkan AI, dan atur pesan balasan otomatis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIAssistantConfigManager />
          </CardContent>
        </Card>
      </div>
  );
};

export default IntegrationAI;
