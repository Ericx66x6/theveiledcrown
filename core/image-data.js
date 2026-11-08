import { isMediaURL } from './media-reference.js';
export function imageData(value, max = 2000000) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (value &&
      !isMediaURL(value) &&
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value))
  ) {
    const error = new Error('Use uma imagem PNG, JPG ou WebP local válida.');
    error.status = 400;
    throw error;
  }
  return value;
}
