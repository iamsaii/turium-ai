import * as cheerio from 'cheerio';
import { FETCH_TIMEOUT_MS } from '../config.js';
import { BadRequestError } from '../lib/errors.js';

/**
 * Checks whether a hostname resolves to a loopback, private, or metadata address.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }

  // IPv6 loopback / unique local / link-local / unspecified
  if (
    host === '::1' ||
    host === '::' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc00:') ||
    host.startsWith('fd00:')
  ) {
    return true;
  }

  // Check IPv4
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some((o) => o > 255)) {
      return true;
    }
    const [o0, o1] = octets;
    if (o0 === 0) return true; // 0.0.0.0/8
    if (o0 === 127) return true; // 127.0.0.0/8 loopback
    if (o0 === 10) return true; // 10.0.0.0/8 private
    if (o0 === 169 && o1 === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (o0 === 192 && o1 === 168) return true; // 192.168.0.0/16 private
    if (o0 === 172 && o1 >= 16 && o1 <= 31) return true; // 172.16.0.0/12 private
  }

  return false;
}

/**
 * Validates protocol and SSRF constraints on the given URL.
 */
export function validateUrlSafety(inputUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new BadRequestError(`Invalid URL provided: ${inputUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestError(`Unsupported URL protocol '${parsed.protocol}'. Only http and https are permitted.`);
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new BadRequestError(`Access to private or local hostnames (${parsed.hostname}) is prohibited.`);
  }

  return parsed;
}

/**
 * Fetches and parses readable text from a URL, stripping scripts and boilerplate.
 */
export async function extractUrlContent(url: string): Promise<{ title: string; bodyText: string }> {
  validateUrlSafety(url);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'KnowledgeInbox/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
  } catch (err: any) {
    if (err instanceof BadRequestError) {
      throw err;
    }
    throw new BadRequestError(`Failed to fetch URL: ${err.message}`);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new BadRequestError('Redirects are not permitted for security reasons');
  }

  if (!response.ok) {
    throw new BadRequestError(`HTTP error fetching URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, navigation, headers, footers
  $('script, style, nav, header, footer, noscript, iframe, svg, form').remove();

  const titleText = $('title').first().text().trim();
  const title = titleText || url;

  const rawBody = $('body').text() || $('html').text() || '';
  const bodyText = rawBody.replace(/\s+/g, ' ').trim();

  return { title, bodyText };
}
