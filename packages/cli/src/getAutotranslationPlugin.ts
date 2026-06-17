import Module from 'module'
import path from 'path'
import type { AutotranslationOptions, AutotranslationFunction } from './types'

const requireModule = (package_: string): AutotranslationFunction => {
  const relativeToPath = path.join(process.cwd(), '__placeholder__.js')
  const require = Module.createRequire(relativeToPath)
  const modulePath = require.resolve(package_)
  const loaded = require(modulePath)
  return loaded?.__esModule === true ? loaded.default : loaded
}

export default async function getAutotranslationPlugin(
  autotranslationOptions: AutotranslationOptions,
) {
  if (!autotranslationOptions.plugin) throw new Error('autotranslation plugin is undefined')
  try {
    return requireModule(`ubersetz-plugin-${autotranslationOptions.plugin}`)
  } catch {
    throw new Error(`Cannot find autotranslation plugin '${autotranslationOptions.plugin}'`)
  }
}
