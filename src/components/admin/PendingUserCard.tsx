import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Building2,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserApproval {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  organization: string | null;
  department: string | null;
  position: string | null;
  requested_at: string;
  user?: {
    email: string;
    full_name?: string;
  };
}

interface PendingUserCardProps {
  approval: UserApproval;
  onApproved: () => void;
  onRejected: () => void;
}

export function PendingUserCard({ approval, onApproved, onRejected }: PendingUserCardProps) {
  const { toast } = useToast();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>(approval.requested_role);
  const [rejectionReason, setRejectionReason] = useState("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);

  const fetchTenants = async () => {
    setLoadingTenants(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, slug, status")
      .eq("status", "active")
      .order("name");

    if (error) {
      console.error("Error fetching tenants:", error);
      toast({
        title: "Error loading tenants",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTenants(data || []);
    }
    setLoadingTenants(false);
  };

  const handleApproveClick = () => {
    fetchTenants();
    setShowApproveDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedTenant) {
      toast({
        title: "Tenant required",
        description: "Please select a tenant/organization",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Step 1: Update user's tenant_id in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ tenant_id: selectedTenant })
        .eq("id", approval.user_id);

      if (profileError) throw profileError;

      // Step 2: Assign role to user
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: approval.user_id, role: selectedRole });

      if (roleError) {
        // If role already exists, update it
        const { error: updateRoleError } = await supabase
          .from("user_roles")
          .update({ role: selectedRole })
          .eq("user_id", approval.user_id);

        if (updateRoleError) throw updateRoleError;
      }

      // Step 3: Update approval status
      const { error: approvalError } = await supabase
        .from("user_approvals")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getSession()).data.session?.user.id,
        })
        .eq("id", approval.id);

      if (approvalError) throw approvalError;

      toast({
        title: "User approved",
        description: `${approval.user?.email} has been approved and can now access the system`,
      });

      setShowApproveDialog(false);
      onApproved();
    } catch (error: any) {
      toast({
        title: "Error approving user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      const { error } = await supabase
        .from("user_approvals")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getSession()).data.session?.user.id,
          rejection_reason: rejectionReason,
        })
        .eq("id", approval.id);

      if (error) throw error;

      toast({
        title: "User rejected",
        description: `${approval.user?.email}'s request has been rejected`,
      });

      setShowRejectDialog(false);
      onRejected();
    } catch (error: any) {
      toast({
        title: "Error rejecting user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                {approval.user?.email}
              </CardTitle>
              {approval.user?.full_name && (
                <CardDescription className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {approval.user.full_name}
                </CardDescription>
              )}
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(approval.requested_at), { addSuffix: true })}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* Request Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {approval.organization && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Organization</p>
                    <p className="font-medium">{approval.organization}</p>
                  </div>
                </div>
              )}

              {approval.department && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="font-medium">{approval.department}</p>
                  </div>
                </div>
              )}

              {approval.position && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Position</p>
                    <p className="font-medium">{approval.position}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Requested Role */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Requested Role</p>
              <Badge variant="outline">{approval.requested_role}</Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleApproveClick}
                className="flex-1"
                variant="default"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => setShowRejectDialog(true)}
                className="flex-1"
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve User</DialogTitle>
            <DialogDescription>
              Assign {approval.user?.email} to a tenant and role
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant / Organization</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger disabled={loadingTenants}>
                  <SelectValue placeholder={loadingTenants ? "Loading..." : "Select tenant"} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="opd_member">OPD Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing || !selectedTenant}>
              {processing ? "Approving..." : "Approve User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {approval.user?.email}'s request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <Textarea
              placeholder="e.g., User does not meet requirements..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? "Rejecting..." : "Reject User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
