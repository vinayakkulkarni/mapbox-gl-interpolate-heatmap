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

map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

map.on('load', async () => {
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
  map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
  map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
  const startingLatitude = -80;
  const startingLongitude = -180;
  const endingLatitude = 80;
  const endingLongitude = 180;
  const n = 10;
  const points = [];

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      points.push({
        lat: startingLatitude + (i * (endingLatitude - startingLatitude)) / n,
        lon:
          startingLongitude + (j * (endingLongitude - startingLongitude)) / n,
        val: 0,
      });
    }
  }

  const baseUrl =
    'https://api.openweathermap.org/data/2.5/weather?units=metric';
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  const urls = points.map(
    ({ lat, lon }) => `${baseUrl}&lat=${lat}&lon=${lon}&appid=${apiKey}`,
  );

  const weathers = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      return response.json();
    }),
  );

  points.forEach((point, index) => {
    point.val = weathers.at(index).main.temp;
  });

  const options = {
    id: 'temperature',
    data: points,
  };

  const layer = new MapboxInterpolateHeatmapLayer(options);

  map.addLayer(layer);
});
