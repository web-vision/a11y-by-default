import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
export default {
    input: 'Build/TypeScript/src/A11yModule.ts',
    output: {
        file: 'Resources/Public/JavaScript/a11y-module.js',
        format: 'es',
        sourcemap: true,
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({ tsconfig: './tsconfig.json' }),
    ],
};
