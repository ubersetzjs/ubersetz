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
      fileName: () => 'index.js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !path.isAbsolute(id),
      output: {
        banner: '#!/usr/bin/env node',
      },
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
