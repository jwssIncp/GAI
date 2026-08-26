export function createIdempotencyKey() {
  return `web-${crypto.randomUUID()}`;
}
