/**
 * ============================================================
 * UTILIDADES DE RED Y RESOLUCIÓN DE IDENTIDAD FORENSE
 * ============================================================
 * Extrae de forma confiable la IP pública real del cliente detrás de proxies
 * y CDNs (Cloudflare, Render, AWS ALBs, Nginx).
 * Evita registrar IPs internas de la red privada (10.x.x.x, 172.x.x.x, 127.x.x.x).
 */
export const getClientIp = (req) => {
  if (!req) return null;

  // 1. Cloudflare CDN (presente en el edge de Render)
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (cfIp) return cfIp.trim();

  // 2. Real-IP explícito
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) return realIp.trim();

  // 3. Cadena X-Forwarded-For: el primer elemento es siempre la IP original del cliente
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // 4. req.ip resuelto por Express o socket remoto
  return req.ip || req.socket?.remoteAddress || null;
};
