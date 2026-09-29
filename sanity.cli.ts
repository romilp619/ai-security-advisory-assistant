import { defineCliConfig } from 'sanity/cli';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch { /* Optional during setup. */ }
export default defineCliConfig({ api: { projectId: process.env.SANITY_PROJECT_ID, dataset: 'production' } });
