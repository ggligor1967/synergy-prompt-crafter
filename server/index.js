import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`  API docs: http://localhost:${PORT}/api/docs`);
  console.log(`  OpenAPI:  http://localhost:${PORT}/api/openapi.json`);
});
