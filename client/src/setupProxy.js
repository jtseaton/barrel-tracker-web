const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:10000',
      changeOrigin: true,
      logLevel: 'debug',
    })
  );
};