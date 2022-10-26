/*!
 * mapbox-gl-interpolate-heatmap v0.4.0
 * Mapbox layer for average/interpolation heatmaps
 * (c) 2021 Vinayak Kulkanri<inbox.vinayak@gmail.com>
 * Released under the MIT License
 */

import mapboxgl, { CustomLayerInterface } from 'mapbox-gl';

declare type HeatmapLayer = {
  id: string;
  data: {
    lat: number;
    lon: number;
    val: number;
  }[];
  framebufferFactor?: number;
  maxValue?: number;
  minValue?: number;
  opacity?: number;
  p?: number;
  aoi?: {
    lat: number;
    lon: number;
  }[];
  valueToColor?: string;
  valueToColor4?: string;
  textureCoverSameAreaAsROI?: boolean;
  points?: number[][];
} & CustomLayerInterface;
declare class MapboxInterpolateHeatmapLayer implements HeatmapLayer {
  id: string;
  data: {
    lat: number;
    lon: number;
    val: number;
  }[];
  framebufferFactor: number;
  maxValue: number;
  minValue: number;
  opacity: number;
  p: number;
  aoi?: {
    lat: number;
    lon: number;
  }[];
  valueToColor?: string;
  valueToColor4?: string;
  textureCoverSameAreaAsROI: boolean;
  points: number[][];
  aPositionComputation?: number;
  aPositionDraw?: number;
  canvas?: HTMLCanvasElement;
  computationFramebuffer: WebGLFramebuffer | null;
  computationProgram: WebGLProgram | null;
  computationTexture: WebGLTexture | null;
  computationVerticesBuffer: WebGLBuffer | null;
  drawingVerticesBuffer: WebGLBuffer | null;
  drawProgram: WebGLProgram | null;
  framebufferHeight?: number;
  framebufferWidth?: number;
  indicesBuffer: WebGLBuffer | null;
  indicesNumber: number | null;
  renderingMode: '2d' | '3d';
  resizeFramebuffer?: () => void;
  type: 'custom';
  uComputationTexture: WebGLUniformLocation | null;
  uFramebufferSize: WebGLUniformLocation | null;
  uMatrixComputation: WebGLUniformLocation | null;
  uMatrixDraw: WebGLUniformLocation | null;
  uOpacity: WebGLUniformLocation | null;
  uP: WebGLUniformLocation | null;
  uScreenSizeDraw: WebGLUniformLocation | null;
  uUi: WebGLUniformLocation | null;
  uXi: WebGLUniformLocation | null;
  constructor(options: HeatmapLayer);
  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void;
  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void;
  prerender(gl: WebGLRenderingContext, matrix: number[]): void;
  render(gl: WebGLRenderingContext, matrix: number[]): void;
}

export {
  MapboxInterpolateHeatmapLayer,
  MapboxInterpolateHeatmapLayer as default,
};
