import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FileText, TrendingUp, Clock, CheckCircle } from "lucide-react";

type Report = {
  type: "lapor" | "aspirasi";
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
};

const Analytics = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("type, status, created_at");

    if (!error && data) {
      setReports(data as Report[]);
    }
    setLoading(false);
  };

  const typeData = [
    {
      name: "Lapor",
      value: reports.filter((r) => r.type === "lapor").length,
    },
    {
      name: "Aspirasi",
      value: reports.filter((r) => r.type === "aspirasi").length,
    },
  ];

  const statusData = [
    {
      name: "Pending",
      count: reports.filter((r) => r.status === "pending").length,
    },
    {
      name: "In Progress",
      count: reports.filter((r) => r.status === "in_progress").length,
    },
    {
      name: "Resolved",
      count: reports.filter((r) => r.status === "resolved").length,
    },
    {
      name: "Rejected",
      count: reports.filter((r) => r.status === "rejected").length,
    },
  ];

  const COLORS = ["#1e40af", "#f59e0b", "#10b981", "#ef4444"];

  const stats = [
    {
      title: "Total Reports",
      value: reports.length,
      icon: FileText,
      color: "text-primary",
    },
    {
      title: "Pending",
      value: reports.filter((r) => r.status === "pending").length,
      icon: Clock,
      color: "text-secondary",
    },
    {
      title: "In Progress",
      value: reports.filter((r) => r.status === "in_progress").length,
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      title: "Resolved",
      value: reports.filter((r) => r.status === "resolved").length,
      icon: CheckCircle,
      color: "text-success",
    },
  ];

  if (loading) {
    return (
      <Dashboard>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Visual analysis of report data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports by Type</CardTitle>
              <CardDescription>Distribution of Lapor vs Aspirasi</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports by Status</CardTitle>
              <CardDescription>Current status of all reports</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#1e40af" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
            <CardDescription>Report submissions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(
                  reports.reduce((acc, report) => {
                    const month = new Date(report.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    });
                    acc[month] = (acc[month] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([month, count]) => ({ month, count }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#f59e0b" name="Reports" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default Analytics;
