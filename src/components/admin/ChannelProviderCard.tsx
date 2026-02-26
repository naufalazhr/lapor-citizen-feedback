import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Settings } from "lucide-react";

interface ChannelProviderCardProps {
  name: string;
  description: string;
  logo?: ReactNode;
  icon?: ReactNode;
  isActive: boolean;
  isComingSoon?: boolean;
  isConfigOpen?: boolean;
  onConfigure: () => void;
}

export const ChannelProviderCard = ({
  name,
  description,
  logo,
  icon,
  isActive,
  isComingSoon = false,
  isConfigOpen = false,
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
          ? "border-primary ring-1 ring-primary/20 bg-primary/5"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onConfigure}
    >
      <CardContent className="p-5 flex flex-col items-center text-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${
            logo ? "" : isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {logoElement}
        </div>
        <div>
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        </div>
        <div className="flex flex-col items-center gap-2 w-full">
          {isActive && (
            <Badge variant="default" className="flex items-center gap-1 text-xs bg-primary/90">
              <CheckCircle className="h-3 w-3" />
              Terkonfigurasi
            </Badge>
          )}
          <Button
            size="sm"
            variant={isConfigOpen ? "default" : isActive ? "outline" : "default"}
            className="w-full text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
          >
            <Settings className="h-3 w-3 mr-1" />
            {isConfigOpen ? "Tutup Konfigurasi" : isActive ? "Atur Konfigurasi" : "Aktifkan & Konfigurasi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
