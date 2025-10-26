export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  
  // Try to fetch the actual file
  const response = await context.next();
  
  // If file exists (200 status), return it
  if (response.status === 200) {
    return response;
  }
  
  // If file doesn't exist (404 or other error), show error image
  if (response.status >= 400) {
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  return response;
}
