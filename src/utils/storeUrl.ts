export function sanitizeStoreSlug(slug: string): string {
  const cleaned = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return cleaned || 'ma-boutique';
}

export function getShareableStoreUrl(slug: string): string {
  const cleanSlug = sanitizeStoreSlug(slug);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/?shop=${encodeURIComponent(cleanSlug)}`;
  }
  return `https://boutikpro.bj/?shop=${encodeURIComponent(cleanSlug)}`;
}

export function getShareableStoreDisplay(slug: string): string {
  const cleanSlug = sanitizeStoreSlug(slug);
  if (typeof window !== 'undefined' && window.location?.host) {
    return `${window.location.host}/?shop=${cleanSlug}`;
  }
  return `boutikpro.bj/?shop=${cleanSlug}`;
}

export function getShopSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('shop');
  if (!raw || !raw.trim()) return null;
  return sanitizeStoreSlug(raw);
}
