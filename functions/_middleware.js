export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();
  
  // Only intercept actual HTTP errors from the server
  if (response.status >= 400) {
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  return response;
}
