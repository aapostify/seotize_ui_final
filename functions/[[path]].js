export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();
  
  // Handle actual HTTP errors (real 404s, 500s, etc.)
  if (response.status >= 400) {
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  // For HTML responses, check if it's a valid page or SPA fallback
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') && url.pathname !== '/') {
    // Clone and read the response
    const text = await response.text();
    
    // Check if your SPA has rendered or if it's just the shell
    // This assumes your valid pages will have specific content loaded
    // Adjust this check based on your app's structure
    const hasValidRoute = text.includes('id="root"') || text.includes('id="app"');
    
    // If the path looks random (long random string), treat as 404
    const looksRandom = url.pathname.length > 15 && 
                       url.pathname.match(/^\/[a-z]{10,}$/i);
    
    if (looksRandom) {
      return context.env.ERROR_HANDLER.fetch(context.request);
    }
    
    // Return the HTML response for valid routes
    return new Response(text, {
      status: response.status,
      headers: response.headers
    });
  }
  
  return response;
}
