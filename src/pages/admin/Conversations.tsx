import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare, Search, RefreshCw, Phone, FileText, X,
  Bot, Settings2, ChevronLeft, ChevronRight, UserCircle, Send,
  Upload, MapPin
} from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { usePIIMasking } from "@/hooks/use-pii-masking";
import { maskPhone, maskName } from "@/utils/pii-masking";
import AttachmentDisplay from "@/components/AttachmentDisplay";
import AIThinkingCollapsible from "@/components/admin/AIThinkingCollapsible";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/use-user-role";

interface Conversation {
  id: string;
  session_id: string;
  phone_number: string;
  sender_name: string | null;
  status: 'active' | 'completed' | 'abandoned';
  channel: 'whatsapp' | 'telegram' | 'web' | 'api';
  device_number: string | null;
  report_id: string | null;
  last_message_at: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  message_count?: number;
  is_human_handled: boolean;
  human_handler_id: string | null;
  human_handled_at: string | null;
}

interface Attachment {
  id: string;
  filename: string;
  extension: string;
  mime_type: string;
  file_size: number | null;
  storage_url: string;
  storage_path: string;
  download_status: string;
  upload_status: string;
  error_message: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_index: number;
  has_attachment: boolean;
  created_at: string;
  attachments?: Attachment[];
  agent_flow_data?: any[]; // Flowise agentFlowExecutedData for AI governance
  sent_by_human: boolean;
  human_sender_id: string | null;
}

interface ReportForm {
  reporter_name: string;
  phone: string;
  address: string;
  description: string;
  type: 'lapor' | 'aspirasi';
}

// Helper: get 1-2 initials from name or phone number
const getInitials = (nameOrPhone: string): string => {
  if (!nameOrPhone) return "?";
  const trimmed = nameOrPhone.trim();
  // If it looks like a phone number, use last 2 digits
  if (/^[+\d*]+$/.test(trimmed.replace(/\s/g, ""))) {
    return trimmed.slice(-2);
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
};

const Conversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);

  // Human takeover state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reportForm, setReportForm] = useState<ReportForm>({
    reporter_name: '', phone: '', address: '', description: '', type: 'lapor'
  });
  const [submittingReport, setSubmittingReport] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Report dialog — photo & location
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [reportLocation, setReportLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const pageSize = 20;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { level } = usePIIMasking();
  const { isAdmin, isOwner, isMember } = useUserRole();
  const canTakeover = isAdmin || isOwner || isMember;

  // Get current user ID for takeover handler
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
  }, []);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Realtime subscription: listen for new messages on selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        () => {
          fetchMessages(selectedConversation.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);

  const fetchConversations = async () => {
    try {
      setLoading(true);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('conversations')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'active' | 'completed' | 'abandoned');
      }

      if (dateFrom) {
        query = query.gte('last_message_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('last_message_at', `${dateTo}T23:59:59`);
      }

      if (searchQuery) {
        query = query.or(`phone_number.ilike.%${searchQuery}%,sender_name.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query
        .order('last_message_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalCount(count || 0);

      // Fetch global active count for the badge
      const { count: activeCountResult } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      setActiveCount(activeCountResult || 0);

      // N+1 message count fetch — acceptable since page size is limited to 20
      const conversationsWithCounts = await Promise.all(
        (data || []).map(async (conv) => {
          const { count: msgCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          return { ...conv, message_count: msgCount || 0 };
        })
      );

      setConversations(conversationsWithCounts as Conversation[]);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('message_index', { ascending: true });

      if (messagesError) throw messagesError;

      const messageIds = (messagesData || [])
        .filter(m => m.has_attachment)
        .map(m => m.id);

      let attachmentsData: Attachment[] = [];
      if (messageIds.length > 0) {
        const { data, error: attachmentsError } = await supabase
          .from('attachments')
          .select('*')
          .in('message_id', messageIds);

        if (attachmentsError) {
          console.error('Error fetching attachments:', attachmentsError);
        } else {
          attachmentsData = data || [];
        }
      }

      const messagesWithAttachments = (messagesData || []).map(message => ({
        ...message,
        attachments: attachmentsData.filter((att: any) => att.message_id === message.id)
      }));

      setMessages(messagesWithAttachments as Message[]);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setReplyText("");
    fetchMessages(conversation.id);
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/admin/reports/${reportId}`);
  };

  // ── Human Takeover Handlers ──────────────────────────────────────────────

  const handleTakeover = async () => {
    if (!selectedConversation || !currentUserId) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('conversations')
        .update({
          is_human_handled: true,
          human_handler_id: currentUserId,
          human_handled_at: now
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      // Insert system message visible in admin UI
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('message_index')
        .eq('conversation_id', selectedConversation.id)
        .order('message_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextIndex = lastMsg ? lastMsg.message_index + 1 : 0;
      await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        role: 'system',
        content: '👤 Percakapan diambil alih oleh petugas.',
        message_index: nextIndex,
        has_attachment: false
      });

      const updatedConv = {
        ...selectedConversation,
        is_human_handled: true,
        human_handler_id: currentUserId,
        human_handled_at: now
      };
      setSelectedConversation(updatedConv);
      setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
      await fetchMessages(selectedConversation.id);

      toast({ title: "Berhasil", description: "Percakapan diambil alih oleh petugas." });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
  };

  const handleSelesaikan = async () => {
    if (!selectedConversation) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('conversations')
        .update({
          status: 'completed',
          completed_at: now
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      // Insert system message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('message_index')
        .eq('conversation_id', selectedConversation.id)
        .order('message_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextIndex = lastMsg ? lastMsg.message_index + 1 : 0;
      await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        role: 'system',
        content: '✅ Percakapan diselesaikan oleh petugas.',
        message_index: nextIndex,
        has_attachment: false
      });

      const updatedConv = {
        ...selectedConversation,
        status: 'completed' as const,
        completed_at: now
      };
      setSelectedConversation(updatedConv);
      setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
      await fetchMessages(selectedConversation.id);

      toast({ title: "Berhasil", description: "Percakapan diselesaikan." });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
  };

  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || isSending) return;
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-human-reply', {
        body: { conversationId: selectedConversation.id, message: replyText.trim() }
      });
      if (error) throw error;
      setReplyText('');
      // fetchMessages will be triggered by realtime subscription,
      // but call it explicitly as a fallback
      await fetchMessages(selectedConversation.id);
    } catch (error: any) {
      toast({ title: "Gagal mengirim", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleExtractAndOpenReport = async () => {
    if (!selectedConversation) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-report-from-conversation', {
        body: { conversationId: selectedConversation.id }
      });
      if (error) throw error;

      const extracted = data?.data || {};
      setReportForm({
        reporter_name: extracted.reporter_name || '',
        phone: extracted.phone || '',
        address: extracted.address || '',
        description: extracted.description || '',
        type: extracted.type === 'aspirasi' ? 'aspirasi' : 'lapor'
      });
      // Reset photo from any previous dialog session; pre-fill location if AI extracted one
      setPhotoFile(null);
      setPhotoPreview('');
      setReportLocation(extracted.geo_location || null);
      setShowLocationPicker(false);
      setShowReportDialog(true);
    } catch (error: any) {
      toast({ title: "Gagal menganalisis percakapan", description: error.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedConversation || submittingReport) return;
    setSubmittingReport(true);
    try {
      // Upload photo if selected
      let photoUrl: string | null = null;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `admin-${selectedConversation.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(fileName, photoFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      const { data, error } = await supabase.functions.invoke('admin-submit-report', {
        body: {
          conversationId: selectedConversation.id,
          ...reportForm,
          photo_url: photoUrl,
          geo_location: reportLocation || null
        }
      });
      if (error) throw error;

      const ticketId = data?.data?.ticket_id || '';
      toast({
        title: "Laporan berhasil dibuat",
        description: ticketId ? `Nomor tiket: ${ticketId}` : "Laporan tersimpan."
      });
      setShowReportDialog(false);
      setPhotoFile(null);
      setPhotoPreview('');
      setReportLocation(null);
      // Conversation is now completed — refresh list and deselect
      await fetchConversations();
      setSelectedConversation(null);
    } catch (error: any) {
      toast({ title: "Gagal membuat laporan", description: error.message, variant: "destructive" });
    } finally {
      setSubmittingReport(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFrom, dateTo, searchQuery]);

  // Fetch when page or filters change
  useEffect(() => {
    fetchConversations();
  }, [currentPage, statusFilter, dateFrom, dateTo]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      completed: "secondary",
      abandoned: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="text-xs">
        {status}
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => (
    <Badge variant="outline" className="capitalize text-xs">
      {channel}
    </Badge>
  );

  const totalPages = Math.ceil(totalCount / pageSize);

  const isHumanReplyActive =
    canTakeover &&
    selectedConversation?.is_human_handled === true &&
    selectedConversation?.status === 'active';

  return (
    <Dashboard>
      {/* Bleed out of Dashboard's p-6 padding to fill the full content area height */}
      <div
        className="-mx-6 -mb-6 flex overflow-hidden border-t"
        style={{ height: "calc(100vh - 88px)" }}
      >
        {/* ── LEFT PANEL: Conversation List ── */}
        <div className="w-80 flex-shrink-0 border-r bg-card flex flex-col">

          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-semibold text-sm">Percakapan</span>
              {activeCount > 0 && (
                <Badge variant="default" className="text-xs">{activeCount}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={fetchConversations}
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>

          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari nomor atau nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchConversations(); }}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="p-3 border-b space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="h-7 text-xs flex-1 px-2"
              />
              <span className="text-muted-foreground text-xs self-center">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                className="h-7 text-xs flex-1 px-2"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="text-xs">Memuat...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-4 text-center">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <span className="text-xs">Tidak ada percakapan ditemukan</span>
              </div>
            ) : (
              conversations.map((conv) => {
                const displayName = conv.sender_name
                  ? maskName(conv.sender_name, level)
                  : maskPhone(conv.phone_number, level);
                const initials = getInitials(conv.sender_name || conv.phone_number);
                const isSelected = selectedConversation?.id === conv.id;
                const isActive = conv.status === "active";

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-3 border-b border-border/50 transition-colors text-left",
                      "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "bg-accent"
                    )}
                  >
                    {/* Avatar with status dot */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {initials}
                      </div>
                      {isActive && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-sm font-medium truncate">{displayName}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {conv.message_count || 0} pesan · {conv.channel}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Human mode indicator */}
                          {conv.is_human_handled && (
                            <UserCircle className="h-3.5 w-3.5 text-blue-500" title="Human Mode" />
                          )}
                          {getStatusBadge(conv.status)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="border-t p-2 flex items-center justify-between gap-2 bg-card">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Chat Area ── */}
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {!selectedConversation ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MessageSquare className="h-8 w-8 opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Pilih Percakapan</p>
                <p className="text-xs mt-1 opacity-70">Klik percakapan di sebelah kiri untuk melihat pesan</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex-shrink-0 px-4 py-3 border-b bg-card flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    {getInitials(selectedConversation.sender_name || selectedConversation.phone_number)}
                  </div>
                  {selectedConversation.status === "active" && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">
                      {selectedConversation.sender_name
                        ? maskName(selectedConversation.sender_name, level)
                        : "Unknown"}
                    </p>
                    {/* Human Mode badge */}
                    {selectedConversation.is_human_handled && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">
                        <UserCircle className="h-3 w-3 mr-1" />
                        Human Mode
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {maskPhone(selectedConversation.phone_number, level)}
                    </span>
                    {getStatusBadge(selectedConversation.status)}
                    {getChannelBadge(selectedConversation.channel)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {selectedConversation.message_count || 0} pesan
                  </span>

                  {/* Existing report link */}
                  {selectedConversation.report_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => handleViewReport(selectedConversation.report_id!)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Lihat Laporan
                    </Button>
                  )}

                  {/* Human takeover controls — only for active conversations with canTakeover role */}
                  {canTakeover && selectedConversation.status === 'active' && (
                    <>
                      {!selectedConversation.is_human_handled ? (
                        /* Not yet taken over — show Ambil Alih button */
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={handleTakeover}
                        >
                          <UserCircle className="h-3.5 w-3.5 mr-1" />
                          Ambil Alih
                        </Button>
                      ) : (
                        /* In human mode — show Buat Laporan + Selesaikan */
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={handleExtractAndOpenReport}
                            disabled={extracting}
                          >
                            {extracting ? (
                              <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />Menganalisis...</>
                            ) : (
                              <><FileText className="h-3.5 w-3.5 mr-1" />Buat Laporan</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={handleSelesaikan}
                          >
                            Selesaikan
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedConversation(null)}
                    title="Tutup"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span className="text-xs">Memuat pesan...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <span className="text-xs">Belum ada pesan</span>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isUser = message.role === "user";
                    const isSystem = message.role === "system";
                    const isSentByHuman = message.sent_by_human === true;

                    if (isSystem) {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded-full max-w-[70%] text-center">
                            {message.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={cn("flex items-end gap-2", isUser ? "justify-start" : "justify-end")}
                      >
                        {/* Citizen avatar (left side only) */}
                        {isUser && (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mb-1">
                            <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}

                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5",
                            isUser
                              ? "bg-card border shadow-sm rounded-bl-sm"
                              : "bg-primary text-primary-foreground rounded-br-sm"
                          )}
                        >
                          {/* AI/Human sender label */}
                          {!isUser && (
                            <p className="text-xs text-primary-foreground/60 mb-1 flex items-center gap-1">
                              {isSentByHuman
                                ? <><UserCircle className="h-3 w-3" /> Petugas</>
                                : <><Bot className="h-3 w-3" /> AI</>
                              }
                            </p>
                          )}

                          {/* Skip [Gambar] placeholder — <AttachmentDisplay> below already renders the image */}
                          {message.content && message.content !== '[Gambar]' && (() => {
                            // Detect location content: "[Lokasi: lat, lng]" format saved by the webhook
                            const locMatch = message.content.match(/^\[Lokasi:\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]$/);
                            if (locMatch) {
                              return (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-current opacity-75" />
                                  <span className="font-mono text-xs opacity-90">{locMatch[1]}, {locMatch[2]}</span>
                                </div>
                              );
                            }
                            return <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>;
                          })()}

                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.attachments.map((attachment) => (
                                <AttachmentDisplay
                                  key={attachment.id}
                                  attachment={attachment}
                                />
                              ))}
                            </div>
                          )}

                          {/* AI Governance: Show AI thinking for AI assistant messages */}
                          {message.role === "assistant" && !isSentByHuman && message.agent_flow_data && (
                            <AIThinkingCollapsible agentFlowData={message.agent_flow_data} />
                          )}

                          {/* Timestamp */}
                          <p className={cn(
                            "text-xs mt-1.5 select-none text-right",
                            isUser ? "text-muted-foreground/60" : "text-primary-foreground/60"
                          )}>
                            {new Date(message.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer: reply input OR read-only indicator */}
              {isHumanReplyActive ? (
                /* Human reply input */
                <div className="flex-shrink-0 px-4 py-3 border-t bg-card/50">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      placeholder="Tulis balasan... (Enter kirim, Shift+Enter baris baru)"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      className="min-h-[72px] max-h-40 text-sm resize-none flex-1"
                      disabled={isSending}
                    />
                    <Button
                      size="icon"
                      className="h-10 w-10 flex-shrink-0"
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                      title="Kirim"
                    >
                      {isSending
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Pesan ini akan dikirim via WhatsApp ke warga
                  </p>
                </div>
              ) : (
                /* Read-only / info footer */
                <div className="flex-shrink-0 px-4 py-2 border-t bg-card/50 flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    Mulai: {new Date(selectedConversation.started_at).toLocaleString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Settings2 className="h-3 w-3" />
                    <span>Read-only</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Report Submission Dialog ── */}
      <Dialog open={showReportDialog} onOpenChange={(open) => {
        if (!open) { setShowLocationPicker(false); }
        setShowReportDialog(open);
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Buat Laporan dari Percakapan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Data diekstrak oleh AI dari percakapan. Periksa dan edit sebelum menyimpan.
            </p>

            <div className="space-y-3">
              {/* Name + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reporter_name" className="text-xs font-medium">
                    Nama Pelapor <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reporter_name"
                    value={reportForm.reporter_name}
                    onChange={(e) => setReportForm(f => ({ ...f, reporter_name: e.target.value }))}
                    placeholder="Nama lengkap"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium">
                    Nomor HP <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={reportForm.phone}
                    onChange={(e) => setReportForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="08xxxxxxxxxx"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Jenis <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-4 pt-0.5">
                  {(['lapor', 'aspirasi'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="report-type"
                        value={t}
                        checked={reportForm.type === t}
                        onChange={() => setReportForm(f => ({ ...f, type: t }))}
                        className="accent-primary"
                      />
                      <span className="text-sm capitalize">{t === 'lapor' ? 'Laporan' : 'Aspirasi'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-medium">
                  Alamat / Lokasi Kejadian <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  value={reportForm.address}
                  onChange={(e) => setReportForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Nama jalan, kelurahan, kecamatan..."
                  className="h-9 text-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-medium">
                  Deskripsi <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={reportForm.description}
                  onChange={(e) => setReportForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Uraian lengkap laporan atau aspirasi..."
                  className="min-h-[90px] text-sm resize-none"
                />
              </div>

              {/* Photo upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Foto Pendukung</Label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    type="button"
                    onClick={() => document.getElementById('report-photo-input')?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {photoFile ? 'Ganti Foto' : 'Pilih Foto'}
                  </Button>
                  {photoFile && (
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {photoFile.name}
                    </span>
                  )}
                </div>
                <input
                  id="report-photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setPhotoPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {photoPreview && (
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-28 w-28 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Location / GPS picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Koordinat GPS</Label>
                {reportLocation ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono text-muted-foreground">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      {reportLocation.lat.toFixed(6)}, {reportLocation.lng.toFixed(6)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      type="button"
                      onClick={() => { setReportLocation(null); setShowLocationPicker(true); }}
                    >
                      Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      type="button"
                      onClick={() => setReportLocation(null)}
                      title="Hapus lokasi"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs w-full"
                    type="button"
                    onClick={() => setShowLocationPicker(v => !v)}
                  >
                    <MapPin className="h-3.5 w-3.5 mr-1" />
                    {showLocationPicker ? 'Sembunyikan Peta' : 'Pilih Lokasi di Peta'}
                  </Button>
                )}
                {showLocationPicker && !reportLocation && (
                  <LeafletLocationPicker
                    onConfirm={(lat, lng) => {
                      setReportLocation({ lat, lng });
                      setShowLocationPicker(false);
                    }}
                    onCancel={() => setShowLocationPicker(false)}
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowLocationPicker(false); setShowReportDialog(false); }}
              disabled={submittingReport}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={
                submittingReport ||
                !reportForm.reporter_name.trim() ||
                !reportForm.phone.trim() ||
                !reportForm.address.trim() ||
                !reportForm.description.trim()
              }
            >
              {submittingReport ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                <><FileText className="h-4 w-4 mr-2" />Submit Laporan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dashboard>
  );
};

// ── Leaflet interactive location picker (no API key required, OpenStreetMap tiles) ──
const LeafletLocationPicker = ({
  onConfirm,
  onCancel
}: {
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Fix bundled marker icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current, { scrollWheelZoom: false })
      .setView([-6.2088, 106.8456], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng]).addTo(map);
      setPicked({ lat, lng });
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-2 mt-1">
      <div
        ref={containerRef}
        style={{ height: 260 }}
        className="rounded-lg border overflow-hidden"
      />
      <p className="text-xs text-muted-foreground">
        {picked
          ? `✓ Dipilih: ${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`
          : 'Klik pada peta untuk memilih titik lokasi'}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>
          Batal
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={!picked}
          onClick={() => picked && onConfirm(picked.lat, picked.lng)}
        >
          <MapPin className="h-3.5 w-3.5 mr-1" />
          Konfirmasi Lokasi
        </Button>
      </div>
    </div>
  );
};

export default Conversations;
