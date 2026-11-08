// Only immutable, same-origin asset identifiers are accepted alongside uploaded images.
const assetPattern = /^\/api\/media\/([a-f0-9]{64})\.(jpg|png|webp)$/;
export const isMediaURL = (value) => typeof value === 'string' && assetPattern.test(value);
export const isImageSource = (value) =>
  typeof value === 'string' && (value.startsWith('data:image/') || isMediaURL(value));
export function mediaURL(ref) {
  return '/api/media/' + ref.path.split('/').at(-1);
}
export function mediaPath(value) {
  if (!isMediaURL(value)) return null;
  return 'portal-v6/media/' + value.slice('/api/media/'.length);
}
