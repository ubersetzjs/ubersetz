import { describe, it, expect } from 'vitest'
import preserveVariables from './preserveVariables'

describe('preserveVariables', () => {
  it('preserve nothing', () => {
    const text = preserveVariables('a', 'a')
    expect(text).toBe('a')
  })

  it('preserve single variable', () => {
    const text = preserveVariables('aa {name}', 'sdg {asdf} a')
    expect(text).toBe('sdg {name} a')
  })

  it('preserve multiple variables', () => {
    const text = preserveVariables('aa {name} bb {value}', 'sdg {asdf} a {fdsa}')
    expect(text).toBe('sdg {name} a {value}')
  })
})
