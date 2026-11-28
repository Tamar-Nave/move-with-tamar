// 1) Serves each member's personal calendar feed at /calendar/<secret-token>.ics.
// 2) Every minute, sends the push notifications that are due.
// Everything else is the static app (served by the assets binding).
import { buildPushPayload } from '@block65/webcrypto-web-push';

const KIND_LABEL = { sculpt: 'SCULPT', functional: 'אימון פונקציונלי' };
const BRAND = 'Move with Tamar';

// A class's display name: the class type's name (new), else the old kind (links and rows from before class types).
const cleanName = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60); // no control characters (CR/LF...) from a link
const classLabel = (r) => cleanName(r.type_name) || (Object.hasOwn(KIND_LABEL, r.kind) ? KIND_LABEL[r.kind] : 'אימון');

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

// RFC 5545: lines are folded at 75 octets (Hebrew letters are 2 bytes each).
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 70) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join('\r\n');
}

function buildCalendar(rows, { alarms = true, name = BRAND } = {}) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${BRAND}//Classes//HE`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  const now = stamp(new Date());
  for (const r of rows) {
    const start = new Date(r.starts_at);
    const end = new Date(start.getTime() + r.duration_min * 60000);
    const cancelled = r.class_status === 'cancelled';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.class_id}@movewithtamar`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`${classLabel(r)} · ${BRAND}`)}`,
      `DESCRIPTION:${esc(r.notes && r.notes !== '[demo]' ? r.notes : 'נתראה באימון!')}`,
      `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    );
    if (!cancelled && alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`תזכורת: ${classLabel(r)} בעוד שעתיים`)}`, 'TRIGGER:-PT120M', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Same policy as public/_headers, for the responses this worker builds itself
// (the static assets go through Cloudflare's own _headers handling instead).
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};
function withSecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

export default {
  async fetch(request, env) {
    const response = await handleRequest(request, env);
    return withSecurityHeaders(response);
  },

  // Runs every minute (see "triggers" in wrangler.jsonc): sends the push notifications that are due.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDueNotifications(env));
  },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);

    // One class as a calendar file (the iPhone opens it in its Calendar app). Uses only the details in the link.
    if (url.pathname === '/calendar/event.ics') {
      const id = url.searchParams.get('id') ?? '';
      const kind = url.searchParams.get('k') ?? '';
      const typeName = cleanName(url.searchParams.get('t')); // class type name (new links); `k` is the old kind (old links)
      const start = new Date(url.searchParams.get('s') ?? '');
      const duration = Number(url.searchParams.get('d'));
      if (!/^[0-9a-f-]{36}$/i.test(id) || !(Object.hasOwn(KIND_LABEL, kind) || typeName) || Number.isNaN(start.getTime()) || !(duration >= 10 && duration <= 300)) {
        return new Response('Invalid class link.', { status: 400 });
      }
      const ics = buildCalendar([{ class_id: id, kind, type_name: typeName, starts_at: start.toISOString(), duration_min: duration, class_status: 'scheduled', notes: null }], { alarms: false });
      return new Response(ics, {
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="move-with-tamar-class.ics"' },
      });
    }

    // The studio's whole schedule for the admin (only works with an admin's secret token; any other token gets an empty calendar).
    const am = url.pathname.match(/^\/calendar\/admin\/([0-9a-f-]{36})\.ics$/i);
    if (am) {
      const ares = await rpc(env, 'admin_calendar_feed', { p_token: am[1] });
      if (!ares.ok) return new Response('Calendar is not available right now.', { status: 502 });
      const arows = await ares.json();
      return new Response(buildCalendar(Array.isArray(arows) ? arows : [], { alarms: false, name: BRAND + ' · כל האימונים' }), {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'private, max-age=300',
          'Content-Disposition': 'inline; filename="move-with-tamar-studio.ics"',
        },
      });
    }

    const m = url.pathname.match(/^\/calendar\/([0-9a-f-]{36})\.ics$/i);
    if (!m) return env.ASSETS.fetch(request);

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: m[1] }),
    });
    if (!res.ok) return new Response('Calendar is not available right now.', { status: 502 });
    const rows = await res.json();
    return new Response(buildCalendar(Array.isArray(rows) ? rows : []), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline; filename="move-with-tamar.ics"',
      },
    });
}

async function rpc(env, name, body) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendDueNotifications(env) {
  const res = await rpc(env, 'claim_notifications', { p_secret: env.CRON_SECRET, p_limit: 30 });
  // Status only — the response body could in principle carry other admins' names (via the
  // payment-reminder digest), and Cloudflare's own logs aren't gated by our app's RLS.
  if (!res.ok) { console.log('claim failed', res.status); return; }
  const rows = await res.json();
  const vapid = { subject: env.SITE_URL, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };

  for (const r of rows) {
    try {
      const payload = await buildPushPayload(
        { data: JSON.stringify({ title: r.n_title, body: r.n_body, url: r.n_url }), options: { ttl: 6 * 3600, urgency: 'high' } },
        { endpoint: r.sub_endpoint, expirationTime: null, keys: { p256dh: r.sub_p256dh, auth: r.sub_auth } },
        vapid,
      );
      const push = await fetch(r.sub_endpoint, payload);
      if (push.status === 404 || push.status === 410) {
        // The device unsubscribed: forget it.
        await rpc(env, 'drop_push_subscription', { p_secret: env.CRON_SECRET, p_endpoint: r.sub_endpoint });
      } else if (!push.ok) {
        console.log('push rejected', push.status);
      }
    } catch (err) {
      console.log('push error', String(err));
    }
  }
}
