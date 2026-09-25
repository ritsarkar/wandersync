export default async function handler(req, res) {
  const { default: app } = await import('../apps/wandersync/server/server.js');
  return app(req, res);
}
