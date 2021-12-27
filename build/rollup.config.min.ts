import alias from '@rollup/plugin-alias';
import { babel } from '@rollup/plugin-babel';
import beep from '@rollup/plugin-beep';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import sucrase from '@rollup/plugin-sucrase';
import { terser } from 'rollup-plugin-terser';
import pkg from '../package.json';

const plugins = [
  alias(),
  resolve({
    extensions: ['.js', '.ts'],
    browser: true,
  }),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  commonjs({
    extensions: ['.js', '.ts'],
    exclude: 'src/**',
    include: 'node_modules/**',
  }),
  sucrase({
    exclude: ['node_modules/**'],
    transforms: ['typescript'],
  }),
  beep(),
  terser({
    compress: {
      drop_console: true,
      drop_debugger: true,
    },
  }),
];

const banner = `/*!
  * ${pkg.name} v${pkg.version}
  * (c) ${new Date().getFullYear()} ${pkg.author.name}
  * @license ${pkg.license}
  */`;

export default {
  input: 'src/index.ts',
  output: [
    {
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
  ],
  plugins,
  external: ['mapbox-gl', 'earcut'],
};
