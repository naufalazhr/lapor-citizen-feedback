import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Mail, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import {
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
  getInvitationUrl,
} from "@/utils/invitation";
import type { InvitationWithDetails } from "@/types/invitation";

interface InvitationManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvitationManager({ open, onOpenChange }: InvitationManagerProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUserTenant();
      fetchInvitations();
    }
  }, [open]);

  const fetchUserTenant = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single();

    if (data?.tenant_id) {
      setTenantId(data.tenant_id);
    }
  };

  const fetchInvitations = async () => {
    setLoading(true);
    const data = await getPendingInvitations();
    setInvitations(data);
    setLoading(false);
  };

  const handleCreateInvitation = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (!tenantId) {
      toast({
        title: "Error",
        description: "Your tenant information could not be found",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    const { success, invitation, error } = await createInvitation(
      email,
      tenantId,
      role
    );

    if (success && invitation) {
      toast({
        title: "Invitation created",
        description: "The invitation link is ready to share",
      });
      setEmail("");
      setRole("viewer");
      fetchInvitations();

      // Auto-copy invitation URL to clipboard
      const url = getInvitationUrl(invitation.token);
      await navigator.clipboard.writeText(url);

      toast({
        title: "Link copied!",
        description: "Invitation link has been copied to clipboard",
      });
    } else {
      toast({
        title: "Error creating invitation",
        description: error || "An error occurred",
        variant: "destructive",
      });
    }

    setCreating(false);
  };

  const handleCopyLink = async (token: string) => {
    const url = getInvitationUrl(token);
    await navigator.clipboard.writeText(url);

    toast({
      title: "Link copied",
      description: "Invitation link copied to clipboard",
    });
  };

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    const confirmed = window.confirm(`Revoke invitation for ${email}?`);
    if (!confirmed) return;

    const { success, error } = await revokeInvitation(invitationId);

    if (success) {
      toast({
        title: "Invitation revoked",
        description: `Invitation for ${email} has been deleted`,
      });
      fetchInvitations();
    } else {
      toast({
        title: "Error revoking invitation",
        description: error || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
      case 'owner':
        return 'default';
      case 'member':
        return 'secondary';
      case 'opd_member':
        return 'outline';
      default:
        return 'secondary';
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

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Users</DialogTitle>
          <DialogDescription>
            Create invitation links to invite users to your organization.
            Invitations expire after 14 days.
          </DialogDescription>
        </DialogHeader>

        {/* Create Invitation Form */}
        <div className="space-y-4 border-b pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateInvitation();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
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

          <Button
            onClick={handleCreateInvitation}
            disabled={creating || !email}
            className="w-full md:w-auto"
          >
            {creating ? "Creating..." : "Generate Invitation"}
          </Button>
        </div>

        {/* Pending Invitations List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pending Invitations</h3>
            <Badge variant="secondary">{invitations.length}</Badge>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending invitations
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{invitation.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {getRoleLabel(invitation.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          {invitation.inviter?.full_name || invitation.inviter?.email || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {isExpired(invitation.expires_at) ? (
                            <span className="text-destructive">Expired</span>
                          ) : (
                            <span>{format(new Date(invitation.expires_at), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyLink(invitation.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
