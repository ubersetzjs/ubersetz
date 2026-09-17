import readline from 'readline'

export function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export function promptYesNoAll(question: string): Promise<'yes' | 'no' | 'all'> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      const lower = answer.toLowerCase()
      if (lower === 'a' || lower === 'all') resolve('all')
      else if (lower === 'y' || lower === 'yes') resolve('yes')
      else resolve('no')
    })
  })
}
