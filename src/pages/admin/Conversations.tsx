import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare, Search, RefreshCw, Phone, FileText, X,
  Bot, Settings2, ChevronLeft, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { usePIIMasking } from "@/hooks/use-pii-masking";
import { maskPhone, maskName } from "@/utils/pii-masking";
import AttachmentDisplay from "@/components/AttachmentDisplay";
import AIThinkingCollapsible from "@/components/admin/AIThinkingCollapsible";
import { cn } from "@/lib/utils";

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
  const pageSize = 20;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { level } = usePIIMasking();

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

      setConversations(conversationsWithCounts);
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

      setMessages(messagesWithAttachments);
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
    fetchMessages(conversation.id);
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/admin/reports/${reportId}`);
  };

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
                        {getStatusBadge(conv.status)}
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
                  <p className="font-semibold text-sm truncate">
                    {selectedConversation.sender_name
                      ? maskName(selectedConversation.sender_name, level)
                      : "Unknown"}
                  </p>
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
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {selectedConversation.message_count || 0} pesan
                  </span>
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
                        className={cn("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}
                      >
                        {/* Bot avatar (left side only) */}
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mb-1">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}

                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5",
                            isUser
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border shadow-sm rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

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

                          {/* AI Governance: Show AI thinking for assistant messages */}
                          {message.role === "assistant" && message.agent_flow_data && (
                            <AIThinkingCollapsible agentFlowData={message.agent_flow_data} />
                          )}

                          {/* Timestamp */}
                          <p className={cn(
                            "text-xs mt-1.5 select-none",
                            isUser ? "text-primary-foreground/60 text-right" : "text-muted-foreground/60 text-right"
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

              {/* Info Footer */}
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
            </>
          )}
        </div>
      </div>
    </Dashboard>
  );
};

export default Conversations;
