import { promises as dns } from 'dns';
import net from 'net';

/**
 * Proteção anti-SSRF para webhooks de saída configurados pelo usuário.
 * Valida o destino antes de qualquer fetch: exige http/https e bloqueia hosts
 * que resolvem para faixas internas (loopback, link-local, privadas, metadados
 * de cloud em 169.254.169.254, etc.).
 *
 * Observação: há um pequeno gap de DNS-rebinding (validamos no momento da
 * checagem e o fetch resolve de novo). É uma defesa de baseline; um hardening
 * futuro conectaria diretamente ao IP validado.
 */

function ipv4ToLong(ip: string): number {
  return ip.split('.').reduce((acc, oct) => acc * 256 + parseInt(oct, 10), 0) >>> 0;
}

function inRange(ipLong: number, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ipLong & mask) >>> 0) === ((ipv4ToLong(range) & mask) >>> 0);
}

// Faixas IPv4 não-roteáveis / sensíveis.
const BLOCKED_V4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local + metadados de cloud
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reservado
];

function isPrivateIPv4(ip: string): boolean {
  const long = ipv4ToLong(ip);
  return BLOCKED_V4.some((cidr) => inRange(long, cidr));
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // remove zone id
  if (addr === '::1' || addr === '::') return true;
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // ULA fc00::/7
  if (/^fe[89ab]/.test(addr)) return true; // link-local fe80::/10
  return false;
}

function isPrivateIp(ip: string): boolean {
  return net.isIPv4(ip) ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

/**
 * Lança se a URL não for um destino HTTP(S) público. Retorna a URL parseada.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Protocolo não permitido: ${url.protocol}`);
  }

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Host não permitido (localhost)');
  }

  // IP literal: checa diretamente. Hostname: resolve todos os registros.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('IP de destino não permitido (rede interna)');
    return url;
  }

  const records = await dns.lookup(host, { all: true });
  if (records.length === 0) throw new Error('Host não resolvido');
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error('Host resolve para rede interna (bloqueado)');
  }
  return url;
}
