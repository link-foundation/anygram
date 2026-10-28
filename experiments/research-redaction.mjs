// Preserve report evidence while excluding credentials pasted into public threads.
export function sanitizeResearch(value) {
  if (typeof value === 'string') {
    return value
      .replace(
        /https:\/\/github\.com\/notifications\/unsubscribe-auth\/[^\s)>"<]+/g,
        '[redacted subscription link]'
      )
      .replace(/\b\d{6,15}:[A-Za-z0-9_-]{30,}\b/g, '[redacted bot token]');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeResearch);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeResearch(item)])
    );
  }
  return value;
}
