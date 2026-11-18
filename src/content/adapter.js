/**
 * Content adapter. Today it returns the local JSON; later swap the body for a
 * Strapi request, e.g.
 *
 *   const res = await fetch(`${STRAPI_URL}/api/homepage?populate=deep`, {
 *     headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
 *   });
 *   return (await res.json()).data;
 *
 * The 3D layer only ever reads the object returned here.
 */
import home from './home.json';

export async function getHomeContent() {
  return home.data;
}

/** Resolves a Strapi media URL (relative uploads need the API origin prefixed). */
export function mediaUrl(media, origin = '') {
  if (!media?.url) return '';
  return media.url.startsWith('http') ? media.url : origin + media.url;
}
