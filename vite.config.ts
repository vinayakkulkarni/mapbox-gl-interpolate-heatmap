import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json';

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * (c) 2021 ${pkg.author.name}<${pkg.author.email}>
 * Released under the ${pkg.license} License
 */
`;

export default defineConfig({
  build: {
    target: 'esnext',
    sourcemap: true,
    reportCompressedSize: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MapboxGlInterpolateHeatmap',
      formats: ['es', 'cjs', 'umd'],
      fileName: pkg.name,
    },
    commonjsOptions: {
      extensions: ['.js', '.ts'],
      strictRequires: true,
      exclude: 'src/**',
      include: 'node_modules/**',
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['mapbox-gl', 'earcut'],
      output: {
        banner,
        exports: 'named',
        strict: true,
        sourcemap: true,
        extend: true,
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          earcut: 'earcut',
          'mapbox-gl': 'mapboxgl',
        },
      },
    },
  },
  plugins: [
    dts({
      outputDir: ['dist'],
    }),
  ],
});
