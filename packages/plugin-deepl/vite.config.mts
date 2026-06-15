/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import { typescriptPaths } from 'rollup-plugin-typescript-paths'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    dts(),
  ],
  build: {
    manifest: true,
    minify: true,
    sourcemap: true,
    reportCompressedSize: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: format => (format === 'es' ? 'index.mjs' : `index.${format}.js`),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        '@ubersetz/cli',
        'deapl',
        'deepl-node',
        'p-queue',
        'p-retry',
      ],
      plugins: [
        typescriptPaths({
          preserveExtensions: true,
        }),
        typescript({
          declaration: true,
          outDir: 'dist',
        }),
      ],
    },
  },
})
