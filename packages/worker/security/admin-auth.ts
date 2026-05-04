import type { AdminJWTPayload, AdminRole } from '../shared/types'

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function textEncode(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

function textDecode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

async function importKey(secret: string): Promise<CryptoKey> {
  const keyData = textEncode(secret)
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 100000
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  
  const hash = new Uint8Array(derivedBits)
  const saltBase64 = btoa(String.fromCharCode(...salt))
  const hashBase64 = btoa(String.fromCharCode(...hash))
  
  return `PBKDF2$${iterations}$${saltBase64}$${hashBase64}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$')
    if (parts.length !== 4 || parts[0] !== 'PBKDF2') return false
    
    const iterations = parseInt(parts[1], 10)
    const salt = base64UrlDecode(parts[2])
    const storedHashBytes = base64UrlDecode(parts[3])
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      textEncode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )
    
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    )
    
    const computedHash = new Uint8Array(derivedBits)
    
    if (computedHash.length !== storedHashBytes.length) return false
    
    let result = 0
    for (let i = 0; i < computedHash.length; i++) {
      result |= computedHash[i] ^ storedHashBytes[i]
    }
    return result === 0
  } catch {
    return false
  }
}

export async function createAdminToken(
  admin: { id: number; username: string; role: AdminRole },
  secret: string,
  expiresIn?: string
): Promise<string> {
  const key = await importKey(secret)
  const now = Math.floor(Date.now() / 1000)
  const expiresInSeconds = parseExpiresIn(expiresIn || '24h')
  
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: AdminJWTPayload = {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    iat: now,
    exp: now + expiresInSeconds,
  }
  
  const headerEncoded = base64UrlEncode(textEncode(JSON.stringify(header)))
  const payloadEncoded = base64UrlEncode(textEncode(JSON.stringify(payload)))
  
  const data = `${headerEncoded}.${payloadEncoded}`
  const signature = await crypto.subtle.sign('HMAC', key, textEncode(data))
  const signatureEncoded = base64UrlEncode(signature)
  
  return `${data}.${signatureEncoded}`
}

export async function verifyAdminToken(
  token: string,
  secret: string
): Promise<AdminJWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [headerEncoded, payloadEncoded, signatureEncoded] = parts
    
    const key = await importKey(secret)
    const signature = base64UrlDecode(signatureEncoded)
    
    const data = `${headerEncoded}.${payloadEncoded}`
    const valid = await crypto.subtle.verify('HMAC', key, signature, textEncode(data))
    
    if (!valid) return null
    
    const payloadBytes = base64UrlDecode(payloadEncoded)
    const payload = JSON.parse(textDecode(payloadBytes)) as AdminJWTPayload
    
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return null
    
    return payload
  } catch {
    return null
  }
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/)
  if (!match) return 24 * 60 * 60
  
  const value = parseInt(match[1], 10)
  const unit = match[2]
  
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return 24 * 60 * 60
  }
}
