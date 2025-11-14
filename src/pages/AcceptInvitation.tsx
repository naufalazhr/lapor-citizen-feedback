import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Building2,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { validateInvitationToken, acceptInvitation } from "@/utils/invitation";
import type { InvitationWithDetails } from "@/types/invitation";

const AcceptInvitation = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (token) {
      checkInvitation();
    } else {
      setError("Invalid invitation link");
      setLoading(false);
    }
  }, [token]);

  const checkInvitation = async () => {
    if (!token) return;

    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);

    // Validate the invitation token
    const invitationData = await validateInvitationToken(token);

    if (!invitationData) {
      setError("This invitation is invalid, expired, or has already been used.");
      setLoading(false);
      return;
    }

    setInvitation(invitationData);
    setLoading(false);
  };

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Not logged in - redirect to auth with token
      navigate(`/auth?invite=${token}`);
      return;
    }

    setAccepting(true);

    const { success, error } = await acceptInvitation(
      session.user.id,
      invitation.id,
      invitation.tenant_id,
      invitation.role
    );

    if (success) {
      toast({
        title: "Invitation accepted!",
        description: `You've joined ${invitation.tenant?.name}`,
      });

      // Small delay before redirect to let user see the success message
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 1500);
    } else {
      toast({
        title: "Error accepting invitation",
        description: error || "An error occurred",
        variant: "destructive",
      });
      setAccepting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      viewer: 'Viewer',
      member: 'Member',
      admin: 'Admin',
      owner: 'Owner',
      opd_member: 'OPD Member',
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'admin':
      case 'owner':
        return 'default';
      case 'member':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
                <CardDescription>This invitation link is not valid</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive">
                {error || "This invitation may have expired or already been used."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                If you believe this is an error, please contact the person who sent you this invitation link.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => navigate('/auth')} className="w-full">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-2xl">You're Invited!</CardTitle>
              <CardDescription>Join your organization on Lapor</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
              {/* Tenant Name */}
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Organization</p>
                  <p className="text-sm font-semibold">{invitation.tenant?.name}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-primary" />
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Role:</p>
                  <Badge variant={getRoleBadgeVariant(invitation.role)}>
                    {getRoleLabel(invitation.role)}
                  </Badge>
                </div>
              </div>

              {/* Invited By */}
              {invitation.inviter && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Invited by</p>
                    <p className="text-sm font-medium">
                      {invitation.inviter.full_name || invitation.inviter.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Expiration */}
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="text-sm">
                    {new Date(invitation.expires_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Match Info */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-xs text-yellow-900 dark:text-yellow-100">
              <strong>Note:</strong> This invitation is for <strong>{invitation.email}</strong>.
              {isLoggedIn
                ? " Make sure you're signed in with this email address."
                : " Please sign up or sign in with this email to accept."}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isLoggedIn ? (
              <>
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={accepting}
                  className="w-full"
                  size="lg"
                >
                  {accepting ? (
                    "Accepting..."
                  ) : (
                    <>
                      Accept Invitation
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/auth')}
                  className="w-full"
                  disabled={accepting}
                >
                  Sign In with Different Account
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => navigate(`/auth?invite=${token}`)}
                  className="w-full"
                  size="lg"
                >
                  Sign Up to Accept
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/auth?invite=${token}`)}
                  className="w-full"
                >
                  Already have an account? Sign In
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
