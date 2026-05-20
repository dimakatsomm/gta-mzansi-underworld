import 'dotenv/config';
import { buildServer } from './server.js';
import { parsePort } from './parsePort.js';

const port = parsePort(process.env['AI_ORCHESTRATOR_PORT'], 3002, 'AI_ORCHESTRATOR_PORT');
const app = await buildServer();

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
