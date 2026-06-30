import { parse } from '@messageformat/parser'

interface ContentToken {
  type: 'content',
  value: string,
}

interface ArgumentToken {
  type: 'argument',
  arg: string,
}

interface OctothorpeToken {
  type: 'octothorpe',
}

interface FunctionToken {
  type: 'function',
  arg: string,
  key: string,
  param?: MessageToken[],
}

interface SelectCase {
  key: string,
  tokens: MessageToken[],
}

interface SelectToken {
  type: 'plural' | 'select' | 'selectordinal',
  arg: string,
  cases: SelectCase[],
  pluralOffset?: number,
}

type MessageToken = ContentToken | ArgumentToken | FunctionToken | SelectToken | OctothorpeToken
type RootMessageToken = Exclude<MessageToken, OctothorpeToken>
type TranslateText = (text: string) => Promise<string>

function renderFunctionToken(token: FunctionToken): string {
  const parameters = token.param == null ? '' : `,${renderStaticTokens(token.param)}`
  return `{${token.arg}, ${token.key}${parameters}}`
}

function renderSelectTokenPrefix(token: SelectToken): string {
  const offset = token.type === 'plural' && token.pluralOffset != null
    ? ` offset:${token.pluralOffset}`
    : ''
  return `{${token.arg}, ${token.type},${offset}`
}

function renderStaticTokens(tokens: readonly MessageToken[]): string {
  return tokens.map((token): string => {
    switch (token.type) {
      case 'argument': {
        return `{${token.arg}}`
      }
      case 'content': {
        return token.value
      }
      case 'function': {
        return renderFunctionToken(token)
      }
      case 'octothorpe': {
        return '#'
      }
      case 'plural':
      case 'select':
      case 'selectordinal': {
        const cases = token.cases
          .map((item): string => ` ${item.key} {${renderStaticTokens(item.tokens)}}`)
          .join('')
        return `${renderSelectTokenPrefix(token)}${cases}}`
      }
      default: {
        return ''
      }
    }
  }).join('')
}

async function flushBuffer(buffer: string, translateText: TranslateText): Promise<string> {
  if (!buffer) {
    return ''
  }

  return translateText(buffer)
}

async function renderTokens(
  tokens: readonly RootMessageToken[],
  translateText: TranslateText,
): Promise<string> {
  let result = ''
  let buffer = ''

  for (const token of tokens) {
    switch (token.type) {
      case 'argument': {
        buffer += `{${token.arg}}`
        break
      }
      case 'content': {
        buffer += token.value
        break
      }
      case 'function': {
        buffer += renderFunctionToken(token)
        break
      }
      case 'plural':
      case 'select':
      case 'selectordinal': {
        result += await flushBuffer(buffer, translateText)
        buffer = ''
        result += await renderSelectToken(token, translateText)
        break
      }
      default: {
        break
      }
    }
  }

  result += await flushBuffer(buffer, translateText)
  return result
}

async function renderCase(item: SelectCase, translateText: TranslateText): Promise<string> {
  const value = await renderNestedTokens(item.tokens, translateText)
  return ` ${item.key} {${value}}`
}

async function renderNestedTokens(
  tokens: readonly MessageToken[],
  translateText: TranslateText,
): Promise<string> {
  let result = ''
  let buffer = ''

  for (const token of tokens) {
    switch (token.type) {
      case 'argument': {
        buffer += `{${token.arg}}`
        break
      }
      case 'content': {
        buffer += token.value
        break
      }
      case 'function': {
        buffer += renderFunctionToken(token)
        break
      }
      case 'octothorpe': {
        buffer += '#'
        break
      }
      case 'plural':
      case 'select':
      case 'selectordinal': {
        result += await flushBuffer(buffer, translateText)
        buffer = ''
        result += await renderSelectToken(token, translateText)
        break
      }
      default: {
        break
      }
    }
  }

  result += await flushBuffer(buffer, translateText)
  return result
}

async function renderSelectToken(
  token: SelectToken,
  translateText: TranslateText,
): Promise<string> {
  const cases = await Promise.all(
    token.cases.map((item): Promise<string> => renderCase(item, translateText)),
  )
  return `${renderSelectTokenPrefix(token)}${cases.join('')}}`
}

export default async function translateMessageFormat(
  value: string,
  translateText: TranslateText,
): Promise<string> {
  try {
    return await renderTokens(
      parse(value),
      translateText,
    )
  } catch {
    return translateText(value)
  }
}
