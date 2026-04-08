import { build } from 'esbuild';

await build({
  entryPoints: ['sdk-entry.mjs'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'VapiSDK',
  outfile: 'public/vapi-bundle.js',
  minify: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});

console.log('✅ Vapi SDK bundled → public/vapi-bundle.js');
