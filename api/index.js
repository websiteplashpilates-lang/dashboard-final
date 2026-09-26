import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const requestHandler = require('../server.cjs');

export default async function handler(req, res) {
  return requestHandler(req, res);
}
