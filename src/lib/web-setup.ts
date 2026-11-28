import { Platform } from 'react-native';

// Web only: Hebrew, right-to-left, page title, brand font and background.
export function setupWebDocument() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = 'he';
  html.dir = 'rtl';
  document.title = 'Move with Tamar';
  document.body.style.backgroundColor = '#F8F4EA';
  document.body.style.fontFamily = "'Heebo', system-ui, sans-serif";
  if (!document.getElementById('heebo-font')) {
    const link = document.createElement('link');
    link.id = 'heebo-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
  // React Native Web gives every <Text> its own font-family (the system default) regardless of the body's.
  // Force Heebo everywhere so the brand font actually shows on labels, buttons and numbers — not just native inputs.
  // Excludes anything that already sets its OWN font-family inline — that's icon glyphs (Ionicons etc.), which
  // must keep their icon font or every chevron/plus/minus turns into a missing-glyph box.
  if (!document.getElementById('brand-font-override')) {
    const style = document.createElement('style');
    style.id = 'brand-font-override';
    style.textContent = `#root *:not([style*="font-family"]) { font-family: 'Heebo', system-ui, -apple-system, sans-serif !important; }`;
    document.head.appendChild(style);
  }

  // A light that passes over the "מצטיינת" badge every few seconds (off when the device asks for less motion).
  if (!document.getElementById('badge-shine')) {
    const style = document.createElement('style');
    style.id = 'badge-shine';
    style.textContent = `[data-shine]::after { content: ""; position: absolute; top: -20%; bottom: -20%; left: 32%; width: 36%; pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent); transform: translateX(-280%) rotate(16deg); animation: badge-shine 3.8s ease-in-out 1s infinite; }
      @keyframes badge-shine { 0%, 58% { transform: translateX(-280%) rotate(16deg); } 100% { transform: translateX(280%) rotate(16deg); } }
      @media (prefers-reduced-motion: reduce) { [data-shine]::after { display: none; } }`;
    document.head.appendChild(style);
  }

  // Lets the app be added to the home screen (required for notifications on iPhone).
  const add = (id: string, tag: 'link' | 'meta', attrs: Record<string, string>) => {
    if (document.getElementById(id)) return;
    const el = document.createElement(tag);
    el.id = id;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  };
  add('pwa-manifest', 'link', { rel: 'manifest', href: '/manifest.webmanifest' });
  add('pwa-icon', 'link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
  add('pwa-capable', 'meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('pwa-title', 'meta', { name: 'apple-mobile-web-app-title', content: 'Move with Tamar' });
  add('pwa-theme', 'meta', { name: 'theme-color', content: '#F8F4EA' });
}
