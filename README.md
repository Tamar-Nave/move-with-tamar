# Move with Tamar

A booking app for a boutique fitness studio, built end to end for a real client: class schedule, registration with waitlists, membership tracking, recipes, and push notifications. It runs as an installable web app (PWA) on a free-tier stack.

The product is in Hebrew and fully right-to-left. Access is by invitation only, so the live app is not open for sign-up.

## See it in action


https://github.com/user-attachments/assets/2e374c15-1546-4c83-a793-93d931dc79aa


A 34-second walkthrough of the app. It was built in code with HyperFrames from the app's own screens, running with fictional demo data. Music: Sascha Ende, ende.app (CC BY 4.0).

## What it does

**For members**
- Sign in with an emailed one-time code or a password
- Weekly schedule, class page with participant avatars, one-tap registration and cancellation
- Automatic waitlist: when a spot opens, the first person in line gets a time-limited offer
- Add a class to Google Calendar or Apple Calendar
- Subscription status and remaining entries, "my bookings" (upcoming and past)
- Recipe library with search, favourites, nutrition values and ingredient substitutes
- Push notifications: class reminders, studio announcements, waitlist offers, cancellations
- Install prompt for Android and iOS home screens

**For the studio owner (admin)**
- Create classes from a free-text sentence (a Hebrew parser fills the form, including several days at once)
- Manage members, subscriptions (unlimited or 8 entries per calendar month), freezes and payment tracking
- Attendance, manual booking and cancellation, announcements from templates
- Recipe editor with photo upload
- Two-factor authentication (TOTP) for the admin account

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo (React Native for Web), Expo Router, TypeScript |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |
| Edge | Cloudflare Worker: serves the app, generates `.ics` calendar files, runs a cron job for push notifications |
| Push | Web Push (VAPID) via `@block65/webcrypto-web-push` |
| Hosting cost | Free tiers only |

## Architecture

```
Browser / installed PWA
        │
        ├── static app + /calendar/*.ics ──►  Cloudflare Worker  ── cron (every minute) ──► web push
        │                                           │
        └── supabase-js (auth, queries, RPC) ───────┴──►  Supabase (Postgres + RLS)
```

The business rules live in the database, not in the client. Booking, cancellation, waitlist promotion, entry counting and roster visibility are enforced by `security definer` functions and RLS policies, so a modified client cannot bypass them. The functions are `book_class`, `cancel_booking`, `confirm_offer`, `promote_waitlist`, `admin_book`, `admin_cancel_booking`, `class_roster` and `my_entries_left`.

## Security and privacy

Real members' data is involved, so this was treated as a requirement and not an afterthought.

- **Authorization in the database:** RLS on every table, explicit `auth.uid()` checks inside privileged functions, and a privacy rule that members see each other only by first name and photo
- **MFA (TOTP)** for the admin account, with a challenge screen between login and the app
- **Audit log:** every change to bookings, memberships and payments is recorded automatically by triggers, readable by the admin only, kept for 90 days
- **Transport:** HSTS and related security headers on both the Worker responses and the static files
- **Secrets:** only public keys (Supabase publishable key, VAPID public key) are in the repository. The VAPID private key and the cron secret live in Cloudflare, and the database stores only a hash of the cron secret
- **Review process:** read-only reviewer agents for authentication, authorization, cryptography, hashing and privacy (`.claude/agents/`) were run before release, and their findings were fixed

## Project layout

```
src/app/          screens (Expo Router): home, schedule, recipes, admin, profile, login, MFA
src/components/   shared UI, MFA settings, notification settings, install prompt
src/lib/          Supabase client, auth, dates (Israel time), classes, members, calendar, push, parsing
worker/           Cloudflare Worker (static assets, calendar files, notification cron)
supabase/migrations/   database schema and policies, numbered 001 to 016
public/           PWA manifest, service worker, icons, security headers
design/           wireframes
docs/             launch video
```

## Run it locally

You need Node.js 20 or newer and your own Supabase project.

```bash
npm install
cp .env.example .env.local     # fill in your Supabase URL and publishable key
npm run web                    # development server
```

Then run the files in `supabase/migrations/` in order, in the Supabase SQL editor.

```bash
npx tsc --noEmit               # type check
npm run deploy                 # build the web app and deploy the Worker (needs a Cloudflare account)
```

## Decisions worth mentioning

- **PWA instead of app stores:** free to run, no review process, and installable from the browser.
- **Rules in Postgres:** one source of truth that every client, including a hostile one, has to go through.
- **Invite-only access:** the owner adds members by name and email, which keeps the member list private.
- **Free-tier stack:** the project runs at zero hosting cost.
- **No AI in the runtime:** the free-text class form uses a deterministic Hebrew parser, so there are no API costs and the output is predictable.

## Status

In active use by the studio. Next steps are a final visual design pass and an accessibility review.

## License

© Tamar Nave. All rights reserved. The source is published for viewing and portfolio purposes only; copying or reuse requires permission.
