// Bounded Public Website Fetcher with SSRF Protection and Sanitization
// Enforces time and size limits, validates public destinations, extracts excerpts,
// treats fetched text as untrusted source material, and supports manual description fallback.

export interface ScrapedSiteResult {
  success: boolean;
  url: string;
  finalUrl?: string;
  pageTitle?: string;
  metaDescription?: string;
  h1Text?: string;
  cleanExcerpt: string;
  byteCount: number;
  fetchTimeMs: number;
  error?: string;
}

// Check against private IP addresses and loopback destinations (SSRF defense)
export function isSafePublicUrl(rawUrl: string): { isSafe: boolean; reason?: string } {
  try {
    let parsed: URL;
    if (!/^https?:\/\//i.test(rawUrl)) {
      parsed = new URL(`https://${rawUrl}`);
    } else {
      parsed = new URL(rawUrl);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isSafe: false, reason: 'Only HTTP and HTTPS protocols are permitted.' };
    }

    const host = parsed.hostname.toLowerCase();

    // Loopback / localhost checks
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return { isSafe: false, reason: 'Access to loopback/local hostnames is prohibited.' };
    }

    // Cloud metadata endpoints
    if (host === '169.254.169.254' || host === 'metadata.google.internal') {
      return { isSafe: false, reason: 'Access to internal metadata services is prohibited.' };
    }

    // IPv4 private ranges (RFC 1918 & RFC 3927)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = host.match(ipv4Regex);
    if (match) {
      const octet1 = parseInt(match[1], 10);
      const octet2 = parseInt(match[2], 10);

      // 10.0.0.0/8
      if (octet1 === 10) return { isSafe: false, reason: 'Private IP space (10.0.0.0/8) is disallowed.' };
      // 172.16.0.0/12
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
        return { isSafe: false, reason: 'Private IP space (172.16.0.0/12) is disallowed.' };
      }
      // 192.168.0.0/16
      if (octet1 === 192 && octet2 === 168) {
        return { isSafe: false, reason: 'Private IP space (192.168.0.0/16) is disallowed.' };
      }
      // 169.254.0.0/16 (link local)
      if (octet1 === 169 && octet2 === 254) {
        return { isSafe: false, reason: 'Link-local IP space is disallowed.' };
      }
      // 0.0.0.0/8
      if (octet1 === 0) return { isSafe: false, reason: 'Invalid destination.' };
    }

    return { isSafe: true };
  } catch (err: any) {
    return { isSafe: false, reason: `Invalid URL format: ${err.message}` };
  }
}

// Cleans untrusted HTML by removing scripts, styles, iframes and extracts clean readable text
export function sanitizeAndExtractText(html: string): {
  pageTitle: string;
  metaDescription: string;
  h1Text: string;
  cleanText: string;
} {
  // Strip script, style, svg, iframe, noscript blocks
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

  // Extract title
  const titleMatch = withoutScripts.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const metaDescMatch =
    withoutScripts.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    withoutScripts.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

  // Extract first H1
  const h1Match = withoutScripts.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';

  // Strip remaining tags
  let plain = withoutScripts.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  plain = plain
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse whitespaces
  plain = plain.replace(/\s+/g, ' ').trim();

  // Limit excerpt to ~4000 characters (~800 words) for concise prompt context
  const cleanText = plain.slice(0, 4000);

  return { pageTitle, metaDescription, h1Text, cleanText };
}

// Bounded multi-tier fetch function:
// 1. Local / Vercel Serverless proxy (/api/scrape?url=...)
// 2. Direct browser fetch (for CORS-permissive origins)
// 3. Jina Reader AI scraper (https://r.jina.ai/<targetUrl>)
export async function boundedFetchPublicWebsite(
  rawUrl: string,
  timeoutMs = 8000,
  maxSizeBytes = 250000
): Promise<ScrapedSiteResult> {
  const startTime = Date.now();
  const safeCheck = isSafePublicUrl(rawUrl);
  if (!safeCheck.isSafe) {
    return {
      success: false,
      url: rawUrl,
      cleanExcerpt: '',
      byteCount: 0,
      fetchTimeMs: Date.now() - startTime,
      error: safeCheck.reason || 'URL violates safety policies.',
    };
  }

  const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  // Strategy 1: Local / Vercel Serverless Scrape Endpoint (/api/scrape?url=...)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const scrapeEndpoint = `/api/scrape?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(scrapeEndpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 100) {
        const { pageTitle, metaDescription, h1Text, cleanText } = sanitizeAndExtractText(html.slice(0, maxSizeBytes));
        if (cleanText && cleanText.length > 50) {
          return {
            success: true,
            url: targetUrl,
            pageTitle,
            metaDescription,
            h1Text,
            cleanExcerpt: cleanText,
            byteCount: html.length,
            fetchTimeMs: Date.now() - startTime,
          };
        }
      }
    }
  } catch (_) {
    // Strategy 1 failed, fall through to Strategy 2
  }

  // Strategy 2: Direct browser fetch (for environments or origins supporting CORS)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      const { pageTitle, metaDescription, h1Text, cleanText } = sanitizeAndExtractText(text.slice(0, maxSizeBytes));
      if (cleanText && cleanText.length > 50) {
        return {
          success: true,
          url: targetUrl,
          finalUrl: response.url,
          pageTitle,
          metaDescription,
          h1Text,
          cleanExcerpt: cleanText,
          byteCount: text.length,
          fetchTimeMs: Date.now() - startTime,
        };
      }
    }
  } catch (_) {
    // Strategy 2 failed, fall through to Strategy 3
  }

  // Strategy 3: Jina Reader AI Scraper (https://r.jina.ai/<url>)
  // Extremely robust CORS-enabled scraper that renders client-side JS / Webflow sites
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const res = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 100) {
        const titleMatch = text.match(/^Title:\s*(.+)$/m);
        const pageTitle = titleMatch ? titleMatch[1].trim() : '';

        const cleanBody = text
          .replace(/^Title:.*$/m, '')
          .replace(/^URL Source:.*$/m, '')
          .replace(/^Markdown Content:/m, '')
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanBody.length > 50) {
          return {
            success: true,
            url: targetUrl,
            pageTitle,
            metaDescription: cleanBody.slice(0, 200),
            h1Text: pageTitle,
            cleanExcerpt: cleanBody.slice(0, 4000),
            byteCount: text.length,
            fetchTimeMs: Date.now() - startTime,
          };
        }
      }
    }
  } catch (_) {
    // All tiers exhausted
  }

  return {
    success: false,
    url: targetUrl,
    cleanExcerpt: '',
    byteCount: 0,
    fetchTimeMs: Date.now() - startTime,
    error: 'Could not automatically scrape public website. You may provide a company description directly.',
  };
}
