import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Report from "./pages/Report";
import Auth from "./pages/Auth";
import DashboardOverview from "./pages/admin/DashboardOverview";
import Reports from "./pages/admin/Reports";
import ReportDetail from "./pages/admin/ReportDetail";
import Conversations from "./pages/admin/Conversations";
import Integration from "./pages/admin/Integration";
import Users from "./pages/admin/Users";
import OPDs from "./pages/admin/OPDs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/lapor" element={<Report />} />
          <Route path="/admin/dashboard" element={<DashboardOverview />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/reports/:id" element={<ReportDetail />} />
          <Route path="/admin/conversations" element={<Conversations />} />
          <Route path="/admin/integration" element={<Integration />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/opds" element={<OPDs />} />
          <Route path="/admin" element={<DashboardOverview />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
