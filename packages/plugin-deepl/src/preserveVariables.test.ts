// eslint-disable-next-line import/no-extraneous-dependencies
import test from 'ava'
import preserveVariables from './preserveVariables'

test('preserve nothing', (t) => {
  const text = preserveVariables('a', 'a')
  t.is(text, 'a')
})

test('preserve single variable', (t) => {
  const text = preserveVariables('aa {name}', 'sdg {asdf} a')
  t.is(text, 'sdg {name} a')
})

test('preserve multiple variables', (t) => {
  const text = preserveVariables('aa {name} bb {value}', 'sdg {asdf} a {fdsa}')
  t.is(text, 'sdg {name} a {value}')
})
