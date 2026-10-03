// Verify at the origin as well: alternate Worker hostnames must not bypass Access.
let keyCache;
const decode = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export async function authorizeOperator(request, env) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN || '')
      || !env.ACCESS_AUD || !env.OPERATOR_EMAIL) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || payload.iss !== issuer || !Number.isFinite(payload.exp)
        || payload.exp <= now || (payload.nbf && payload.nbf > now)
        || !Array.isArray(payload.aud) || !payload.aud.includes(env.ACCESS_AUD)
        || typeof payload.email !== 'string'
        || payload.email.toLowerCase() !== env.OPERATOR_EMAIL.toLowerCase()) return false;
    if (!keyCache || keyCache.issuer !== issuer || keyCache.expires < now
        || !keyCache.keys.some(k => k.kid === header.kid)) {
      const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
      if (!response.ok) return false;
      keyCache = { issuer, expires: now + 300, keys: (await response.json()).keys };
    }
    const jwk = keyCache.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { return false; }
}
