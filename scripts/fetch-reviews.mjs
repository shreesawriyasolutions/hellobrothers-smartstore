// Fetches Google reviews for the business and writes google-reviews.json
// Needs env: GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID
import { writeFileSync } from 'node:fs';

const key = process.env.GOOGLE_PLACES_API_KEY;
const placeId = process.env.GOOGLE_PLACE_ID;
if (!key || !placeId) {
  console.error('Missing GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID');
  process.exit(1);
}

const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
const res = await fetch(url, {
  headers: {
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': 'displayName,rating,userRatingCount,googleMapsUri,reviews'
  }
});
if (!res.ok) {
  console.error('Places API error', res.status, await res.text());
  process.exit(1);
}
const p = await res.json();

const out = {
  updated: new Date().toISOString(),
  rating: p.rating ?? null,
  total: p.userRatingCount ?? null,
  mapsUrl: p.googleMapsUri ?? null,
  reviews: (p.reviews || [])
    .map(r => ({
      author: r.authorAttribution?.displayName || 'Google User',
      authorUrl: r.authorAttribution?.uri || null,
      rating: r.rating || 5,
      text: (r.originalText?.text || r.text?.text || '').trim(),
      when: r.relativePublishTimeDescription || ''
    }))
    .filter(r => r.text && r.rating >= 4)
};

writeFileSync('google-reviews.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Saved ${out.reviews.length} reviews (rating ${out.rating}, total ${out.total})`);
