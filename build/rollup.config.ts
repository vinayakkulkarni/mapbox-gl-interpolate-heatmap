import alias from '@rollup/plugin-alias';
import { babel } from '@rollup/plugin-babel';
import beep from '@rollup/plugin-beep';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import sucrase from '@rollup/plugin-sucrase';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { terser } from 'rollup-plugin-terser';
import pkg from '../package.json';

const extensions = ['.js', '.ts', '.json'];

const plugins = [
  alias(),
  resolve({ extensions, browser: true }),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  commonjs({ extensions, exclude: 'src/**', include: 'node_modules' }),
  sucrase({
    exclude: ['node_modules/**'],
    transforms: ['typescript'],
  }),
  beep(),
  esbuild(),
];

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
  bundle({
    plugins,
    output: [
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
        file: pkg.module,
        name: pkg.name,
        format: 'es',
        sourcemap: true,
        exports: 'named',
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
  bundle({
    plugins: [
      ...plugins,
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
      banner,
      sourcemap: true,
      globals: {
        earcut: 'earcut',
        'mapbox-gl': 'mapboxgl',
      },
    },
  }),
  bundle({
    plugins: [dts()],
    output: {
      file: pkg.typings,
      format: 'es',
    },
  }),
];
