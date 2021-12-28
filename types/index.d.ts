export type Options = {
  id: string;
  opacity?: number;
  minValue?: number;
  maxValue?: number;
  p?: number;
  framebufferFactor?: number;
  data: { lat: number; lon: number; val: number }[];
  aoi?: { lat: number; lon: number }[];
  valueToColor?: string;
};
