
export const defaultConfig = {
  language: 'en' as Language
}

export type Config = typeof defaultConfig

export function getConfig(querystring: string): Config {

  let params = new URLSearchParams(querystring)

  return {
    language: parseLanguage(params.get('lang'))
  }
}

export type Language = 'en' | 'es'

export function parseLanguage(s: string | null): Language {
  switch (s) {
    case 'en':
    case 'es':
      return s
    default:
      return 'en'
  }
}
