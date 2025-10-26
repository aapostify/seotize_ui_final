export async function onRequest(context) {
  const response = await context.next();
  
  // Only intercept error responses
  if (response.status >= 400) {
    // Call your error-handler Worker
    return context.env.ERROR_HANDLER.fetch(context.request);
  }
  
  return response;
}
