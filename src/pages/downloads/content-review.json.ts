import { getBuildContentReviewPack } from '../../lib/content-review-build';
import { serializeContentReviewJson } from '../../lib/content-review-pack';

export const prerender = true;
/** Build-time public sources only. The endpoint never reads or writes account records. */
export function GET(): Response {
  return new Response(serializeContentReviewJson(getBuildContentReviewPack()), { headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="simulearn-content-review.json"',
    'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff',
  } });
}
