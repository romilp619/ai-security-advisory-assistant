import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { securityAdvisory } from './sanity/schema';
// Public identifiers for the user's existing project. No secrets enter this bundle.
export default defineConfig({
  name: 'security-advisory', title: 'AI Security Advisory Assistant',
  projectId: 'o7qa6o3y', dataset: 'production', plugins: [structureTool()],
  schema: { types: [securityAdvisory] },
});
