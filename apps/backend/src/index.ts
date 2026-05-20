import 'dotenv/config';
import { buildServer } from './server.js';

const port = Number(process.env['BACKEND_PORT'] ?? 3001);
const app = buildServer();

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
