import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Eye, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Report = {
  id: string;
  reporter_name: string;
  phone: string;
  address: string;
  description: string;
  photo_url: string | null;
  geo_location: { lat: number; lng: number } | null;
  type: "lapor" | "aspirasi";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
};

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching reports",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setReports((data || []) as unknown as Report[]);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: "pending" | "in_progress" | "resolved" | "rejected") => {
    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status updated",
        description: "Report status has been updated successfully",
      });
      fetchReports();
    }
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase.from("reports").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error deleting report",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Report deleted",
        description: "Report has been deleted successfully",
      });
      fetchReports();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-secondary text-secondary-foreground";
      case "in_progress":
        return "bg-primary text-primary-foreground";
      case "resolved":
        return "bg-success text-success-foreground";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeColor = (type: string) => {
    return type === "lapor" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground";
  };

  return (
    <Dashboard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports Management</h1>
            <p className="text-muted-foreground">View and manage citizen reports</p>
          </div>
          <Button onClick={fetchReports} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Reports</CardTitle>
            <CardDescription>Total: {reports.length} reports</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reports found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.reporter_name}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(report.type)} variant="outline">
                          {report.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={report.status}
                          onValueChange={(value) => updateStatus(report.id, value as "pending" | "in_progress" | "resolved" | "rejected")}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{new Date(report.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteReport(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Report Details</DialogTitle>
              <DialogDescription>Full information about this report</DialogDescription>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reporter Name</p>
                    <p className="text-base">{selectedReport.reporter_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-base">{selectedReport.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Type</p>
                    <Badge className={getTypeColor(selectedReport.type)} variant="outline">
                      {selectedReport.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge className={getStatusColor(selectedReport.status)}>
                      {selectedReport.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-base">{selectedReport.address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-base">{selectedReport.description}</p>
                </div>
                {selectedReport.photo_url && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Photo</p>
                    <img
                      src={selectedReport.photo_url}
                      alt="Report"
                      className="w-full max-h-96 object-contain rounded-lg border"
                    />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  {selectedReport.geo_location ? (
                    <p className="text-base">
                      Lat: {selectedReport.geo_location.lat.toFixed(6)}, Lng:{" "}
                      {selectedReport.geo_location.lng.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-base text-muted-foreground">No location provided</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Dashboard>
  );
};

export default Reports;
