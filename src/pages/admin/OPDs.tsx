import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { OPDFormDialog } from "@/components/admin/OPDFormDialog";
import { useUserRole } from "@/hooks/use-user-role";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface OPD {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  head_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const OPDs = () => {
  const [opds, setOpds] = useState<OPD[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOPD, setEditingOPD] = useState<OPD | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOPD, setDeletingOPD] = useState<OPD | null>(null);
  const { toast } = useToast();
  const { isAdmin, isOwner, isSuperadmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isAdmin && !isOwner && !isSuperadmin) {
      navigate("/admin/dashboard");
    }
  }, [isAdmin, isOwner, isSuperadmin, roleLoading, navigate]);

  useEffect(() => {
    fetchOPDs();
  }, []);

  const fetchOPDs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opds")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setOpds(data || []);
    } catch (error: any) {
      console.error("Error fetching OPDs:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data OPD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOPD) return;

    try {
      const { error } = await supabase
        .from("opds")
        .delete()
        .eq("id", deletingOPD.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "OPD berhasil dihapus",
      });

      fetchOPDs();
    } catch (error: any) {
      console.error("Error deleting OPD:", error);
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus OPD",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingOPD(null);
    }
  };

  const filteredOPDs = opds.filter((opd) => {
    const query = searchQuery.toLowerCase();
    return (
      opd.name.toLowerCase().includes(query) ||
      opd.code.toLowerCase().includes(query) ||
      opd.head_name?.toLowerCase().includes(query) ||
      ""
    );
  });

  if (roleLoading) {
    return <div>Loading...</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold">Manajemen OPD</h1>
          </header>

          <main className="flex-1 p-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Organisasi Perangkat Daerah (OPD)</CardTitle>
                    <CardDescription>
                      Kelola OPD untuk disposisi laporan
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingOPD(null);
                    setIsFormOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah OPD
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari OPD berdasarkan nama, kode, atau kepala..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama OPD</TableHead>
                        <TableHead>Kepala OPD</TableHead>
                        <TableHead>Kontak</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Memuat data...
                          </TableCell>
                        </TableRow>
                      ) : filteredOPDs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchQuery ? "Tidak ada OPD yang sesuai" : "Belum ada OPD"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOPDs.map((opd) => (
                          <TableRow key={opd.id}>
                            <TableCell className="font-medium">{opd.code}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{opd.name}</div>
                                {opd.description && (
                                  <div className="text-sm text-muted-foreground line-clamp-1">
                                    {opd.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{opd.head_name || "-"}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {opd.contact_phone && <div>{opd.contact_phone}</div>}
                                {opd.contact_email && (
                                  <div className="text-muted-foreground">{opd.contact_email}</div>
                                )}
                                {!opd.contact_phone && !opd.contact_email && "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={opd.is_active ? "default" : "secondary"}>
                                {opd.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingOPD(opd);
                                    setIsFormOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setDeletingOPD(opd);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      <OPDFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        opd={editingOPD}
        onSuccess={() => {
          fetchOPDs();
          setIsFormOpen(false);
          setEditingOPD(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus OPD?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deletingOPD?.name}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default OPDs;
