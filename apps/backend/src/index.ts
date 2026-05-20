import 'dotenv/config';
import { buildServer } from './server.js';
import { parsePort } from './parsePort.js';

const port = parsePort(process.env['BACKEND_PORT'], 3001, 'BACKEND_PORT');
const app = await buildServer();

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
