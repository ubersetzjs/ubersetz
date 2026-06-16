/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import { typescriptPaths } from 'rollup-plugin-typescript-paths'
import dts from 'vite-plugin-dts'

const indexEntry = path.resolve(__dirname, 'src/index.ts')
const jsonWorkerEntry = path.resolve(__dirname, 'src/utils/JsonWorker.ts')

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
      entry: {
        index: indexEntry,
        JsonWorker: jsonWorkerEntry,
      },
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['cjs'],
    },
    rollupOptions: {
      external: id => !id.startsWith('.') && !path.isAbsolute(id),
      output: {
        banner: chunk => (chunk.name === 'index' ? '#!/usr/bin/env node' : ''),
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
