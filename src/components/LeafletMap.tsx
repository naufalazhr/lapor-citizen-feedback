import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

interface LeafletMapProps {
  latitude: number;
  longitude: number;
}

const LeafletMap = ({ latitude, longitude }: LeafletMapProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="rounded-lg overflow-hidden border h-[400px] flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  // Dynamically import and use react-leaflet components
  const { MapContainer, TileLayer, Marker, Popup } = require("react-leaflet");
  const L = require("leaflet");

  // Fix for default marker icon
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });

  return (
    <div className="rounded-lg overflow-hidden border">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        style={{ height: "400px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]}>
          <Popup>
            Lokasi Laporan<br />
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default LeafletMap;
