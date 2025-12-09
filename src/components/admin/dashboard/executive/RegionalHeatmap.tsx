import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Map, Layers, CircleDot } from "lucide-react";
import { ReportWithLocation } from "@/hooks/use-executive-dashboard";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface RegionalHeatmapProps {
  reports: ReportWithLocation[];
}

type ViewMode = "heatmap" | "markers";

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending": return "#ef4444"; // red
    case "in_progress": return "#f97316"; // orange
    case "resolved": return "#22c55e"; // green
    case "rejected": return "#6b7280"; // gray
    default: return "#3b82f6"; // blue
  }
};

export function RegionalHeatmap({ reports }: RegionalHeatmapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.HeatLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("markers");
  const [isMapReady, setIsMapReady] = useState(false);

  // Calculate center and data
  const { center, heatmapData, validReports, totalPoints } = useMemo(() => {
    const valid = reports.filter(
      (r) => r.geo_location?.lat && r.geo_location?.lng &&
             typeof r.geo_location.lat === 'number' &&
             typeof r.geo_location.lng === 'number' &&
             !isNaN(r.geo_location.lat) && !isNaN(r.geo_location.lng)
    );

    if (valid.length === 0) {
      // Default to Indonesia center
      return {
        center: { lat: -2.5489, lng: 118.0149 },
        heatmapData: [] as [number, number, number][],
        validReports: [] as ReportWithLocation[],
        totalPoints: 0,
      };
    }

    // Calculate center from all points
    const sumLat = valid.reduce((acc, r) => acc + (r.geo_location?.lat || 0), 0);
    const sumLng = valid.reduce((acc, r) => acc + (r.geo_location?.lng || 0), 0);

    // Create heatmap data points with intensity based on status
    const data: [number, number, number][] = valid.map((r) => {
      let intensity = 0.5;
      if (r.status === "pending") intensity = 1.0;
      else if (r.status === "in_progress") intensity = 0.7;
      else if (r.status === "resolved") intensity = 0.3;
      else if (r.status === "rejected") intensity = 0.2;

      return [r.geo_location!.lat, r.geo_location!.lng, intensity];
    });

    return {
      center: {
        lat: sumLat / valid.length,
        lng: sumLng / valid.length,
      },
      heatmapData: data,
      validReports: valid,
      totalPoints: valid.length,
    };
  }, [reports]);

  // Initialize map
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

  // Update map center when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    if (totalPoints > 0) {
      mapInstanceRef.current.setView([center.lat, center.lng], 10);
    }
  }, [center, totalPoints, isMapReady]);

  // Update layers based on view mode
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const map = mapInstanceRef.current;

    // Clear existing layers
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }

    if (validReports.length === 0) return;

    if (viewMode === "heatmap" && heatmapData.length > 0) {
      // Add heatmap layer
      const heatLayer = L.heatLayer(heatmapData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: 1.0,
        gradient: {
          0.2: "#22c55e",
          0.4: "#eab308",
          0.6: "#f97316",
          0.8: "#ef4444",
          1.0: "#dc2626",
        },
      });
      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;
    } else if (viewMode === "markers" && markersLayerRef.current) {
      // Add markers
      validReports.forEach((report) => {
        if (!report.geo_location) return;

        const color = getStatusColor(report.status);
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background-color: ${color};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([report.geo_location.lat, report.geo_location.lng], { icon });

        const popupContent = `
          <div style="min-width: 150px;">
            <strong>${report.ticket_id}</strong><br/>
            <span style="color: ${color}; font-weight: 500;">${report.status}</span><br/>
            <small>${report.reporter_name}</small><br/>
            <small>${report.type}</small>
          </div>
        `;

        marker.bindPopup(popupContent);
        markersLayerRef.current?.addLayer(marker);
      });

      // Fit bounds to markers if we have multiple points
      if (validReports.length > 1) {
        const bounds = L.latLngBounds(
          validReports.map(r => [r.geo_location!.lat, r.geo_location!.lng])
        );
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [viewMode, validReports, heatmapData, isMapReady]);

  const hasData = reports.length > 0 && totalPoints > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4 text-blue-500" />
            Peta Sebaran Wilayah
          </CardTitle>
          {hasData && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* Always render map container to ensure initialization */}
          <div
            ref={mapContainerRef}
            style={{ height: "300px", width: "100%" }}
            className="rounded-b-lg"
          />
          {/* Empty state overlay - shown when no data */}
          {!hasData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm rounded-b-lg z-[1001]">
              <MapPin className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Belum ada data lokasi laporan
              </p>
            </div>
          )}
          {/* Legend - only show when there's data */}
          {hasData && (
            <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm p-2 rounded-md shadow-md border text-xs z-[1000]">
              <div className="font-medium mb-1">Status:</div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Proses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Selesai</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
