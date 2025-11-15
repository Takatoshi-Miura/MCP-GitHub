import { logger } from './logger.js';

export async function parseResponseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  try {
    return ct.includes('application/json') ? res.json() : res.text();
  } catch (error) {
    logger.error('Failed to parse response body', error);
    return res.text();
  }
}

export function createGitHubError(status: number, body: unknown): Error {
  const msg = typeof body === 'string' ? body : JSON.stringify(body);
  return new Error(`GitHub API error! Status: ${status}. Message: ${msg}`);
}

export function isTokenValid(token: string): boolean {
  return Boolean(token && token.startsWith('gh') && token.length > 10);
}

/**
 * GitHub APIのLinkヘッダーをパースしてページネーション情報を抽出
 * @param linkHeader - ResponseのLinkヘッダー値
 * @returns ページネーション情報オブジェクト
 */
export function parseLinkHeader(linkHeader: string | null): {
  next?: string;
  last?: string;
  first?: string;
  prev?: string;
} {
  if (!linkHeader) return {};

  const links: Record<string, string> = {};
  const parts = linkHeader.split(',');

  for (const part of parts) {
    const [urlPart, relPart] = part.split(';');
    if (!urlPart || !relPart) continue;

    const url = urlPart.trim().slice(1, -1); // '<url>' -> 'url'
    const relMatch = relPart.match(/rel="(.+)"/);
    if (relMatch && relMatch[1]) {
      links[relMatch[1]] = url;
    }
  }

  return links;
}
