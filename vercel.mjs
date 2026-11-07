const raw = process.env.COROA_API_BASE;
let base = '';
if (raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('COROA_API_BASE deve ser a origem HTTPS do Render.');
  base = url.origin;
}
if (process.env.VERCEL && !base) throw new Error('Configure COROA_API_BASE antes de publicar.');
export const config = {
  framework: null,
  installCommand: 'npm ci --include=dev',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: base ? [
    { source: '/auth/:path*', destination: base + '/auth/:path*' },
    { source: '/api/:path*', destination: base + '/api/:path*' }
  ] : [],
  headers: [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "default-src 'self'; manifest-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
  ] }]
};
