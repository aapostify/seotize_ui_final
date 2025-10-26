export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();
  
  // Handle real HTTP errors
  if (response.status >= 400) {
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  return response;
}
