import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Report from "./pages/Report";
import TrackReport from "./pages/TrackReport";
import Auth from "./pages/Auth";
import ProfileSetup from "./pages/ProfileSetup";
import PendingApproval from "./pages/PendingApproval";
import AcceptInvitation from "./pages/AcceptInvitation";
import DashboardOverview from "./pages/admin/DashboardOverview";
import Reports from "./pages/admin/Reports";
import ReportDetail from "./pages/admin/ReportDetail";
import Conversations from "./pages/admin/Conversations";
import Integration from "./pages/admin/Integration";
import Users from "./pages/admin/Users";
import OPDs from "./pages/admin/OPDs";
import RecentReports from "./pages/admin/RecentReports";
import IntegrationLogin from "./pages/admin/IntegrationLogin";
import IntegrationAI from "./pages/admin/IntegrationAI";
import IntegrationAPI from "./pages/admin/IntegrationAPI";
import IntegrationChannel from "./pages/admin/IntegrationChannel";
import IntegrationChannelAIAgent from "./pages/admin/IntegrationChannelAIAgent";
import IntegrationChannelWhatsApp from "./pages/admin/IntegrationChannelWhatsApp";
import IntegrationChannelAIInsight from "./pages/admin/IntegrationChannelAIInsight";
import NotificationDashboardPage from "./pages/admin/notifications/NotificationDashboard";
import NotificationSettingsPage from "./pages/admin/notifications/NotificationSettings";
import NotificationChannelWhatsAppPage from "./pages/admin/notifications/NotificationChannelWhatsApp";
import NotificationChannelEmailPage from "./pages/admin/notifications/NotificationChannelEmail";
import NotificationContactsPage from "./pages/admin/notifications/NotificationContacts";
import NotificationHistoryPage from "./pages/admin/notifications/NotificationHistory";
import TenantLoginConfig from "./pages/admin/tenant/TenantLoginConfig";
import TenantConfig from "./pages/admin/tenant/TenantConfig";
import LicenseGenerator from "./pages/admin/LicenseGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/lapor" element={<Report />} />
          <Route path="/lacak" element={<TrackReport />} />
          <Route path="/lacak/:ticketId" element={<TrackReport />} />
          <Route path="/admin/dashboard" element={<DashboardOverview />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/reports/:id" element={<ReportDetail />} />
          <Route path="/admin/conversations" element={<Conversations />} />
          <Route path="/admin/integration" element={<Integration />} />
          <Route path="/admin/integration/login" element={<IntegrationLogin />} />
          <Route path="/admin/integration/ai" element={<IntegrationAI />} />
          <Route path="/admin/integration/api" element={<IntegrationAPI />} />
          <Route path="/admin/integration/channel" element={<IntegrationChannel />} />
          <Route path="/admin/integration/channel/ai-agent" element={<IntegrationChannelAIAgent />} />
          <Route path="/admin/integration/channel/whatsapp" element={<IntegrationChannelWhatsApp />} />
          <Route path="/admin/integration/channel/ai-insight" element={<IntegrationChannelAIInsight />} />
          <Route path="/admin/notifications" element={<NotificationDashboardPage />} />
          <Route path="/admin/notifications/settings" element={<NotificationSettingsPage />} />
          <Route path="/admin/notifications/channel/whatsapp" element={<NotificationChannelWhatsAppPage />} />
          <Route path="/admin/notifications/channel/whatsapp/contacts" element={<NotificationContactsPage />} />
          <Route path="/admin/notifications/channel/email" element={<NotificationChannelEmailPage />} />
          <Route path="/admin/notifications/history" element={<NotificationHistoryPage />} />
          <Route path="/admin/recent-reports" element={<RecentReports />} />
          <Route path="/admin/tenant/login-config" element={<TenantLoginConfig />} />
          <Route path="/admin/tenant/config" element={<TenantConfig />} />
          <Route path="/admin/license-generator" element={<LicenseGenerator />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/opds" element={<OPDs />} />
          <Route path="/admin" element={<DashboardOverview />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/invite/:token" element={<AcceptInvitation />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
