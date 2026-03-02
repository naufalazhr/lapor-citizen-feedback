import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Settings, Loader2, Zap } from "lucide-react";

interface ChannelProviderCardProps {
  name: string;
  description: string;
  logo?: ReactNode;
  icon?: ReactNode;
  /** True when this provider is the one currently routing messages */
  isActive: boolean;
  /** True when credentials are saved but not necessarily routing */
  isConfigured?: boolean;
  isComingSoon?: boolean;
  isConfigOpen?: boolean;
  /** True while activateProvider() is in flight */
  isActivating?: boolean;
  onActivate?: () => void;
  onConfigure: () => void;
}

export const ChannelProviderCard = ({
  name,
  description,
  logo,
  icon,
  isActive,
  isConfigured = false,
  isComingSoon = false,
  isConfigOpen = false,
  isActivating = false,
  onActivate,
  onConfigure,
}: ChannelProviderCardProps) => {
  const logoElement = logo ?? icon;

  if (isComingSoon) {
    return (
      <Card className="opacity-60 border-dashed">
        <CardContent className="p-5 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
            {logoElement}
          </div>
          <div>
            <p className="font-semibold text-sm text-muted-foreground">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            Segera Hadir
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
        isActive
          ? "border-green-500 ring-1 ring-green-500/30 bg-green-50 dark:bg-green-950/20"
          : isConfigured
          ? "border-primary/40 ring-1 ring-primary/10"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onConfigure}
    >
      <CardContent className="p-5 flex flex-col items-center text-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${
            logo ? "" : isActive ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-muted-foreground"
          }`}
        >
          {logoElement}
        </div>
        <div>
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        </div>

        <div className="flex flex-col items-center gap-2 w-full">
          {/* Routing status badge */}
          {isActive && (
            <Badge className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-600">
              <CheckCircle className="h-3 w-3" />
              Aktif
            </Badge>
          )}
          {/* Credentials-only badge (configured but not currently routing) */}
          {!isActive && isConfigured && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Settings className="h-3 w-3" />
              Terkonfigurasi
            </Badge>
          )}

          {/* Activate button — only when has credentials but not routing */}
          {!isActive && isConfigured && onActivate && (
            <Button
              size="sm"
              variant="default"
              className="w-full text-xs"
              disabled={isActivating}
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
            >
              {isActivating ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Zap className="h-3 w-3 mr-1" />
              )}
              {isActivating ? "Mengaktifkan..." : "Jadikan Aktif"}
            </Button>
          )}

          {/* Configure button */}
          <Button
            size="sm"
            variant={isConfigOpen ? "default" : isActive ? "outline" : isConfigured ? "outline" : "default"}
            className="w-full text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
          >
            <Settings className="h-3 w-3 mr-1" />
            {isConfigOpen
              ? "Tutup Konfigurasi"
              : isActive || isConfigured
              ? "Atur Konfigurasi"
              : "Aktifkan & Konfigurasi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
