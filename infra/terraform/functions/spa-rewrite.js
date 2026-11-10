// CloudFront Function (cloudfront-js-2.0), viewer-request, default (S3) behavior only.
// SPA fallback: client-side routes (last path segment without a file extension)
// are served by /index.html. Real assets keep their URI, so a missing asset is
// still an error. Never attached to /api/*: API status codes reach clients intact.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var last = uri.substring(uri.lastIndexOf('/') + 1);
  if (uri.indexOf('/api/') === 0) return request;
  if (last.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}
