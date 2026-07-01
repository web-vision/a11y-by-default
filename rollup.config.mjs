import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const plugins = [nodeResolve(), commonjs(), typescript({ tsconfig: './tsconfig.json' })];

// CodeViewer.ts loads these from TYPO3 backend's own importmap at runtime
// (see EXT:backend Configuration/JavaScriptModules.php) rather than bundling
// a copy of CodeMirror, so keep the bare imports untouched in the output.
const codeMirrorExternals = [/^@codemirror\//];

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: 'Build/TypeScript/src/A11yModule.ts',
    output: {
      file: 'Resources/Public/JavaScript/a11y-module.js',
      format: 'es',
      sourcemap: true,
    },
    external: codeMirrorExternals,
    plugins,
  },
  {
    input: 'Build/TypeScript/src/PageLayoutSummary.ts',
    output: {
      file: 'Resources/Public/JavaScript/page-layout-summary.js',
      format: 'es',
      sourcemap: true,
    },
    plugins,
  },
];
