import regexArray from './regexArray'

export default function preserveVariables(source: string, target: string) {
  const variables = regexArray(/{(.*?)}/g, source)
  let counter = 0
  return target.replace(/{(.*?)}/g, () => {
    const variable = variables[counter]
    counter += 1
    return variable[0]
  })
}
