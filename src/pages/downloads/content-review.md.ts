import { getBuildContentReviewPack } from '../../lib/content-review-build';
import { serializeContentReviewMarkdown } from '../../lib/content-review-pack';

export const prerender = true;
export function GET(): Response {
  return new Response(serializeContentReviewMarkdown(getBuildContentReviewPack()), { headers: {
    'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="simulearn-content-review.md"',
    'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff',
  } });
}
