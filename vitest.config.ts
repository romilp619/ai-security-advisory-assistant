import { defineConfig } from 'vitest/config';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch { /* Local credentials are optional. */ }
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 15000 }, resolve: { alias: { '@': new URL('./src', import.meta.url).pathname.replace(/^\/(.:)/, '$1') } } });
