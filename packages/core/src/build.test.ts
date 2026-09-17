/// <reference types="node" />
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const currentWorkingDirectory = process.cwd()
const packageRoot = currentWorkingDirectory.endsWith(path.join('packages', 'core'))
  ? currentWorkingDirectory
  : path.join(currentWorkingDirectory, 'packages/core')
const repoRoot = path.resolve(packageRoot, '../..')
const distributionPath = path.join(packageRoot, 'dist/index.mjs')

describe('core build output', () => {
  it('does not depend on vite node polyfill shims', () => {
    execFileSync('npm', ['run', 'build', '-w', 'packages/core'], {
      cwd: repoRoot,
      stdio: 'pipe',
    })

    const output = readFileSync(distributionPath, 'utf8')

    expect(output).not.toContain('vite-plugin-node-polyfills/shims/global')
  })
})
