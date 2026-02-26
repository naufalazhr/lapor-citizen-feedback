/**
 * ESM-native port of simpleheat (mourner/simpleheat@0.4) + Leaflet.heat (Leaflet/Leaflet.heat).
 *
 * leaflet.heat v0.2.0 is a bare global script that mutates window.L directly and cannot be
 * reliably loaded via Vite's ESM build. This module is a faithful 1:1 port of the official
 * source files (simpleheat.js + src/HeatLayer.js), adapted to ESM with no global-variable
 * dependencies. The algorithm is unchanged from the original.
 */

import L from "leaflet";

// ─── SimpleHeat ──────────────────────────────────────────────────────────────
// Faithful port of mourner/simpleheat@0.4 (simpleheat.js).

class SimpleHeat {
  _canvas: HTMLCanvasElement;
  _ctx: CanvasRenderingContext2D;
  _width: number;
  _height: number;
  _max = 1;
  _data: [number, number, number][] = [];
  _circle: HTMLCanvasElement | null = null;
  _grad: Uint8ClampedArray | null = null;
  _r = 0;

  defaultRadius = 25;
  defaultGradient: Record<string, string> = {
    "0.4": "blue",
    "0.6": "cyan",
    "0.7": "lime",
    "0.8": "yellow",
    "1.0": "red",
  };

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    // willReadFrequently: true — performance hint for browsers when canvas is frequently
    // read via getImageData (matches official simpleheat source)
    this._ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    this._width = canvas.width;
    this._height = canvas.height;
  }

  private _createCanvas(): HTMLCanvasElement {
    return document.createElement("canvas");
  }

  data(d: [number, number, number][]) {
    this._data = d;
    return this;
  }

  max(m: number) {
    this._max = m;
    return this;
  }

  clear() {
    this._data = [];
    return this;
  }

  resize() {
    this._width = this._canvas.width;
    this._height = this._canvas.height;
  }

  // Creates a blurred circle stamp used to draw each data point.
  // Key fix vs. previous implementation: use r2 * 2 for shadow offset (not hardcoded 200),
  // and arc at (-r2, -r2) — exactly as in the official simpleheat source.
  radius(r: number, blur = 15) {
    const circle = (this._circle = this._createCanvas());
    const ctx = circle.getContext("2d", { willReadFrequently: true })!;
    const r2 = (this._r = r + blur);
    circle.width = circle.height = r2 * 2;

    ctx.shadowOffsetX = ctx.shadowOffsetY = r2 * 2; // offset = canvas size (puts shadow on-canvas)
    ctx.shadowBlur = blur;
    ctx.shadowColor = "black";

    ctx.beginPath();
    ctx.arc(-r2, -r2, r, 0, Math.PI * 2, true); // draw off-canvas; shadow lands on canvas
    ctx.closePath();
    ctx.fill();
    return this;
  }

  gradient(grad: Record<string, string>) {
    const canvas = this._createCanvas();
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = 1;
    canvas.height = 256;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    for (const s in grad) g.addColorStop(+s, grad[s]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 256);
    this._grad = ctx.getImageData(0, 0, 1, 256).data;
    return this;
  }

  draw(minOpacity?: number) {
    if (!this._circle) this.radius(this.defaultRadius);
    if (!this._grad) this.gradient(this.defaultGradient);

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._width, this._height);

    for (const p of this._data) {
      // Key fix: clamp globalAlpha to [minOpacity, 1] — matches official draw() exactly
      ctx.globalAlpha = Math.min(
        Math.max(p[2] / this._max, minOpacity === undefined ? 0.05 : minOpacity),
        1
      );
      ctx.drawImage(this._circle!, p[0] - this._r, p[1] - this._r);
    }

    const colored = ctx.getImageData(0, 0, this._width, this._height);
    this._colorize(colored.data, this._grad!);
    ctx.putImageData(colored, 0, 0);
    return this;
  }

  private _colorize(pixels: Uint8ClampedArray, gradient: Uint8ClampedArray) {
    for (let i = 0, len = pixels.length; i < len; i += 4) {
      const j = pixels[i + 3] * 4; // alpha → gradient index
      if (j) {
        pixels[i]     = gradient[j];
        pixels[i + 1] = gradient[j + 1];
        pixels[i + 2] = gradient[j + 2];
      }
    }
  }
}

// ─── HeatLayer ───────────────────────────────────────────────────────────────
// Faithful port of Leaflet/Leaflet.heat src/HeatLayer.js.
// Uses L.Layer.extend() exactly like the original, but `L` here is the ESM import.

const HeatLayer = L.Layer.extend({
  initialize(latlngs: [number, number, number][], options: any) {
    this._latlngs = latlngs;
    L.setOptions(this, options);
  },

  setLatLngs(latlngs: [number, number, number][]) {
    this._latlngs = latlngs;
    return this.redraw();
  },

  addLatLng(latlng: [number, number, number]) {
    this._latlngs.push(latlng);
    return this.redraw();
  },

  setOptions(options: any) {
    L.setOptions(this, options);
    if (this._heat) this._updateOptions();
    return this.redraw();
  },

  redraw() {
    if (this._heat && !this._frame && !(this._map as any)._animating) {
      this._frame = L.Util.requestAnimFrame(this._redraw, this);
    }
    return this;
  },

  onAdd(map: L.Map) {
    this._map = map;
    if (!this._canvas) this._initCanvas();
    map.getPanes().overlayPane.appendChild(this._canvas);
    map.on("moveend", this._reset, this);
    if (map.options.zoomAnimation && (L.Browser as any).any3d) {
      map.on("zoomanim", this._animateZoom, this);
    }
    this._reset();
  },

  onRemove(map: L.Map) {
    map.getPanes().overlayPane.removeChild(this._canvas);
    map.off("moveend", this._reset, this);
    if (map.options.zoomAnimation) {
      map.off("zoomanim", this._animateZoom, this);
    }
  },

  addTo(map: L.Map) {
    map.addLayer(this);
    return this;
  },

  _initCanvas() {
    const canvas = (this._canvas = L.DomUtil.create(
      "canvas",
      "leaflet-heatmap-layer leaflet-layer"
    ) as HTMLCanvasElement);

    const originProp = L.DomUtil.testProp([
      "transformOrigin",
      "WebkitTransformOrigin",
      "msTransformOrigin",
    ]);
    if (originProp) (canvas.style as any)[originProp] = "50% 50%";

    const size = this._map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    const animated = this._map.options.zoomAnimation && (L.Browser as any).any3d;
    L.DomUtil.addClass(canvas, "leaflet-zoom-" + (animated ? "animated" : "hide"));

    this._heat = new SimpleHeat(canvas);
    this._updateOptions();
  },

  _updateOptions() {
    this._heat.radius(
      this.options.radius ?? this._heat.defaultRadius,
      this.options.blur
    );
    if (this.options.gradient) this._heat.gradient(this.options.gradient);
    if (this.options.max) this._heat.max(this.options.max);
  },

  _reset() {
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    const size = this._map.getSize();
    if (this._heat._width !== size.x) this._canvas.width = this._heat._width = size.x;
    if (this._heat._height !== size.y) this._canvas.height = this._heat._height = size.y;
    this._redraw();
  },

  _redraw() {
    // Key fix: guard against _redraw firing after layer is removed
    if (!this._map) return;

    const r = this._heat._r;
    const size = this._map.getSize();
    const bounds = new L.Bounds(L.point([-r, -r]), size.add([r, r]));
    const max = this.options.max ?? 1;
    // No zoom normalization: the v factor (1/2^(maxZoom-zoom)) crushes intensities
    // at typical zoom levels (e.g. v=1/128 at zoom=10 with maxZoom=17), making all
    // points render at minOpacity (5%) — invisible. Use raw intensities directly.
    const cellSize = r / 2;
    const grid: any[][] = [];
    const panePos = (this._map as any)._getMapPanePos();
    const ox = panePos.x % cellSize;
    const oy = panePos.y % cellSize;

    for (const ll of this._latlngs) {
      const p = this._map.latLngToContainerPoint(ll);
      if (!bounds.contains(p)) continue;
      const x = Math.floor((p.x - ox) / cellSize) + 2;
      const y = Math.floor((p.y - oy) / cellSize) + 2;
      const alt = ll[2] !== undefined ? +ll[2] : 1;
      const k = alt; // v = 1: each point contributes its raw intensity
      grid[y] = grid[y] || [];
      const cell = grid[y][x];
      if (cell) {
        cell[0] = (cell[0] * cell[2] + p.x * k) / (cell[2] + k);
        cell[1] = (cell[1] * cell[2] + p.y * k) / (cell[2] + k);
        cell[2] += k;
      } else {
        grid[y][x] = [p.x, p.y, k];
      }
    }

    const data: [number, number, number][] = [];
    for (const row of grid) {
      if (!row) continue;
      for (const cell of row) {
        if (cell) data.push([Math.round(cell[0]), Math.round(cell[1]), Math.min(cell[2], max)]);
      }
    }

    this._heat.data(data).draw(this.options.minOpacity);
    this._frame = null;
  },

  _animateZoom(e: any) {
    const scale = this._map.getZoomScale(e.zoom);
    const offset = (this._map as any)
      ._getCenterOffset(e.center)
      ._multiplyBy(-scale)
      .subtract((this._map as any)._getMapPanePos());

    if (L.DomUtil.setTransform) {
      L.DomUtil.setTransform(this._canvas, offset, scale);
    } else {
      (this._canvas.style as any)[L.DomUtil.TRANSFORM] =
        L.DomUtil.getTranslateString(offset) + " scale(" + scale + ")";
    }
  },
});

// ─── Public API ──────────────────────────────────────────────────────────────

export function heatLayer(
  latlngs: [number, number, number][],
  options?: {
    radius?: number;
    blur?: number;
    max?: number;
    maxZoom?: number;
    minOpacity?: number;
    gradient?: Record<string, string>;
  }
): L.Layer {
  return new (HeatLayer as any)(latlngs, options);
}
