import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { securityAdvisory } from './sanity/schema';
// The Studio project ID is supplied at build time; it is a public identifier, not a credential.
export default defineConfig({
  name: 'security-advisory', title: 'AI Security Advisory Assistant',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!, dataset: 'production', plugins: [structureTool()],
  schema: { types: [securityAdvisory] },
});
