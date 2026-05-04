const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const CHROME_VERSION = '131'

const baseHeaders: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'sec-ch-ua': `"Google Chrome";v="${CHROME_VERSION}", "Chromium";v="${CHROME_VERSION}", "Not_A Brand";v="24"`,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Upgrade-Insecure-Requests': '1',
}

export interface BrowserHeadersOptions {
  accept?: string
  referer?: string
  fetchMode?: 'navigate' | 'cors' | 'no-cors' | 'same-origin' | 'websocket'
  fetchDest?: 'document' | 'script' | 'image' | 'style' | 'font' | 'object' | 'embed' | 'audio' | 'video' | 'track' | 'worker' | 'manifest' | 'empty'
  fetchSite?: 'none' | 'same-origin' | 'same-site' | 'cross-site'
  origin?: string
  cacheControl?: string
  extraHeaders?: Record<string, string>
}

export function getBrowserHeaders(options: BrowserHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = { ...baseHeaders }

  if (options.accept) {
    headers['Accept'] = options.accept
  }

  if (options.referer) {
    headers['Referer'] = options.referer
  }

  if (options.origin) {
    headers['Origin'] = options.origin
  }

  if (options.cacheControl) {
    headers['Cache-Control'] = options.cacheControl
  }

  if (options.fetchMode) {
    headers['Sec-Fetch-Mode'] = options.fetchMode
  }

  if (options.fetchDest) {
    headers['Sec-Fetch-Dest'] = options.fetchDest
  }

  if (options.fetchSite) {
    headers['Sec-Fetch-Site'] = options.fetchSite
  }

  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders)
  }

  return headers
}

export function getNavigateHeaders(referer?: string): Record<string, string> {
  return getBrowserHeaders({
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    referer: referer || 'https://www.google.com/',
    fetchMode: 'navigate',
    fetchDest: 'document',
    fetchSite: 'cross-site',
    cacheControl: 'no-cache',
  })
}

export function getFetchHeaders(referer?: string): Record<string, string> {
  return getBrowserHeaders({
    accept: 'application/json, text/plain, */*',
    referer: referer || 'https://github.com/',
    fetchMode: 'cors',
    fetchDest: 'empty',
    fetchSite: 'cross-site',
  })
}

export function getImageHeaders(referer: string): Record<string, string> {
  return getBrowserHeaders({
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    referer,
    fetchMode: 'no-cors',
    fetchDest: 'image',
    fetchSite: 'cross-site',
  })
}

export const USER_AGENT = BROWSER_UA
