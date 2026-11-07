export function publicOrigin(env = {}) {
  const raw =
    env.COROA_SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL
      : env.VERCEL_URL
        ? 'https://' + env.VERCEL_URL
        : '');
  if (!raw) return '';
  const u = new URL(raw);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.pathname !== '/' ||
    u.search ||
    u.hash
  )
    throw new Error('COROA_SITE_URL deve ser a origem HTTPS pública do site, sem caminhos.');
  return u.origin;
}
export function socialMetadata(origin = '') {
  return `<meta name="description" content="A Coroa Velada: um grupo de RPG, infinitas histórias. Entre na sua campanha, cuide do seu personagem e descubra o que existe além do véu.">
<meta name="application-name" content="A Coroa Velada"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Coroa Velada"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="color-scheme" content="dark"><meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="A Coroa Velada"><meta property="og:title" content="A Coroa Velada · Sua história, além do véu"><meta property="og:description" content="O sangue lembra. A noite nunca esquece. Um refúgio para nossas campanhas, personagens, mistérios e histórias."><meta property="og:image" content="${origin}/assets/images/coroa-share.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:alt" content="A Coroa Velada: uma coroa carmesim sobre uma cidade à noite.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="A Coroa Velada · Sua história, além do véu"><meta name="twitter:description" content="Um grupo de RPG. Infinitas histórias. Entre na sua crônica."><meta name="twitter:image" content="${origin}/assets/images/coroa-share.jpg"><meta name="twitter:image:alt" content="A Coroa Velada, histórias que merecem a eternidade.">
${origin ? `<link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/">` : ''}
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">`;
}
