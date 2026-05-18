function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getAppOrigin() {
  const configuredOrigin = trimTrailingSlash(import.meta.env.VITE_APP_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return trimTrailingSlash(window.location.origin);
}

export function buildAppUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppOrigin()}${normalizedPath}`;
}
