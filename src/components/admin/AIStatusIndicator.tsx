import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, BotOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AIStatusIndicator() {
  const [isAIEnabled, setIsAIEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIStatus();

    // Subscribe to realtime updates for AI config changes
    const channel = supabase
      .channel('ai_config_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_assistant_config',
        },
        (payload) => {
          console.log('AI config changed:', payload);
          // Refetch status when config changes
          fetchAIStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAIStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_assistant_config")
        .select("is_ai_enabled")
        .eq("config_name", "default")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching AI status:", error);
        return;
      }

      // Default to true if no config exists
      setIsAIEnabled(data?.is_ai_enabled ?? true);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything while loading or if status is unknown
  if (loading || isAIEnabled === null) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 cursor-default transition-colors ${
              isAIEnabled
                ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100"
            }`}
          >
            {isAIEnabled ? (
              <>
                <Bot className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">AI Aktif</span>
              </>
            ) : (
              <>
                <BotOff className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">AI Nonaktif</span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            {isAIEnabled
              ? "AI Asisten aktif - pesan WhatsApp diproses oleh AI"
              : "AI Asisten nonaktif - pesan WhatsApp dibalas dengan teks preset"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
