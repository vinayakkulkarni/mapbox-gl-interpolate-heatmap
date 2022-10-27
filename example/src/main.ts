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

map.on('load', async () => {
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
        lng:
          startingLongitude + (j * (endingLongitude - startingLongitude)) / n,
        val: 0,
      });
    }
  }

  const baseUrl =
    'https://api.openweathermap.org/data/2.5/weather?units=metric';
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  const urls = points.map(
    ({ lat, lng }) => `${baseUrl}&lat=${lat}&lon=${lng}&appid=${apiKey}`,
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
    data: points,
    id: 'temperature',
  } as unknown;

  const layer = new MapboxInterpolateHeatmapLayer(
    options as MapboxInterpolateHeatmapLayer,
  );

  map.addLayer(layer);
});
