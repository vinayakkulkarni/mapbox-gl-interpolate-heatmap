import mapboxgl from 'mapbox-gl';
// @ts-ignore
import { MapboxInterpolateHeatmapLayer } from 'mapbox-gl-interpolate-heatmap';
import './style.css';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-74.5, 40],
  touchPitch: false,
  pitchWithRotate: false,
  zoom: 9,
});

map.on('load', () => {
  const layer = new MapboxInterpolateHeatmapLayer({
    id: 'temperature',
    opacity: 0.3,
    data: [
      {
        lat: 62.470663,
        lon: 6.176846,
        val: 16,
      },
      {
        lat: 48.094903,
        lon: -1.371596,
        val: 20,
      },
    ],
  });
  map.addLayer(layer);
});
