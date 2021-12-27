import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';
import beep from '@rollup/plugin-beep';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import sucrase from '@rollup/plugin-sucrase';
import pkg from '../package.json';

const extensions = ['.js', '.ts'];

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
];

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * (c) 2021 ${pkg.author.name}<${pkg.author.email}>
 * Released under the ${pkg.license} License
 */
`;

export default {
  input: 'src/index.ts',
  output: [
    // ESM build to be used with webpack/rollup.
    {
      format: 'es',
      file: pkg.module,
      name: pkg.name,
      exports: 'named',
      sourcemap: true,
      banner,
    },
    // CommonJS build
    {
      format: 'cjs',
      file: pkg.unpkg,
      name: pkg.name,
      exports: 'named',
      strict: true,
      sourcemap: true,
      banner,
    },
    // UMD build.
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
  plugins,
  external: ['mapbox-gl', 'earcut'],
};
