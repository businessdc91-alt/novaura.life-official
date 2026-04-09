/**
 * Cloud Run entry point
 * Standalone HTTP server — replaces Firebase Functions hosting for Cloud Run deployments
 */

// Load env + init Firebase Admin FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

import './init';
import app from './api/app';

const PORT = parseInt(process.env.PORT || '8080', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NovAura API running on port ${PORT}`);
});
