exports.main = async (event, context) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      message: 'Hello from CloudRun!',
      timestamp: new Date().toISOString(),
      method: event.httpMethod || 'UNKNOWN',
      path: event.path || '/'
    })
  };
};
