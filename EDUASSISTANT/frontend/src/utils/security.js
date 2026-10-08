const DATA_IMAGE_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;

/**
 * Only allow web URLs (and, where explicitly requested, QR image data URLs).
 * Never pass user/API supplied strings directly into href, src, or window.open.
 */
export const safeUrl = (value, { allowDataImage = false, fallback = '' } = {}) => {
  if (typeof value !== 'string' || !value.trim()) return fallback;

  const candidate = value.trim();
  if (allowDataImage && DATA_IMAGE_PATTERN.test(candidate)) return candidate;

  try {
    const parsed = new URL(candidate, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : fallback;
  } catch {
    return fallback;
  }
};

export const safeImageUrl = (value, fallback = '') => safeUrl(value, { fallback });

export const safeQrImageUrl = (value, fallback = '') => (
  safeUrl(value, { allowDataImage: true, fallback })
);

export const openSafeWindow = (value) => {
  const url = safeUrl(value);
  if (!url) return null;

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (popup) popup.opener = null;
  return popup;
};
