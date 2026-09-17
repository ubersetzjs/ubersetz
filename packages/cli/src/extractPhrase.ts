import regexArray from './utils/regexArray'
import type { Phrase } from './types'

function skipWhitespace(content: string, index: number) {
  let currentIndex = index
  while (/\s/u.test(content[currentIndex] || '')) {
    currentIndex += 1
  }
  return currentIndex
}

function scanQuotedString(content: string, index: number, quote: string) {
  let currentIndex = index + 1

  while (currentIndex < content.length) {
    if (content[currentIndex] === '\\') {
      currentIndex += 2
      continue
    }

    if (content[currentIndex] === quote) {
      return currentIndex + 1
    }

    currentIndex += 1
  }

  return currentIndex
}

function scanTemplateLiteral(content: string, index: number) {
  let currentIndex = index + 1

  while (currentIndex < content.length) {
    const character = content[currentIndex]

    if (character === '\\') {
      currentIndex += 2
      continue
    }

    if (character === '`') {
      return currentIndex + 1
    }

    if (character === '$' && content[currentIndex + 1] === '{') {
      currentIndex = scanExpression(content, currentIndex + 2, '}').endIndex + 1
      continue
    }

    currentIndex += 1
  }

  return currentIndex
}

function scanExpression(content: string, index: number, stopCharacter?: string) {
  let currentIndex = index

  while (currentIndex < content.length) {
    const character = content[currentIndex]

    if (character === stopCharacter) {
      return {
        raw: content.slice(index, currentIndex),
        endIndex: currentIndex,
      }
    }

    if (character === ',' && !stopCharacter) {
      return {
        raw: content.slice(index, currentIndex),
        endIndex: currentIndex,
      }
    }

    if (character === ')' && !stopCharacter) {
      return {
        raw: content.slice(index, currentIndex),
        endIndex: currentIndex,
      }
    }

    if (character === '\'' || character === '"') {
      currentIndex = scanQuotedString(content, currentIndex, character)
      continue
    }

    if (character === '`') {
      currentIndex = scanTemplateLiteral(content, currentIndex)
      continue
    }

    if (character === '{') {
      currentIndex = scanExpression(content, currentIndex + 1, '}').endIndex + 1
      continue
    }

    if (character === '[') {
      currentIndex = scanExpression(content, currentIndex + 1, ']').endIndex + 1
      continue
    }

    if (character === '(') {
      currentIndex = scanExpression(content, currentIndex + 1, ')').endIndex + 1
      continue
    }

    currentIndex += 1
  }

  return {
    raw: content.slice(index, currentIndex),
    endIndex: currentIndex,
  }
}

function getTemplateLiteralValue(expression: string) {
  const startIndex = expression.indexOf('`')
  if (startIndex === -1) {
    return
  }

  const endIndex = scanTemplateLiteral(expression, startIndex) - 1
  const value = expression.slice(startIndex + 1, endIndex)

  if (value.includes('${')) {
    throw new Error(
      `template literal with variable interpolation is not allowed as a phrase value: ${expression.trim()}\n`
      + 'Variables must be passed directly to the translation function — not via template literals.\n'
      + '  ✗  u(\'key\', `Hello ${name}`)\n'
      + '  ✓  u(\'key\', { name }, \'Hello {name}\')',
    )
  }

  return value
}

function getStringValue(expression: string) {
  const trimmedExpression = expression.trim()
  if (!trimmedExpression) {
    return
  }

  const quote = trimmedExpression[0]
  if (quote === '\'' || quote === '"') {
    return trimmedExpression.slice(1, Math.max(1, trimmedExpression.length - 1))
  }

  if (quote === '`') {
    return getTemplateLiteralValue(trimmedExpression)
  }

  if (/^[\p{L}$_][\p{L}\p{N}$_.]*`/u.test(trimmedExpression)) {
    return getTemplateLiteralValue(trimmedExpression)
  }

  return
}

function getDefaultValue(content: string, index: number) {
  const firstArgumentStart = skipWhitespace(content, index)
  const firstArgument = scanExpression(content, firstArgumentStart)
  const firstArgumentValue = getStringValue(firstArgument.raw)

  const nextCharacter = content[firstArgument.endIndex]
  if (nextCharacter !== ',') {
    return firstArgumentValue
  }

  const secondArgumentStart = skipWhitespace(content, firstArgument.endIndex + 1)
  if (content[secondArgumentStart] === ')') {
    return firstArgumentValue
  }

  const secondArgument = scanExpression(content, secondArgumentStart)
  return getStringValue(secondArgument.raw)
}

export default function extractPhrases(content: string, pattern: RegExp) {
  const results = regexArray(pattern, content)
  return results.flatMap<Phrase>((match) => {
    const defaultValue = getDefaultValue(content, match.index + match[0].length)
    if (defaultValue == null) {
      return []
    }

    return [{
      key: match[2],
      defaultValue,
    }]
  })
}
