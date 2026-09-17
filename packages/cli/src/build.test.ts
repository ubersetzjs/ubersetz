/// <reference types="node" />
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const currentWorkingDirectory = process.cwd()
const packageRoot = currentWorkingDirectory.endsWith(path.join('packages', 'cli'))
  ? currentWorkingDirectory
  : path.join(currentWorkingDirectory, 'packages/cli')
const repoRoot = path.resolve(packageRoot, '../..')
const workerPath = path.join(packageRoot, 'dist/JsonWorker.js')

describe('cli build output', () => {
  it('emits JsonWorker.js for the JSON worker thread', () => {
    execFileSync('npm', ['run', 'build', '-w', 'packages/cli'], {
      cwd: repoRoot,
      stdio: 'pipe',
    })

    expect(existsSync(workerPath)).toBe(true)
  })
})
