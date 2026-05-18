import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapSelectorProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

const MapClickHandler = ({ onSelect }: { onSelect: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapSelector = ({ onLocationSelect }: MapSelectorProps) => {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  const defaultCenter = {
    lat: -6.2088,
    lng: 106.8456, // Jakarta, Indonesia
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPosition({ lat, lng });
    onLocationSelect(lat, lng);
  }, [onLocationSelect]);

  return (
    <div className="rounded-lg overflow-hidden border mt-2">
      <MapContainer
        center={position || defaultCenter}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: "400px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapClickHandler onSelect={handleMapClick} />
        {position && <Marker position={position} />}
      </MapContainer>
      <p className="text-sm text-muted-foreground px-4 py-2">
        Click on the map to select your report location
      </p>
    </div>
  );
};

export default MapSelector;
