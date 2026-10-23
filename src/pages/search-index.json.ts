import { publicSearchIndex } from '../data/search-index';

export const prerender = true;
/** Compiled public content only. No account, R2, AI or private record reads. */
export function GET(): Response {
  return Response.json({ entries: publicSearchIndex }, {
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  });
}
