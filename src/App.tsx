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
import AdminLayout from "./components/admin/AdminLayout";
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
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="dashboard" element={<DashboardOverview />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:id" element={<ReportDetail />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="integration" element={<Integration />} />
            <Route path="integration/login" element={<IntegrationLogin />} />
            <Route path="integration/ai" element={<IntegrationAI />} />
            <Route path="integration/api" element={<IntegrationAPI />} />
            <Route path="integration/channel" element={<IntegrationChannel />} />
            <Route path="integration/channel/ai-agent" element={<IntegrationChannelAIAgent />} />
            <Route path="integration/channel/whatsapp" element={<IntegrationChannelWhatsApp />} />
            <Route path="integration/channel/ai-insight" element={<IntegrationChannelAIInsight />} />
            <Route path="notifications" element={<NotificationDashboardPage />} />
            <Route path="notifications/settings" element={<NotificationSettingsPage />} />
            <Route path="notifications/channel/whatsapp" element={<NotificationChannelWhatsAppPage />} />
            <Route path="notifications/channel/whatsapp/contacts" element={<NotificationContactsPage />} />
            <Route path="notifications/channel/email" element={<NotificationChannelEmailPage />} />
            <Route path="notifications/history" element={<NotificationHistoryPage />} />
            <Route path="recent-reports" element={<RecentReports />} />
            <Route path="tenant/login-config" element={<TenantLoginConfig />} />
            <Route path="tenant/config" element={<TenantConfig />} />
            <Route path="license-generator" element={<LicenseGenerator />} />
            <Route path="users" element={<Users />} />
            <Route path="opds" element={<OPDs />} />
          </Route>
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/invite/:token" element={<AcceptInvitation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
