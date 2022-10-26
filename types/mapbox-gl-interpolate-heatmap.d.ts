/*!
 * mapbox-gl-interpolate-heatmap v0.3.1
 * Mapbox layer for average/interpolation heatmaps
 * (c) 2021 Vinayak Kulkanri<inbox.vinayak@gmail.com>
 * Released under the MIT License
 */

import mapboxgl, { CustomLayerInterface } from 'mapbox-gl';

declare type Options = {
  id: string;
  opacity?: number;
  minValue?: number;
  maxValue?: number;
  p?: number;
  framebufferFactor?: number;
  data: {
    lat: number;
    lon: number;
    val: number;
  }[];
  aoi?: {
    lat: number;
    lon: number;
  }[];
  valueToColor?: string;
};
declare class MapboxInterpolateHeatmapLayer implements CustomLayerInterface {
  framebufferFactor: number;
  id: string;
  maxValue: number;
  minValue: number;
  opacity: number;
  p: number;
  data: {
    lat: number;
    lon: number;
    val: number;
  }[];
  aoi?: {
    lat: number;
    lon: number;
  }[];
  textureCoverSameAreaAsROI: boolean;
  valueToColor?: string;
  valueToColor4?: string;
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
  constructor(options: Options);
  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void;
  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void;
  prerender(gl: WebGLRenderingContext, matrix: number[]): void;
  render(gl: WebGLRenderingContext, matrix: number[]): void;
}

export {
  MapboxInterpolateHeatmapLayer,
  MapboxInterpolateHeatmapLayer as default,
};
