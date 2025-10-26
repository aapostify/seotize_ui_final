export async function onRequest(context) {
  const response = await context.next();
  
  // Only handle actual HTTP error responses
  if (response.status >= 400) {
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  return response;
}
