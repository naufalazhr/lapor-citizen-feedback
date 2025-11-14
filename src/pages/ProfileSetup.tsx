import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Mail, Building2, Briefcase, LogOut, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  department: string | null;
  position: string | null;
  tenant_id: string | null;
}

interface ApprovalRequest {
  status: string;
  requested_at: string;
}

interface ValidatedTenant {
  id: string;
  name: string;
  slug: string;
}

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);

  // Form state
  const [tenantSlug, setTenantSlug] = useState("");
  const [validatedTenant, setValidatedTenant] = useState<ValidatedTenant | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tenantError, setTenantError] = useState("");
  const [organization, setOrganization] = useState(""); // Keep for backward compatibility with profile
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/auth');
      return;
    }

    await fetchProfile(session.user.id);
    await checkApprovalStatus(session.user.id);
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // If user has tenant, redirect to dashboard
    if (data.tenant_id) {
      navigate('/admin/dashboard');
      return;
    }

    setProfile(data);
    setOrganization(data.organization || '');
    setDepartment(data.department || '');
    setPosition(data.position || '');
  };

  const checkApprovalStatus = async (userId: string) => {
    const { data } = await supabase
      .from('user_approvals')
      .select('status, requested_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setApprovalRequest(data);
    }
  };

  const verifyTenantSlug = async (slug: string) => {
    if (!slug || slug.trim() === '') {
      setValidatedTenant(null);
      setTenantError('');
      return;
    }

    setVerifying(true);
    setTenantError('');

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug')
      .eq('slug', slug.toLowerCase().trim())
      .eq('status', 'active')
      .maybeSingle();

    setVerifying(false);

    if (error) {
      console.error('Error verifying tenant:', error);
      setTenantError('Error verifying tenant slug');
      setValidatedTenant(null);
      return;
    }

    if (!data) {
      setTenantError('Tenant not found. Please check the slug and try again.');
      setValidatedTenant(null);
      return;
    }

    setValidatedTenant(data);
    setTenantError('');
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        organization,
        department,
        position,
      })
      .eq('id', profile.id);

    if (error) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully",
      });
      setProfile({ ...profile, organization, department, position });
    }

    setSaving(false);
  };

  const handleRequestAccess = async () => {
    if (!profile) return;

    // Validate tenant slug
    if (!validatedTenant) {
      toast({
        title: "Tenant required",
        description: "Please enter a valid tenant slug before requesting access",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    if (!department || !position) {
      toast({
        title: "Missing information",
        description: "Please fill in department and position before requesting access",
        variant: "destructive",
      });
      return;
    }

    setRequesting(true);

    // Save tenant name to organization field in profile for reference
    const organizationValue = validatedTenant.name;

    // First save the profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        organization: organizationValue,
        department,
        position,
      })
      .eq('id', profile.id);

    if (profileError) {
      toast({
        title: "Error saving profile",
        description: profileError.message,
        variant: "destructive",
      });
      setRequesting(false);
      return;
    }

    // Then create approval request with tenant_id
    const { error } = await supabase
      .from('user_approvals')
      .insert({
        user_id: profile.id,
        tenant_id: validatedTenant.id,
        requested_role: 'viewer',
        organization: organizationValue,
        department,
        position,
        status: 'pending',
      });

    if (error) {
      toast({
        title: "Error requesting access",
        description: error.message,
        variant: "destructive",
      });
      setRequesting(false);
      return;
    }

    toast({
      title: "Access request submitted",
      description: `Your request to join ${validatedTenant.name} has been submitted`,
    });

    // Redirect to pending approval page
    navigate('/pending-approval');
    setRequesting(false);
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

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCircle className="h-10 w-10 text-primary" />
              <div>
                <CardTitle className="text-2xl">Profile Setup</CardTitle>
                <CardDescription>Complete your profile to request access</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {approvalRequest ? (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                ✓ Access request submitted
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Your request is pending administrator approval. You'll receive access once approved.
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                Account Not Assigned
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Your account is not assigned to any organization. Please complete your profile and request access, or contact an administrator for an invitation link.
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Basic Info (Read-only) */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Account Information</h3>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Full Name</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.full_name || "Not provided"}</span>
              </div>
            </div>
          </div>

          {/* Editable Profile Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Organization Details</h3>

            <div className="space-y-2">
              <Label htmlFor="tenantSlug">
                Tenant Slug <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tenantSlug"
                  placeholder="e.g., default"
                  value={tenantSlug}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTenantSlug(value);
                    verifyTenantSlug(value);
                  }}
                  className="pl-10 pr-10"
                  disabled={approvalRequest !== null}
                />
                {verifying && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 text-muted-foreground animate-spin" />
                )}
                {!verifying && validatedTenant && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                )}
                {!verifying && tenantError && (
                  <XCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the tenant slug provided by your organization administrator
              </p>
              {validatedTenant && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-900 dark:text-green-100">
                    {validatedTenant.name}
                  </span>
                </div>
              )}
              {tenantError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-md">
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span className="text-sm text-destructive">
                    {tenantError}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="department"
                  placeholder="e.g., Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="pl-10"
                  disabled={approvalRequest !== null}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">
                Position <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="position"
                  placeholder="e.g., Software Engineer"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="pl-10"
                  disabled={approvalRequest !== null}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {!approvalRequest && (
              <>
                <Button
                  onClick={handleRequestAccess}
                  disabled={requesting || !validatedTenant || !department || !position || verifying}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {requesting ? "Requesting..." : "Request Access"}
                </Button>
              </>
            )}
            {approvalRequest && (
              <Button
                variant="outline"
                onClick={() => navigate('/pending-approval')}
                className="w-full"
              >
                View Request Status
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;
