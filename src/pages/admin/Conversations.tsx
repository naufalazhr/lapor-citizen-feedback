import { useState, useEffect } from "react";
import Dashboard from "./Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Search, RefreshCw, Phone, Calendar, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import AttachmentDisplay from "@/components/AttachmentDisplay";

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
}

const Conversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchConversations = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('conversations')
        .select('*');

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'active' | 'completed' | 'abandoned');
      }

      if (channelFilter !== 'all') {
        query = query.eq('channel', channelFilter as 'whatsapp' | 'telegram' | 'web' | 'api');
      }

      if (searchQuery) {
        query = query.or(`phone_number.ilike.%${searchQuery}%,sender_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get message counts for each conversation
      const conversationsWithCounts = await Promise.all(
        (data || []).map(async (conv) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          return { ...conv, message_count: count || 0 };
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

      // First, fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('message_index', { ascending: true });

      if (messagesError) throw messagesError;

      // Then, fetch attachments for messages that have them
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

      // Combine messages with their attachments
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

  const handleViewConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setDialogOpen(true);
    fetchMessages(conversation.id);
  };

  useEffect(() => {
    fetchConversations();
  }, [statusFilter, channelFilter]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      completed: "secondary",
      abandoned: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => {
    return (
      <Badge variant="outline" className="capitalize">
        {channel}
      </Badge>
    );
  };

  return (
    <Dashboard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">WhatsApp Conversations</h1>
            <p className="text-muted-foreground">
              Monitor and manage conversations from Fonnte-Flowise integration
            </p>
          </div>

          <Button onClick={fetchConversations} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>
              Search and filter conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Phone number or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchConversations();
                      }
                    }}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations ({conversations.length})
            </CardTitle>
            <CardDescription>
              Click on a conversation to view message history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mt-2">No conversations found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((conversation) => (
                      <TableRow key={conversation.id}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {conversation.phone_number}
                          </div>
                        </TableCell>
                        <TableCell>{conversation.sender_name || 'Unknown'}</TableCell>
                        <TableCell>{getStatusBadge(conversation.status)}</TableCell>
                        <TableCell>{getChannelBadge(conversation.channel)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{conversation.message_count || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(conversation.started_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewConversation(conversation)}
                          >
                            View Messages
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation Details
              </DialogTitle>
              <DialogDescription>
                {selectedConversation && (
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span className="font-mono">{selectedConversation.phone_number}</span>
                      {getStatusBadge(selectedConversation.status)}
                    </div>
                    <p className="text-sm">
                      Started: {new Date(selectedConversation.started_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            {loadingMessages ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.role === 'assistant'
                          ? 'bg-muted'
                          : 'bg-secondary text-secondary-foreground text-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-medium capitalize opacity-70">
                          {message.role}
                        </span>
                        <span className="text-xs opacity-70">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Dashboard>
  );
};

export default Conversations;