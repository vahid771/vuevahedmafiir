import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development.local'), override: true });

import app from './app';
import { runMigrations } from './db';

const PORT = process.env.PORT ?? 3001;

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
