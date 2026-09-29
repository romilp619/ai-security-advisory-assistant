// Resolves what the user typed into an exact ecosystem/package identity.
// Live advisory lookup is only meaningful against an exact package name, so an
// unresolved or ambiguous name must ask the user rather than guess a package.
export type Identity = {
  ecosystem: 'npm';
  name: string;
  display: string;
  basis: 'exact-package-name' | 'known-alias';
};
export type IdentityResult =
  | {status: 'resolved'; identity: Identity}
  | {status: 'ambiguous'; query: string; candidates: Identity[]; reason: string}
  | {status: 'unsupported'; query: string; reason: string};

// npm registry naming rules: optional scope, lowercase, <=214 characters.
const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const key = (value: string) => normalize(value).replace(/[ ._-]/g, '');

// Display names only. Anything absent here still resolves when the user types
// the real package name, so this table never needs to be exhaustive.
const ALIASES: Record<string, string | string[]> = {
  nextjs: 'next', next: 'next',
  vite: 'vite', vitejs: 'vite',
  react: 'react', reactdom: 'react-dom', reactjs: 'react',
  vue: 'vue', vuejs: 'vue',
  nuxt: 'nuxt', nuxtjs: 'nuxt',
  svelte: 'svelte', sveltekit: '@sveltejs/kit',
  express: 'express', expressjs: 'express',
  axios: 'axios', webpack: 'webpack', rollup: 'rollup', esbuild: 'esbuild',
  lodash: 'lodash', moment: 'moment', tailwindcss: 'tailwindcss', tailwind: 'tailwindcss',
  nestjs: '@nestjs/core', nest: '@nestjs/core',
  astro: 'astro', remix: '@remix-run/server-runtime',
  socketio: 'socket.io', mongoose: 'mongoose', prisma: 'prisma',
  jsonwebtoken: 'jsonwebtoken', passport: 'passport', minimist: 'minimist',
  // Genuinely ambiguous display names: two different packages are plausible.
  angular: ['@angular/core', 'angular'],
  babel: ['@babel/core', 'babel'],
  eslint: ['eslint'],
  typescript: ['typescript'],
};

export function resolveIdentity(software: string): IdentityResult {
  const query = software.trim();
  if (!query) return {status: 'unsupported', query, reason: 'No software name was supplied.'};
  const alias = ALIASES[key(query)];
  if (Array.isArray(alias)) {
    if (alias.length > 1) return {
      status: 'ambiguous', query,
      candidates: alias.map(name => ({ecosystem: 'npm' as const, name, display: query, basis: 'known-alias' as const})),
      reason: '"' + query + '" maps to more than one npm package. Enter the exact package name so the lookup is unambiguous.',
    };
    return {status: 'resolved', identity: {ecosystem: 'npm', name: alias[0], display: query, basis: 'known-alias'}};
  }
  if (typeof alias === 'string') return {status: 'resolved', identity: {ecosystem: 'npm', name: alias, display: query, basis: 'known-alias'}};
  const candidate = normalize(query);
  if (candidate.length <= 214 && NPM_NAME.test(candidate)) {
    return {status: 'resolved', identity: {ecosystem: 'npm', name: candidate, display: query, basis: 'exact-package-name'}};
  }
  return {
    status: 'unsupported', query,
    reason: '"' + query + '" is not a recognized display name and is not a valid npm package name. Live lookup currently covers npm packages; enter the exact package name as published on npm.',
  };
}
