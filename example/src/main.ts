import mapboxgl from 'mapbox-gl';
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
  const options = {
    id: 'temperature',
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
  } as MapboxInterpolateHeatmapLayer;
  const layer = new MapboxInterpolateHeatmapLayer(options);
  map.addLayer(layer);
});
