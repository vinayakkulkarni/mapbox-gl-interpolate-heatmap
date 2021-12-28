export type Options = {
  id: string;
  opacity?: number;
  minValue?: number;
  maxValue?: number;
  p?: number;
  framebufferFactor?: number;
  points: { lat: number; lon: number; val: number }[];
  roi?: { lat: number; lon: number }[];
  valueToColor?: string;
};
