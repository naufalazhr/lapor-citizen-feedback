import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, XCircle, Edit, LogOut, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ApprovalRequest {
  id: string;
  status: string;
  requested_at: string;
  organization: string;
  department: string;
  position: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
}

const PendingApproval = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkAuth();

    // Auto-refresh every 30 seconds to check if approved
    const interval = setInterval(() => {
      checkApprovalStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/auth');
      return;
    }

    await checkApprovalStatus(session.user.id);
    setLoading(false);
  };

  const checkApprovalStatus = async (userId?: string) => {
    setChecking(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const targetUserId = userId || session.user.id;

    // Check if user now has a role (approved)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (roleData) {
      // User has been approved!
      toast({
        title: "Access Granted!",
        description: "Your request has been approved. Redirecting to dashboard...",
      });
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1500);
      return;
    }

    // Fetch approval request
    const { data, error } = await supabase
      .from('user_approvals')
      .select('*')
      .eq('user_id', targetUserId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching approval:', error);
      setChecking(false);
      return;
    }

    if (!data) {
      // No approval request found - redirect to profile setup
      navigate('/profile-setup');
      return;
    }

    if (data.status === 'rejected') {
      setApprovalRequest(data);
      setChecking(false);
      return;
    }

    if (data.status === 'approved') {
      // Approved but role not yet assigned (shouldn't happen, but handle it)
      toast({
        title: "Access Granted",
        description: "Redirecting to dashboard...",
      });
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1000);
      return;
    }

    setApprovalRequest(data);
    setChecking(false);
  };

  const handleCancelRequest = async () => {
    if (!approvalRequest) return;

    const { error } = await supabase
      .from('user_approvals')
      .delete()
      .eq('id', approvalRequest.id);

    if (error) {
      toast({
        title: "Error canceling request",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request canceled",
      description: "Your access request has been canceled",
    });

    navigate('/profile-setup');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!approvalRequest) {
    return null;
  }

  const isRejected = approvalRequest.status === 'rejected';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isRejected ? (
                <XCircle className="h-10 w-10 text-destructive" />
              ) : (
                <Clock className="h-10 w-10 text-primary animate-pulse" />
              )}
              <div>
                <CardTitle className="text-2xl">
                  {isRejected ? "Request Rejected" : "Approval Pending"}
                </CardTitle>
                <CardDescription>
                  {isRejected
                    ? "Your access request was not approved"
                    : "Your access request is being reviewed"}
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Message */}
          {isRejected ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">
                Request Rejected
              </p>
              {approvalRequest.rejection_reason && (
                <p className="text-xs text-muted-foreground">
                  Reason: {approvalRequest.rejection_reason}
                </p>
              )}
              {approvalRequest.reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  Reviewed {formatDistanceToNow(new Date(approvalRequest.reviewed_at), { addSuffix: true })}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Waiting for Administrator Approval
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => checkApprovalStatus()}
                  disabled={checking}
                >
                  <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                An administrator will review your request and assign you to an organization.
                This page will automatically refresh.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Requested {formatDistanceToNow(new Date(approvalRequest.requested_at), { addSuffix: true })}
              </p>
            </div>
          )}

          {/* Request Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Request Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Organization</p>
                <p className="text-sm font-medium">{approvalRequest.organization}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm font-medium">{approvalRequest.department}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Position</p>
                <p className="text-sm font-medium">{approvalRequest.position}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {isRejected ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate('/profile-setup')}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile & Try Again
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate('/profile-setup')}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Request
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelRequest}
                  className="flex-1"
                >
                  Cancel Request
                </Button>
              </>
            )}
          </div>

          {/* Help Text */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">
              <strong>Need help?</strong> If you believe you should have immediate access,
              please contact your organization's administrator to request an invitation link.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
