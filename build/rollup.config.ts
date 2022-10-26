import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { terser } from 'rollup-plugin-terser';
import pkg from '../package.json';

const bundle = (config) => ({
  input: 'src/index.ts',
  ...config,
  external: ['mapbox-gl', 'earcut'],
});

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * (c) 2021 ${pkg.author.name}<${pkg.author.email}>
 * Released under the ${pkg.license} License
 */
`;

export default [
  // Generate ES, CJS & UMD bundles
  bundle({
    plugins: [esbuild()],
    output: [
      {
        file: pkg.module,
        name: pkg.name,
        format: 'es',
        sourcemap: true,
        exports: 'named',
        banner,
      },
      {
        file: pkg.unpkg,
        name: pkg.name,
        exports: 'named',
        format: 'cjs',
        strict: true,
        sourcemap: true,
        banner,
      },
      {
        format: 'umd',
        file: pkg.umd,
        name: pkg.name,
        exports: 'named',
        sourcemap: true,
        banner,
        globals: {
          earcut: 'earcut',
          'mapbox-gl': 'mapboxgl',
        },
      },
    ],
  }),
  // Generate minified bundle
  bundle({
    plugins: [
      esbuild(),
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      }),
    ],
    output: {
      format: 'umd',
      file: pkg.cdn,
      name: pkg.name,
      exports: 'named',
      sourcemap: true,
      banner,
      globals: {
        earcut: 'earcut',
        'mapbox-gl': 'mapboxgl',
      },
    },
  }),
  // Generate `.d.ts` file(s)
  bundle({
    plugins: [dts()],
    output: {
      format: 'es',
      file: pkg.typings,
      name: pkg.name,
      exports: 'named',
      banner,
    },
  }),
];
