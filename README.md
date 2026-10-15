# EggDrop

Businesses pay **$0.05 per egg** to hide a discount or gift card near their shop. Players find eggs through the phone camera and redeem them at the counter with a one-time QR code.

The app is a Next.js PWA. The player side has a map, an AR catch screen, a crack-open reveal, and a wallet. The business side has a dashboard, an egg drop, Stripe Checkout, campaign results, and a scanner.

## Local setup

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API keys are required for the local demo. The demo session cookie is marked Secure only when the site is actually served over HTTPS (a tunnel, or Vercel, which sends `x-forwarded-proto`). On `http://localhost` the cookie still sticks, including in iOS Safari.

The header switches between **Player** and **Business**. On a fresh seed you are standing outside Bean There Cafe in Hayes Valley. One egg is 42 m away, so it shows up in the camera. An egg at 60 m stays on the map and stays out of the camera until you are within 50 m.

| Side | What to try |
| --- | --- |
| Player | Map → Hunt → tap the egg → wallet → open a reward |
| Business | Dashboard → Hide eggs → pay → results |
| Redeem | Business → Scan, enter `EGG-4F7K-22`, then enter it again |

The second scan is rejected. A code cannot be redeemed twice, and Bean There cannot redeem another shop's code.

`npm run seed` rebuilds three things:

- `.data/db.json`, the local database
- `supabase/seed.sql`, the same demo world as SQL
- the Supabase project, when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

Copy `.env.example` to `.env.local` when you connect Supabase or Stripe. Leave the values blank to stay on the local database.

## How the pieces behave

- **Camera.** Hunt and scan stay on the illustrated street until you tap **Start camera**. That tap is what calls `getUserMedia` (`facingMode: "environment"`, video `playsinline`, `muted`, and `autoplay`), which is what iOS Safari requires before it will show the permission prompt. The egg is an overlay. If you deny the camera, the screen says so and offers **Try camera again**. With no camera at all, the chip says "Camera off" and you can still tap an egg or type a code.
- **Location.** The map opens on the demo spot and does not ask for GPS until you tap **Use my GPS**. If you deny it, or the browser has no location, a note explains that and the demo spot stays on so the seed is still playable. After a grant, the app watches `navigator.geolocation`. The server only creates a claim when the reported point is within **50 m** of that egg.
- **Map.** Leaflet with [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles.
- **Money.** A drop of N eggs is `N × $0.05`. The slider starts at 10 eggs because Stripe's card minimum is $0.50. With no `STRIPE_SECRET_KEY`, confirm runs the same `activateCampaign` path the webhook uses and does not charge a card.
- **Codes.** Each claim stores a human code (`EGG-XXXX-XX`) and a random token in the QR. Redeeming either marks the claim redeemed and inserts one redemption row. The unique constraint on `redemptions.claim_id` blocks a second use.

Browser geolocation can be spoofed. The 50 m check is the product rule, not a proof of physical presence.

## Supabase

1. Create a project.
2. Run `supabase/migrations/20261014000000_init.sql` in the SQL editor (or `supabase db push` if you use the CLI).
3. Put the project URL, anon key, and service role key in `.env.local`.
4. Set `EGG_DATA_DRIVER=supabase`.
5. Run `npm run seed`.

The seed creates two confirmed users:

| Email | Password | Role |
| --- | --- | --- |
| `player@eggdrop.demo` | `eggdrop-demo` | Player (Alex Rivera) |
| `cafe@eggdrop.demo` | `eggdrop-demo` | Bean There Cafe |

You can also paste `supabase/seed.sql` into the SQL editor. That loads the rows but does not create Auth users; `npm run seed` does both.

The claim, redeem, and activate operations are Postgres functions (`claim_egg`, `redeem_claim`, `activate_campaign`) so two players cannot take the same egg. Row level security is on. The Next.js server uses the service role and checks the signed-in user before it calls those functions.

## Stripe test mode

1. Use test keys (`sk_test_…`, `pk_test_…`) in `.env.local`.
2. Start the app and, in another terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. Put the `whsec_…` signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Hide eggs and pay with `4242 4242 4242 4242`, any future date, any CVC.

Checkout metadata carries the campaign id. `checkout.session.completed` activates the eggs. The success page also calls `/api/checkout/confirm`, which checks `payment_status === "paid"` and activates again. Activation is idempotent.

## Deploy on Vercel

Do this from a machine you control. This repo's automation does not deploy.

1. Push the branch and import the repo in Vercel. Framework preset: Next.js.
2. Add every variable from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to the deployment origin, with no trailing slash. Set `EGG_DATA_DRIVER=supabase`.
3. In Supabase → Authentication → URL configuration, add `https://<your-app>.vercel.app` as a site URL.
4. In Stripe, add a webhook endpoint `https://<your-app>.vercel.app/api/webhooks/stripe` for `checkout.session.completed`, and store its signing secret.
5. Deploy. Run `npm run seed` once from your laptop with the production Supabase keys so the demo rows and users exist.
6. Open the site on a phone, install it (Add to Home Screen / Install app), and allow camera and location when you hunt.

The local JSON database is only for development. On Vercel the filesystem is ephemeral, so production needs Supabase.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build |
| `npm run seed` | Reset local data, rewrite `supabase/seed.sql`, push to Supabase when configured |
| `npm test` | Seed counts, the 50 m gate, one-time redeem, and paid activation |
| `npm run icons` | Redraw the PWA icons |

## iPhone (Safari and the Home Screen)

The rear camera and GPS need a secure context. `http://localhost` counts on the computer running the dev server. A phone cannot use the camera against `http://192.168.x.x` — Safari blocks `getUserMedia` on plain HTTP.

Serve the app over HTTPS, then open that URL in Safari:

```bash
npm run dev

# Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000

# or a temporary https URL
npx localtunnel --port 3000
```

A Vercel preview is the other HTTPS option. Push this branch and open the preview URL the project gives you. This repo's automation does not deploy one for you. Previews are already `https://`, so the camera prompt works there the same way as through a tunnel.

On the phone:

1. Map stays on the demo spot until you tap **Use my GPS**. Denying location leaves the demo spot in place and explains how to allow it.
2. On Hunt or Scan, tap **Start camera**. The prompt appears after that tap. If you deny it, EggDrop says the camera is off and shows **Try camera again**. The video element is inline, muted, and autoplaying so iOS does not jump into fullscreen.
3. Scan reads the QR in the page with jsQR. The code field under the viewfinder is the fallback when the camera is blocked.
4. Share → **Add to Home Screen**. The icon is `apple-touch-icon.png` (180×180). `apple-mobile-web-app-capable` and a standalone manifest hide Safari's chrome, and `black-translucent` plus `viewport-fit=cover` let the cream background run under the status bar. Padding uses `env(safe-area-inset-*)` so the notch and home bar do not cover the header, the camera controls, or the tab bar. Open the home-screen icon and hunt from there.

## PWA

`public/manifest.webmanifest` and `public/sw.js` make the app installable. The manifest asks for a portrait standalone window. The service worker is registered in production only, and it never caches `/api`.
