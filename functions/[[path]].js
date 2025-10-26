export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();
  
  // Check if this is serving index.html for a non-root path (SPA 404)
  const contentType = response.headers.get('content-type') || '';
  const isServingHTML = contentType.includes('text/html');
  const isNotRoot = url.pathname !== '/';
  const hasNoFileExtension = !url.pathname.match(/\.[a-z0-9]+$/i);
  
  // If we're serving HTML for a path that looks like it should be a 404
  if (isServingHTML && isNotRoot && hasNoFileExtension) {
    // Treat this as a 404 and call error handler
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  // Handle actual HTTP errors
  if (response.status >= 400) {
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  return response;
}
