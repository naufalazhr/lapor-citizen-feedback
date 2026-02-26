import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { heatLayer } from "@/lib/leaflet-heat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Map, Layers, CircleDot, Maximize2 } from "lucide-react";
import { ReportWithLocation } from "@/hooks/use-executive-dashboard";
import { maskName, MaskingLevel } from "@/utils/pii-masking";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface RegionalHeatmapProps {
  reports: ReportWithLocation[];
  maskingLevel?: MaskingLevel;
}

type ViewMode = "heatmap" | "markers";

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending": return "#ef4444";
    case "in_progress": return "#f97316";
    case "resolved": return "#22c55e";
    case "rejected": return "#6b7280";
    default: return "#3b82f6";
  }
};

// Helper: add/replace layers on a map instance
function applyLayers(
  map: L.Map,
  viewMode: ViewMode,
  validReports: ReportWithLocation[],
  heatmapData: [number, number, number][],
  maskingLevel: MaskingLevel,
  heatLayerRef: React.MutableRefObject<L.Layer | null>,
  markersLayerRef: React.MutableRefObject<L.LayerGroup | null>
) {
  if (heatLayerRef.current) {
    map.removeLayer(heatLayerRef.current);
    heatLayerRef.current = null;
  }
  if (markersLayerRef.current) {
    markersLayerRef.current.clearLayers();
  }

  if (validReports.length === 0) return;

  if (viewMode === "heatmap" && heatmapData.length > 0) {
    const layer = heatLayer(heatmapData, {
      radius: 35,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: { "0.2": "#22c55e", "0.5": "#eab308", "0.7": "#f97316", "0.9": "#ef4444", "1.0": "#dc2626" },
    });
    layer.addTo(map);
    heatLayerRef.current = layer;
  } else if (viewMode === "markers" && markersLayerRef.current) {
    validReports.forEach((report) => {
      if (!report.geo_location) return;
      const color = getStatusColor(report.status);
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="background-color:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([report.geo_location.lat, report.geo_location.lng], { icon });
      const displayName = maskName(report.reporter_name, maskingLevel);
      marker.bindPopup(`<div style="min-width:150px;"><strong>${report.ticket_id}</strong><br/><span style="color:${color};font-weight:500;">${report.status}</span><br/><small>${displayName}</small><br/><small>${report.type}</small></div>`);
      markersLayerRef.current?.addLayer(marker);
    });
    if (validReports.length > 1) {
      const bounds = L.latLngBounds(validReports.map(r => [r.geo_location!.lat, r.geo_location!.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }
}

export function RegionalHeatmap({ reports, maskingLevel = "L0" }: RegionalHeatmapProps) {
  // Inline map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Expanded map refs
  const expandedContainerRef = useRef<HTMLDivElement | null>(null);
  const expandedMapRef = useRef<L.Map | null>(null);
  const expandedHeatLayerRef = useRef<L.Layer | null>(null);
  const expandedMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("markers");
  const [isMapReady, setIsMapReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { center, heatmapData, validReports, totalPoints } = useMemo(() => {
    const valid = reports.filter(
      (r) =>
        r.geo_location?.lat &&
        r.geo_location?.lng &&
        typeof r.geo_location.lat === "number" &&
        typeof r.geo_location.lng === "number" &&
        !isNaN(r.geo_location.lat) &&
        !isNaN(r.geo_location.lng)
    );

    if (valid.length === 0) {
      return {
        center: { lat: -2.5489, lng: 118.0149 },
        heatmapData: [] as [number, number, number][],
        validReports: [] as ReportWithLocation[],
        totalPoints: 0,
      };
    }

    const sumLat = valid.reduce((acc, r) => acc + (r.geo_location?.lat || 0), 0);
    const sumLng = valid.reduce((acc, r) => acc + (r.geo_location?.lng || 0), 0);

    // Intensity reflects urgency: pending = hottest (1.0), resolved = coolest (0.3)
    const data: [number, number, number][] = valid.map((r) => {
      let intensity = 0.5;
      if (r.status === "pending") intensity = 1.0;
      else if (r.status === "in_progress") intensity = 0.7;
      else if (r.status === "resolved") intensity = 0.3;
      else if (r.status === "rejected") intensity = 0.2;
      return [r.geo_location!.lat, r.geo_location!.lng, intensity];
    });

    return {
      center: { lat: sumLat / valid.length, lng: sumLng / valid.length },
      heatmapData: data,
      validReports: valid,
      totalPoints: valid.length,
    };
  }, [reports]);

  // --- Inline map ---
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([center.lat, center.lng], totalPoints > 0 ? 10 : 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    setIsMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        heatLayerRef.current = null;
        markersLayerRef.current = null;
        setIsMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;
    if (totalPoints > 0) mapInstanceRef.current.setView([center.lat, center.lng], 10);
  }, [center, totalPoints, isMapReady]);

  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;
    applyLayers(mapInstanceRef.current, viewMode, validReports, heatmapData, maskingLevel, heatLayerRef, markersLayerRef);
  }, [viewMode, validReports, heatmapData, isMapReady]);

  // --- Expanded map: initialize when dialog opens, destroy when it closes ---
  useEffect(() => {
    if (!isExpanded) {
      if (expandedMapRef.current) {
        expandedMapRef.current.remove();
        expandedMapRef.current = null;
        expandedHeatLayerRef.current = null;
        expandedMarkersLayerRef.current = null;
      }
      return;
    }

    // Wait one tick for the dialog DOM to be ready
    const timer = setTimeout(() => {
      if (!expandedContainerRef.current || expandedMapRef.current) return;

      const map = L.map(expandedContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([center.lat, center.lng], totalPoints > 0 ? 10 : 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      expandedMarkersLayerRef.current = L.layerGroup().addTo(map);
      expandedMapRef.current = map;

      applyLayers(map, viewMode, validReports, heatmapData, maskingLevel, expandedHeatLayerRef, expandedMarkersLayerRef);

      if (validReports.length > 1) {
        const bounds = L.latLngBounds(validReports.map(r => [r.geo_location!.lat, r.geo_location!.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Update expanded map layers when viewMode changes while expanded
  useEffect(() => {
    if (!expandedMapRef.current || !isExpanded) return;
    applyLayers(expandedMapRef.current, viewMode, validReports, heatmapData, maskingLevel, expandedHeatLayerRef, expandedMarkersLayerRef);
  }, [viewMode, isExpanded]);

  const hasData = reports.length > 0 && totalPoints > 0;

  const Legend = () => (
    <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm p-2 rounded-md shadow-md border text-xs z-10">
      {viewMode === "markers" ? (
        <>
          <div className="font-medium mb-1">Status:</div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /><span>Pending</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-500" /><span>Proses</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" /><span>Selesai</span></div>
          </div>
        </>
      ) : (
        <>
          <div className="font-medium mb-1">Urgensi:</div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-600" /><span>Tinggi (Pending)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" /><span>Sedang (Proses)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" /><span>Rendah (Selesai)</span></div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <Card className="overflow-hidden isolate">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4 text-blue-500" />
              Peta Sebaran Wilayah
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasData && (
                <>
                  <Badge variant="outline" className="text-xs">
                    {totalPoints} lokasi
                  </Badge>
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === "markers" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2 rounded-r-none"
                      onClick={() => setViewMode("markers")}
                      title="Tampilan Marker"
                    >
                      <CircleDot className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={viewMode === "heatmap" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2 rounded-l-none"
                      onClick={() => setViewMode("heatmap")}
                      title="Tampilan Heatmap"
                    >
                      <Layers className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsExpanded(true)}
                title="Perbesar peta"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="relative overflow-hidden rounded-b-lg">
            <div
              ref={mapContainerRef}
              style={{ height: "300px", width: "100%", overflow: "hidden" }}
              className="rounded-b-lg"
            />
            {!hasData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm z-10">
                <MapPin className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada data lokasi laporan</p>
              </div>
            )}
            {hasData && <Legend />}
          </div>
        </CardContent>
      </Card>

      {/* Expanded map dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Map className="h-4 w-4 text-blue-500" />
                Peta Sebaran Wilayah
                {hasData && (
                  <Badge variant="outline" className="text-xs font-normal ml-1">
                    {totalPoints} lokasi
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Peta interaktif sebaran lokasi laporan warga
              </DialogDescription>
              {hasData && (
                <div className="flex border rounded-md mr-8">
                  <Button
                    variant={viewMode === "markers" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 rounded-r-none"
                    onClick={() => setViewMode("markers")}
                    title="Tampilan Marker"
                  >
                    <CircleDot className="h-3 w-3 mr-1" />
                    <span className="text-xs">Marker</span>
                  </Button>
                  <Button
                    variant={viewMode === "heatmap" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 rounded-l-none"
                    onClick={() => setViewMode("heatmap")}
                    title="Tampilan Heatmap"
                  >
                    <Layers className="h-3 w-3 mr-1" />
                    <span className="text-xs">Heatmap</span>
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="relative flex-1 overflow-hidden isolate">
            <div
              ref={expandedContainerRef}
              style={{ height: "100%", width: "100%", overflow: "hidden" }}
            />
            {!hasData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm z-10">
                <MapPin className="h-16 w-16 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Belum ada data lokasi laporan</p>
              </div>
            )}
            {hasData && <Legend />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
