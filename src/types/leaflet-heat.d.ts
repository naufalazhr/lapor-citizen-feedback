import * as L from 'leaflet';

declare module 'leaflet' {
  export type HeatLatLngTuple = [number, number, number?];

  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }

  export interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: HeatLatLngTuple[]): this;
    addLatLng(latlng: HeatLatLngTuple): this;
    setOptions(options: HeatMapOptions): this;
    redraw(): this;
  }

  export function heatLayer(
    latlngs: HeatLatLngTuple[],
    options?: HeatMapOptions
  ): HeatLayer;
}
